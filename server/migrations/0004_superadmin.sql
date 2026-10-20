-- Painel de superadmin: planos (mensalidades) com módulos e IA, assinatura de cada negócio,
-- mensalidades recebidas, textos e imagens do site e configurações gerais do sistema.
--
-- Quem é superadmin vem da variável ADMIN_EMAILS do servidor. Só as rotas /api/admin abrem a
-- transação com set_config('app.superadmin', 'on'); nos pedidos normais ela fica desligada e as
-- regras de antes continuam valendo. O superadmin enxerga cadastro, plano e mensalidade dos
-- negócios, nunca os lançamentos financeiros deles.

create function eh_superadmin() returns boolean
language sql stable as $$ select coalesce(current_setting('app.superadmin', true), '') = 'on' $$;

-- ---------- Planos ----------
create table plano (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  nome text not null check (length(nome) between 1 and 60),
  descricao text not null default '',
  preco bigint not null check (preco >= 0),
  modulos text[] not null default array['financeiro'],
  tem_ia boolean not null default false,
  destaque boolean not null default false,
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

insert into plano (id, nome, descricao, preco, modulos, tem_ia, destaque, ativo, ordem) values
  ('essencial', 'Essencial', 'Tudo para organizar o dinheiro do negócio e o MEI.', 2500,
   array['financeiro', 'mei', 'agenda', 'extrato', 'comprovantes'], false, true, true, 1);

-- ---------- Configurações gerais (uma linha só) ----------
create table config_sistema (
  id boolean primary key default true check (id),
  cadastro_aberto boolean not null default true,
  dias_teste int not null default 7 check (dias_teste between 0 and 365),
  plano_padrao text not null default 'essencial' references plano (id),
  ia_ligada boolean not null default false,
  -- Aviso que aparece no topo do sistema para todos os clientes (vazio = nenhum).
  aviso text not null default '',
  -- Em manutenção os clientes veem os dados, mas não gravam nada.
  manutencao boolean not null default false,
  atualizado_em timestamptz not null default now()
);
insert into config_sistema default values;

-- ---------- Assinatura de cada conta ----------
-- Fica na conta (usuário), não no negócio: refazer a configuração inicial apaga e recria o
-- negócio, e a assinatura não pode voltar para o teste por isso.
create table assinatura (
  usuario_id uuid primary key references usuario (id) on delete cascade,
  plano_id text not null references plano (id),
  situacao text not null default 'teste' check (situacao in ('teste', 'ativa', 'atrasada', 'suspensa', 'cancelada')),
  -- Preço combinado com este cliente (vazio = preço do plano).
  valor bigint check (valor >= 0),
  proximo_vencimento date,
  observacao text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on assinatura (plano_id);

create table pagamento_assinatura (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario (id) on delete cascade,
  valor bigint not null check (valor > 0),
  pago_em date not null,
  -- Mês que a mensalidade cobre (primeiro dia do mês).
  referente date not null,
  forma text not null default 'pix',
  observacao text not null default '',
  criado_em timestamptz not null default now()
);
create index on pagamento_assinatura (usuario_id, pago_em);

-- Toda conta nova nasce em teste no plano padrão. A função roda como dona das tabelas
-- porque o cliente não pode gravar a própria assinatura.
create function criar_assinatura() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cfg config_sistema;
  antes text := coalesce(current_setting('app.superadmin', true), '');
begin
  -- Liga o superadmin só para esta gravação e volta como estava (vale mesmo se o dono das
  -- tabelas não for superusuário do banco).
  perform set_config('app.superadmin', 'on', true);
  select * into cfg from config_sistema where id;
  insert into assinatura (usuario_id, plano_id, situacao, proximo_vencimento)
  values (new.id, coalesce(cfg.plano_padrao, 'essencial'), 'teste', current_date + coalesce(cfg.dias_teste, 7))
  on conflict do nothing;
  perform set_config('app.superadmin', antes, true);
  return new;
end $$;
create trigger usuario_assinatura after insert on usuario for each row execute function criar_assinatura();

-- Contas que já existem entram em teste, com o prazo contado a partir de hoje.
insert into assinatura (usuario_id, plano_id, situacao, proximo_vencimento)
select id, 'essencial', 'teste', current_date + 7 from usuario
on conflict do nothing;

-- ---------- Site de venda ----------
create table site_conteudo (
  chave text primary key check (chave ~ '^[a-z0-9_.-]{1,80}$'),
  valor text not null,
  atualizado_em timestamptz not null default now()
);

create table site_imagem (
  id uuid primary key,
  nome text not null,
  tipo text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'image/svg+xml')),
  tamanho int not null,
  dados bytea not null,
  criado_em timestamptz not null default now()
);

-- ---------- Registro do que o superadmin mudou ----------
create table admin_registro (
  id uuid primary key default gen_random_uuid(),
  quando timestamptz not null default now(),
  admin_email text not null,
  acao text not null,
  detalhe text not null default ''
);
create index on admin_registro (quando desc);

-- ---------- Regras de acesso ----------
-- Planos, configurações e site: todos leem (o site de venda e o app precisam), só o superadmin grava.
do $$
declare t text;
begin
  foreach t in array array['plano', 'config_sistema', 'site_conteudo', 'site_imagem'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy "todos leem" on %I for select using (true)', t);
    execute format('create policy "superadmin grava" on %I for all using (eh_superadmin()) with check (eh_superadmin())', t);
  end loop;
  -- Assinatura e mensalidades: o cliente lê as dele, só o superadmin grava.
  foreach t in array array['assinatura', 'pagamento_assinatura'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy "a minha" on %I for select using (usuario_id = app_usuario())', t);
    execute format('create policy "superadmin" on %I for all using (eh_superadmin()) with check (eh_superadmin())', t);
  end loop;
end $$;

alter table admin_registro enable row level security;
alter table admin_registro force row level security;
create policy "superadmin" on admin_registro for all using (eh_superadmin()) with check (eh_superadmin());

-- O superadmin vê o cadastro dos negócios (nome, CNPJ, cidade) para gerir as assinaturas.
create policy "superadmin ve" on empresa for select using (eh_superadmin());
