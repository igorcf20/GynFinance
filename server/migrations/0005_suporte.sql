-- Suporte: chamados (tickets) que o cliente abre de dentro do sistema e a equipe responde pelo
-- painel de superadmin, com fotos, os dados do perfil, a página onde a pessoa estava e os erros
-- recentes do app. Também guarda os erros que o app e o servidor registram sozinhos.

create table ticket (
  id uuid primary key,
  -- Número curto para falar com o cliente ("chamado #128").
  numero bigint generated always as identity unique,
  usuario_id uuid not null references usuario (id) on delete cascade,
  empresa_id uuid references empresa (id) on delete set null,
  assunto text not null check (length(assunto) between 3 and 120),
  categoria text not null check (categoria in ('duvida', 'problema', 'financeiro', 'sugestao', 'outro')),
  situacao text not null default 'aberto' check (situacao in ('aberto', 'em_andamento', 'aguardando_cliente', 'resolvido')),
  prioridade text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta', 'urgente')),
  -- Tela onde a pessoa estava ao abrir (rota e nome).
  pagina text not null default '',
  pagina_nome text not null default '',
  -- Telefone para retorno, se a pessoa quiser.
  contato text,
  -- Cópia do perfil no momento da abertura: nome, e-mail, negócio, CNPJ, plano.
  perfil jsonb not null default '{}',
  -- Navegador, tamanho da tela, versão do app.
  contexto jsonb not null default '{}',
  -- Erros recentes do app que a pessoa aceitou mandar junto.
  erros jsonb not null default '[]',
  nao_lido_cliente boolean not null default false,
  nao_lido_suporte boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on ticket (usuario_id, atualizado_em desc);
create index on ticket (situacao, atualizado_em desc);

create table ticket_mensagem (
  id uuid primary key,
  ticket_id uuid not null references ticket (id) on delete cascade,
  autor text not null check (autor in ('cliente', 'suporte')),
  autor_nome text not null default '',
  texto text not null check (length(texto) between 1 and 5000),
  -- Nota interna da equipe: o cliente nunca vê.
  interna boolean not null default false,
  criado_em timestamptz not null default now(),
  check (not interna or autor = 'suporte')
);
create index on ticket_mensagem (ticket_id, criado_em);

create table ticket_anexo (
  id uuid primary key,
  ticket_id uuid not null references ticket (id) on delete cascade,
  mensagem_id uuid not null references ticket_mensagem (id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp')),
  tamanho int not null check (tamanho > 0 and tamanho <= 5242880),
  dados bytea not null,
  criado_em timestamptz not null default now()
);
create index on ticket_anexo (mensagem_id);
create index on ticket_anexo (ticket_id);

-- Erros que o app (tela que quebrou, falha de script) e o servidor (erro 500) registram sozinhos.
-- "chave" agrupa ocorrências do mesmo erro na mesma tela.
create table erro_app (
  id uuid primary key default gen_random_uuid(),
  chave text not null,
  origem text not null check (origem in ('tela', 'script', 'promessa', 'servidor', 'conexao')),
  mensagem text not null,
  pilha text not null default '',
  pagina text not null default '',
  usuario_id uuid references usuario (id) on delete set null,
  contexto jsonb not null default '{}',
  resolvido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index on erro_app (chave, criado_em desc);
create index on erro_app (criado_em desc);

-- ---------- Regras de acesso ----------
create function meu_ticket(t uuid) returns boolean
language sql stable as $$ select exists (select 1 from ticket where id = t and usuario_id = app_usuario()) $$;

alter table ticket enable row level security;
alter table ticket force row level security;
create policy "os meus" on ticket for all using (usuario_id = app_usuario()) with check (usuario_id = app_usuario());
create policy "superadmin" on ticket for all using (eh_superadmin()) with check (eh_superadmin());

-- O cliente lê e escreve as mensagens dos chamados dele, nunca as notas internas.
alter table ticket_mensagem enable row level security;
alter table ticket_mensagem force row level security;
create policy "do meu chamado" on ticket_mensagem for select using (meu_ticket(ticket_id) and not interna);
create policy "eu escrevo" on ticket_mensagem for insert with check (meu_ticket(ticket_id) and autor = 'cliente' and not interna);
create policy "superadmin" on ticket_mensagem for all using (eh_superadmin()) with check (eh_superadmin());

alter table ticket_anexo enable row level security;
alter table ticket_anexo force row level security;
create policy "do meu chamado" on ticket_anexo for select
  using (meu_ticket(ticket_id) and exists (select 1 from ticket_mensagem m where m.id = mensagem_id and not m.interna));
create policy "eu envio" on ticket_anexo for insert
  with check (meu_ticket(ticket_id) and exists (select 1 from ticket_mensagem m where m.id = mensagem_id and m.autor = 'cliente'));
create policy "superadmin" on ticket_anexo for all using (eh_superadmin()) with check (eh_superadmin());

-- Qualquer um registra um erro (com o próprio usuário ou sem login); só o superadmin lê.
alter table erro_app enable row level security;
alter table erro_app force row level security;
create policy "registra" on erro_app for insert with check (usuario_id is null or usuario_id = app_usuario());
create policy "superadmin" on erro_app for all using (eh_superadmin()) with check (eh_superadmin());
