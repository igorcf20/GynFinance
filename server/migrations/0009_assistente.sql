-- Assistente: o cliente digita, dita, tira foto ou escolhe uma foto do celular e o assistente
-- prepara os lançamentos para ele confirmar. A leitura é feita por um serviço de inteligência
-- artificial (Claude, da Anthropic).
--
-- Fotos e textos NÃO ficam guardados aqui: vão para a leitura e somem. Só uma foto que o cliente
-- confirmar como comprovante é gravada (tabela comprovante, como sempre). Aqui fica só a conta
-- de quantos pedidos cada um fez e quanto custaram, para o limite diário e o painel.

-- Chave e escolhas do serviço de IA: só o superadmin lê e grava (config_sistema todos leem,
-- por isso a chave não pode ficar lá).
create table ia_config (
  id boolean primary key default true check (id),
  chave text not null default '',
  modelo text not null default 'claude-opus-5-5' check (modelo ~ '^[a-z0-9.-]{3,60}$'),
  -- Pedidos por cliente por dia (0 = sem limite).
  limite_dia int not null default 40 check (limite_dia between 0 and 1000),
  atualizado_em timestamptz not null default now()
);
insert into ia_config default values;

create table ia_uso (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario (id) on delete cascade,
  quando timestamptz not null default now(),
  fotos int not null default 0,
  tokens_entrada int not null default 0,
  tokens_saida int not null default 0,
  -- Custo estimado em milionésimos de dólar.
  custo_micro bigint not null default 0,
  ok boolean not null default true
);
create index on ia_uso (usuario_id, quando);
create index on ia_uso (quando);

alter table ia_config enable row level security;
alter table ia_config force row level security;
create policy "superadmin" on ia_config for all using (eh_superadmin()) with check (eh_superadmin());

alter table ia_uso enable row level security;
alter table ia_uso force row level security;
create policy "o meu" on ia_uso for select using (usuario_id = app_usuario());
create policy "gravo o meu" on ia_uso for insert with check (usuario_id = app_usuario());
create policy "superadmin" on ia_uso for all using (eh_superadmin()) with check (eh_superadmin());
