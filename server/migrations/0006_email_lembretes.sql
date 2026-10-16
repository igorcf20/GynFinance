-- E-mail: "Esqueci minha senha" e lembretes diários (contas vencendo, DAS, fechamento do mês,
-- declaração anual do MEI). O envio fica desligado até o servidor ter um provedor de e-mail (SMTP).

-- Link para criar uma senha nova: o e-mail leva um código aleatório; aqui fica só o hash dele.
create table senha_redefinicao (
  token_hash text primary key,
  usuario_id uuid not null references usuario (id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz
);
create index on senha_redefinicao (usuario_id);

-- Lembrete escolhido em cada conta (vazio = o padrão do negócio em Configurações; -1 = sem lembrete).
alter table lancamento add column lembrete_dias smallint check (lembrete_dias in (-1, 0, 1, 3));
-- Conta fixa: os meses seguintes nascem com o mesmo lembrete.
alter table recorrencia add column lembrete_dias smallint check (lembrete_dias in (-1, 0, 1, 3));

-- O que já foi enviado por e-mail, para nada sair duas vezes (chave: tipo e data ou conta).
create table email_enviado (
  empresa_id uuid not null references empresa (id) on delete cascade,
  chave text not null,
  enviado_em timestamptz not null default now(),
  primary key (empresa_id, chave)
);
alter table email_enviado enable row level security;
alter table email_enviado force row level security;
create policy "da minha empresa" on email_enviado for all using (minha_empresa(empresa_id)) with check (minha_empresa(empresa_id));

-- O envio diário roda sem pessoa logada. Esta função lê só o necessário para montar o e-mail
-- (nada de saldo ou extrato) e roda como dona das tabelas, porque o servidor não enxerga
-- os negócios de ninguém fora de um pedido da própria pessoa.
create function lembretes_do_dia(hoje date)
returns table (
  empresa_id uuid,
  email text,
  nome_dono text,
  nome_fantasia text,
  tipo text,
  chave text,
  titulo text,
  valor bigint,
  data date
)
language sql stable security definer set search_path = public as $$
  with alvo as (
    select e.id, u.email, e.nome_dono, e.nome_fantasia, e.eh_mei, e.lembrete_dias, e.resumo_mensal
    from empresa e
    join usuario u on u.id = e.usuario_id
    left join assinatura a on a.usuario_id = u.id
    where e.lembrete_email and coalesce(a.situacao, 'teste') not in ('suspensa', 'cancelada')
  ),
  contas as (
    select l.*, coalesce(nullif(case when l.natureza = 'entrada' then coalesce(l.contraparte, l.descricao) else coalesce(l.descricao, l.contraparte) end, ''), c.nome,
             case when l.natureza = 'entrada' then 'Um cliente' else 'Uma conta' end) as nome
    from lancamento l left join categoria c on c.id = l.categoria_id
    where l.situacao = 'previsto' and l.natureza in ('entrada', 'saida') and l.data_vencimento is not null
  )
  -- Conta a pagar vencendo: no dia escolhido na conta (ou o padrão do negócio).
  select a.id, a.email, a.nome_dono, a.nome_fantasia, 'pagar', 'pagar:' || l.id || ':' || l.data_vencimento, l.nome, l.valor, l.data_vencimento
  from alvo a join contas l on l.empresa_id = a.id
  where l.natureza = 'saida' and coalesce(l.lembrete_dias, a.lembrete_dias) >= 0
    and l.data_vencimento - coalesce(l.lembrete_dias, a.lembrete_dias) = hoje
  union all
  -- Conta a receber que vence hoje (para cobrar).
  select a.id, a.email, a.nome_dono, a.nome_fantasia, 'receber', 'receber:' || l.id || ':' || l.data_vencimento, l.nome, l.valor, l.data_vencimento
  from alvo a join contas l on l.empresa_id = a.id
  where l.natureza = 'entrada' and coalesce(l.lembrete_dias, 0) >= 0 and l.data_vencimento = hoje
  union all
  -- Conta a pagar que venceu ontem e continua em aberto.
  select a.id, a.email, a.nome_dono, a.nome_fantasia, 'atrasada', 'atrasada:' || l.id, l.nome, l.valor, l.data_vencimento
  from alvo a join contas l on l.empresa_id = a.id
  where l.natureza = 'saida' and coalesce(l.lembrete_dias, 0) >= 0 and l.data_vencimento = hoje - 1
  union all
  -- DAS do mês: dia 15 (vence dia 20) e dia 21 se não foi pago.
  select a.id, a.email, a.nome_dono, a.nome_fantasia, case when extract(day from hoje) = 15 then 'das' else 'das-atrasado' end,
         'das:' || to_char(hoje, 'YYYY-MM') || ':' || extract(day from hoje), 'DAS de ' || to_char(hoje, 'MM/YYYY'), null::bigint,
         make_date(extract(year from hoje)::int, extract(month from hoje)::int, 20)
  from alvo a
  where a.eh_mei and extract(day from hoje) in (15, 21)
    and not exists (
      select 1 from pagamento_das p
      where p.empresa_id = a.id and p.competencia = date_trunc('month', hoje)::date
        and (p.pago_fora_do_sistema or p.lancamento_id is not null)
    )
  union all
  -- Fechamento do mês que terminou, no dia 1.
  select a.id, a.email, a.nome_dono, a.nome_fantasia, 'fechamento', 'fechamento:' || to_char(hoje - 1, 'YYYY-MM'), to_char(hoje - 1, 'MM/YYYY'),
         (select coalesce(sum(case when l.natureza = 'entrada' then l.valor when l.natureza = 'saida' then -l.valor else 0 end), 0)
          from lancamento l where l.empresa_id = a.id and l.situacao = 'realizado'
            and l.data_pagamento >= date_trunc('month', hoje - 1) and l.data_pagamento < date_trunc('month', hoje))::bigint,
         (hoje - 1)
  from alvo a
  where a.resumo_mensal and extract(day from hoje) = 1
    and exists (select 1 from lancamento l where l.empresa_id = a.id and l.situacao = 'realizado'
                and l.data_pagamento >= date_trunc('month', hoje - 1) and l.data_pagamento < date_trunc('month', hoje))
  union all
  -- Declaração anual do MEI (DASN-SIMEI): 1º de abril e 15 de maio.
  select a.id, a.email, a.nome_dono, a.nome_fantasia, 'dasn', 'dasn:' || to_char(hoje, 'YYYY-MM-DD'), 'DASN-SIMEI ' || (extract(year from hoje)::int - 1),
         null::bigint, make_date(extract(year from hoje)::int, 5, 31)
  from alvo a
  where a.eh_mei and to_char(hoje, 'MM-DD') in ('04-01', '05-15')
$$;

-- Marca como enviado (mesma razão: roda sem pessoa logada).
create function marcar_email_enviado(empresa uuid, chaves text[]) returns void
language sql security definer set search_path = public as $$
  insert into email_enviado (empresa_id, chave) select empresa, unnest(chaves) on conflict do nothing
$$;

create function emails_enviados(empresa uuid, chaves text[]) returns setof text
language sql stable security definer set search_path = public as $$
  select chave from email_enviado where empresa_id = empresa and chave = any(chaves)
$$;

-- Ninguém além do servidor chama essas funções; o papel do servidor ganha o execute no fim da migração.
revoke execute on function lembretes_do_dia(date), marcar_email_enviado(uuid, text[]), emails_enviados(uuid, text[]) from public;
