-- Melhorias pedidas pelo Igor em 19/10/2026: cobrança com chave Pix, metas e tetos, lixeira,
-- categorias próprias, vários negócios por conta, acesso do contador (só leitura), indicação
-- e avisos no celular.

-- ---------- Negócio ----------
alter table empresa add column chave_pix text;
alter table empresa add column meta_faturamento bigint check (meta_faturamento >= 0);
-- Teto de gasto por mês em cada categoria: {"embalagem": 50000}.
alter table empresa add column limites_categoria jsonb not null default '{}';
alter table empresa add column mensagem_cobranca text;

-- ---------- Lixeira ----------
-- Lançamento apagado fica 30 dias aqui (com o aporte espelho, quando houver) e pode voltar.
create table lixeira (
  id uuid primary key,
  empresa_id uuid not null references empresa (id) on delete cascade,
  excluido_em date not null default current_date,
  lancamentos jsonb not null
);
create index on lixeira (empresa_id, excluido_em);
alter table lixeira enable row level security;
alter table lixeira force row level security;
create policy "da minha empresa" on lixeira for all using (minha_empresa(empresa_id)) with check (minha_empresa(empresa_id));

-- ---------- Vários negócios na mesma conta ----------
-- Quantos negócios cada plano permite. O Plus nasce com 3.
alter table plano add column negocios int not null default 1 check (negocios between 1 and 50);
update plano set negocios = 3 where id = 'plus';

-- O negócio aberto em cada sessão (vazio = o primeiro da pessoa).
alter table sessao add column empresa_id uuid references empresa (id) on delete set null;

-- ---------- Contador (só para ver) ----------
create table empresa_membro (
  empresa_id uuid not null references empresa (id) on delete cascade,
  usuario_id uuid not null references usuario (id) on delete cascade,
  papel text not null default 'contador' check (papel in ('contador')),
  criado_em timestamptz not null default now(),
  primary key (empresa_id, usuario_id)
);
create index on empresa_membro (usuario_id);
-- Sem "force": as funções abaixo rodam como dona da tabela e não caem em laço com as regras da empresa.
alter table empresa_membro enable row level security;
create policy "eu ou o dono" on empresa_membro for select using (usuario_id = app_usuario() or minha_empresa(empresa_id));
create policy "dono tira" on empresa_membro for delete using (minha_empresa(empresa_id));
-- O próprio contador também pode sair.
create policy "eu saio" on empresa_membro for delete using (usuario_id = app_usuario());

create function sou_membro(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from empresa_membro where empresa_id = e and usuario_id = app_usuario())
$$;

-- O contador lê tudo do negócio, mas não grava nada: as regras de gravação continuam só do dono.
create policy "contador ve" on empresa for select using (sou_membro(id));
do $$
declare t text;
begin
  foreach t in array array['conta_financeira', 'categoria_desativada', 'recorrencia', 'lancamento', 'pagamento_das', 'aviso_dispensado',
                           'comprovante', 'atendimento', 'parceiro', 'lixeira'] loop
    execute format('create policy "contador ve" on %I for select using (sou_membro(empresa_id))', t);
  end loop;
end $$;
create policy "contador ve" on categoria for select using (empresa_id is not null and sou_membro(empresa_id));

