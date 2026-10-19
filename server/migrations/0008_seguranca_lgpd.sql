-- Segurança e base legal: termos de uso e política de privacidade com versões, registro de quem
-- aceitou qual versão, registro de acessos (Marco Civil da Internet, art. 15: 6 meses), contas
-- excluídas a pedido do titular (LGPD, art. 18) e pedido de cancelamento da assinatura.

-- ---------- Termos de uso e política de privacidade ----------
-- Cada publicação é uma versão nova; as antigas ficam guardadas para provar o que cada pessoa
-- aceitou. O texto inicial vem de server/legal/*.md (o migrador grava se ainda não houver versão).
create table documento_legal (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('termos', 'privacidade')),
  versao text not null,
  texto text not null check (length(texto) between 100 and 200000),
  publicado_em timestamptz not null default now(),
  publicado_por text not null default '',
  unique (tipo, versao)
);

create table aceite_documento (
  usuario_id uuid not null references usuario (id) on delete cascade,
  documento_id bigint not null references documento_legal (id),
  aceito_em timestamptz not null default now(),
  ip text,
  primary key (usuario_id, documento_id)
);

alter table documento_legal enable row level security;
alter table documento_legal force row level security;
create policy "todos leem" on documento_legal for select using (true);
create policy "superadmin grava" on documento_legal for all using (eh_superadmin()) with check (eh_superadmin());

alter table aceite_documento enable row level security;
alter table aceite_documento force row level security;
create policy "os meus" on aceite_documento for all using (usuario_id = app_usuario()) with check (usuario_id = app_usuario());
create policy "superadmin" on aceite_documento for all using (eh_superadmin()) with check (eh_superadmin());

-- ---------- Registro de acessos (Marco Civil, art. 15) ----------
-- Entradas, cadastros, trocas de senha e saídas, com IP e hora. Sem chave para usuario de
-- propósito: a lei manda guardar por 6 meses mesmo se a conta for excluída. Depois disso o
-- servidor apaga sozinho.
create table registro_acesso (
  id bigint generated always as identity primary key,
  usuario_id uuid,
  evento text not null,
  ip text,
  porta int,
  navegador text,
  em timestamptz not null default now()
);
create index on registro_acesso (usuario_id, em desc);
create index on registro_acesso (em);

alter table registro_acesso enable row level security;
alter table registro_acesso force row level security;
-- O servidor grava sem estar dentro da conta de ninguém (antes do login, por exemplo).
create policy "registra" on registro_acesso for insert with check (true);
create policy "os meus" on registro_acesso for select using (usuario_id = app_usuario());
create policy "superadmin" on registro_acesso for all using (eh_superadmin()) with check (eh_superadmin());

-- ---------- Contas excluídas a pedido do titular ----------
-- Fica só o mínimo que a lei obriga a guardar (mensalidades pagas, para a contabilidade da
-- empresa, por 5 anos). Nenhum dado do negócio do cliente fica aqui.
create table conta_excluida (
  id bigint generated always as identity primary key,
  usuario_id uuid not null,
  nome text not null,
  email text not null,
  criada_em timestamptz,
  excluida_em timestamptz not null default now(),
  pagamentos jsonb not null default '[]'
);
alter table conta_excluida enable row level security;
alter table conta_excluida force row level security;
create policy "superadmin" on conta_excluida for all using (eh_superadmin()) with check (eh_superadmin());

-- ---------- Pedido de cancelamento ----------
alter table assinatura add column cancelamento_pedido_em timestamptz;