-- Convite: o dono gera um link; quem abrir e entrar vira contador do negócio.
create table convite_contador (
  codigo_hash text primary key,
  empresa_id uuid not null references empresa (id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz,
  usado_por uuid references usuario (id) on delete set null
);
alter table convite_contador enable row level security;
create policy "do dono" on convite_contador for all using (minha_empresa(empresa_id)) with check (minha_empresa(empresa_id));

-- Nome do negócio de um convite ainda válido (aparece antes de entrar).
create function convite_negocio(codigo text) returns text
language sql stable security definer set search_path = public as $$
  select e.nome_fantasia from convite_contador c join empresa e on e.id = c.empresa_id
  where c.codigo_hash = codigo and c.usado_em is null and c.expira_em > now()
$$;

-- Aceita o convite para a pessoa logada; devolve o negócio (ou nada, se o convite não vale).
create function aceitar_convite(codigo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c convite_contador;
begin
  select * into c from convite_contador where codigo_hash = codigo and usado_em is null and expira_em > now() for update;
  if not found or app_usuario() is null then return null; end if;
  if not exists (select 1 from empresa where id = c.empresa_id and usuario_id = app_usuario()) then
    insert into empresa_membro (empresa_id, usuario_id) values (c.empresa_id, app_usuario()) on conflict do nothing;
  end if;
  update convite_contador set usado_em = now(), usado_por = app_usuario() where codigo_hash = codigo;
  return c.empresa_id;
end $$;

-- Plano do dono de um negócio que a pessoa vê como contador (os módulos que aparecem para ela).
create function plano_do_negocio(e uuid) returns table (plano_nome text, modulos text[])
language sql stable security definer set search_path = public as $$
  select p.nome, p.modulos from empresa x join assinatura a on a.usuario_id = x.usuario_id join plano p on p.id = a.plano_id
  where x.id = e and (x.usuario_id = app_usuario() or exists (select 1 from empresa_membro m where m.empresa_id = e and m.usuario_id = app_usuario()))
$$;

-- Quem tem acesso de contador ao negócio (nome e e-mail, para o dono ver e tirar).
create function contadores_do_negocio(e uuid) returns table (usuario_id uuid, nome text, email text, desde timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.nome, u.email, m.criado_em from empresa_membro m join usuario u on u.id = m.usuario_id
  join empresa x on x.id = m.empresa_id and x.usuario_id = app_usuario()
  where m.empresa_id = e order by m.criado_em
$$;

-- ---------- Indique e ganhe ----------
alter table usuario add column codigo_indicacao text;
alter table usuario add column indicado_por uuid references usuario (id) on delete set null;
update usuario set codigo_indicacao = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) where codigo_indicacao is null;
alter table usuario alter column codigo_indicacao set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
alter table usuario alter column codigo_indicacao set not null;
create unique index usuario_codigo_indicacao on usuario (codigo_indicacao);
create index on usuario (indicado_por) where indicado_por is not null;

-- Quantas pessoas se cadastraram pelo link da pessoa logada e quantas já pagam.
create function minhas_indicacoes() returns table (cadastros int, assinantes int)
language sql stable security definer set search_path = public as $$
  select count(*)::int, count(*) filter (where a.situacao = 'ativa')::int
  from usuario u left join assinatura a on a.usuario_id = u.id
  where u.indicado_por = app_usuario()
$$;

-- ---------- Avisos no celular ----------
-- Chaves do servidor para os avisos (geradas na primeira vez que o servidor sobe).
create table push_chaves (
  id boolean primary key default true check (id),
  publica text not null,
  privada text not null
);

create table push_inscricao (
  endpoint text primary key,
  usuario_id uuid not null references usuario (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);
create index on push_inscricao (usuario_id);
alter table push_inscricao enable row level security;
alter table push_inscricao force row level security;
create policy "as minhas" on push_inscricao for all using (usuario_id = app_usuario()) with check (usuario_id = app_usuario());

-- Aparelhos do dono de um negócio (o envio diário roda sem pessoa logada).
create function aparelhos_do_negocio(e uuid) returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select p.endpoint, p.p256dh, p.auth from push_inscricao p join empresa x on x.usuario_id = p.usuario_id where x.id = e
$$;

-- Aparelho que o navegador desativou (o serviço de avisos responde 404 ou 410).
create function esquecer_aparelho(ponto text) returns void
language sql security definer set search_path = public as $$ delete from push_inscricao where endpoint = ponto $$;

-- Os lembretes do dia passam a sair também para quem só ligou os avisos no celular.
-- Mesma consulta da 0006, com quem recebe por e-mail marcado em cada linha.
drop function lembretes_do_dia(date);
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
  data date,
  por_email boolean
)
language sql stable security definer set search_path = public as $$
  with alvo as (
    select e.id, u.email, e.nome_dono, e.nome_fantasia, e.eh_mei, e.lembrete_dias, e.resumo_mensal, e.lembrete_email
    from empresa e
    join usuario u on u.id = e.usuario_id
    left join assinatura a on a.usuario_id = u.id
    where (e.lembrete_email or exists (select 1 from push_inscricao p where p.usuario_id = u.id))
      and coalesce(a.situacao, 'teste') not in ('suspensa', 'cancelada')
  ),
  contas as (
    select l.*, coalesce(nullif(case when l.natureza = 'entrada' then coalesce(l.contraparte, l.descricao) else coalesce(l.descricao, l.contraparte) end, ''), c.nome,
             case when l.natureza = 'entrada' then 'Um cliente' else 'Uma conta' end) as nome
    from lancamento l left join categoria c on c.id = l.categoria_id
    where l.situacao = 'previsto' and l.natureza in ('entrada', 'saida') and l.data_vencimento is not null
  )
  select a.id, a.email, a.nome_dono, a.nome_fantasia, 'pagar', 'pagar:' || l.id || ':' || l.data_vencimento, l.nome, l.valor, l.data_vencimento, a.lembrete_email
  from alvo a join contas l on l.empresa_id = a.id
  where l.natureza = 'saida' and coalesce(l.lembrete_dias, a.lembrete_dias) >= 0
    and l.data_vencimento - coalesce(l.lembrete_dias, a.lembrete_dias) = hoje
  union all
  select a.id, a.email, a.nome_dono, a.nome_fantasia, 'receber', 'receber:' || l.id || ':' || l.data_vencimento, l.nome, l.valor, l.data_vencimento, a.lembrete_email
  from alvo a join contas l on l.empresa_id = a.id
  where l.natureza = 'entrada' and coalesce(l.lembrete_dias, 0) >= 0 and l.data_vencimento = hoje
  union all
  select a.id, a.email, a.nome_dono, a.nome_fantasia, 'atrasada', 'atrasada:' || l.id, l.nome, l.valor, l.data_vencimento, a.lembrete_email
  from alvo a join contas l on l.empresa_id = a.id
  where l.natureza = 'saida' and coalesce(l.lembrete_dias, 0) >= 0 and l.data_vencimento = hoje - 1
  union all
  select a.id, a.email, a.nome_dono, a.nome_fantasia, case when extract(day from hoje) = 15 then 'das' else 'das-atrasado' end,
         'das:' || to_char(hoje, 'YYYY-MM') || ':' || extract(day from hoje), 'DAS de ' || to_char(hoje, 'MM/YYYY'), null::bigint,
         make_date(extract(year from hoje)::int, extract(month from hoje)::int, 20), a.lembrete_email
  from alvo a
  where a.eh_mei and extract(day from hoje) in (15, 21)
    and not exists (
      select 1 from pagamento_das p
      where p.empresa_id = a.id and p.competencia = date_trunc('month', hoje)::date
        and (p.pago_fora_do_sistema or p.lancamento_id is not null)
    )
  union all
  select a.id, a.email, a.nome_dono, a.nome_fantasia, 'fechamento', 'fechamento:' || to_char(hoje - 1, 'YYYY-MM'), to_char(hoje - 1, 'MM/YYYY'),
         (select coalesce(sum(case when l.natureza = 'entrada' then l.valor when l.natureza = 'saida' then -l.valor else 0 end), 0)
          from lancamento l where l.empresa_id = a.id and l.situacao = 'realizado'
            and l.data_pagamento >= date_trunc('month', hoje - 1) and l.data_pagamento < date_trunc('month', hoje))::bigint,
         (hoje - 1), a.lembrete_email
  from alvo a
  where a.resumo_mensal and extract(day from hoje) = 1
    and exists (select 1 from lancamento l where l.empresa_id = a.id and l.situacao = 'realizado'
                and l.data_pagamento >= date_trunc('month', hoje - 1) and l.data_pagamento < date_trunc('month', hoje))
  union all
  select a.id, a.email, a.nome_dono, a.nome_fantasia, 'dasn', 'dasn:' || to_char(hoje, 'YYYY-MM-DD'), 'DASN-SIMEI ' || (extract(year from hoje)::int - 1),
         null::bigint, make_date(extract(year from hoje)::int, 5, 31), a.lembrete_email
  from alvo a
  where a.eh_mei and to_char(hoje, 'MM-DD') in ('04-01', '05-15')
$$;

revoke execute on function lembretes_do_dia(date), aparelhos_do_negocio(uuid), esquecer_aparelho(text) from public;
