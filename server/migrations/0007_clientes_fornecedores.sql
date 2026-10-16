-- Clientes e fornecedores (módulo "clientes", plano Plus): a ficha de cada um. Lançamentos,
-- contas fixas e atendimentos apontam para a ficha; o nome continua em contraparte/cliente.

create table parceiro (
  id uuid primary key,
  empresa_id uuid not null references empresa (id) on delete cascade,
  tipo text not null check (tipo in ('cliente', 'fornecedor', 'ambos')),
  nome text not null check (length(nome) between 1 and 120),
  documento text,
  telefone text,
  email text,
  endereco text,
  observacao text,
  ativo boolean not null default true,
  criado_em date not null default current_date,
  atualizado_em timestamptz not null default now()
);
create index on parceiro (empresa_id);

alter table parceiro enable row level security;
alter table parceiro force row level security;
create policy "da minha empresa" on parceiro for all using (minha_empresa(empresa_id)) with check (minha_empresa(empresa_id));

-- Apagar a ficha não apaga o histórico: só solta o vínculo.
alter table lancamento add column parceiro_id uuid references parceiro (id) on delete set null;
alter table recorrencia add column parceiro_id uuid references parceiro (id) on delete set null;
alter table atendimento add column parceiro_id uuid references parceiro (id) on delete set null;
create index on lancamento (parceiro_id) where parceiro_id is not null;

-- Plano Plus: o Essencial mais Clientes e fornecedores. Nasce desligado (fora do site) até o
-- preço ser confirmado em Superadmin > Planos; já dá para colocar assinantes nele.
insert into plano (id, nome, descricao, preco, modulos, tem_ia, destaque, ativo, ordem) values
  ('plus', 'Plus', 'O Essencial com clientes e fornecedores: ficha de cada um e quanto você ganha e gasta com eles.', 3900,
   array['financeiro', 'mei', 'agenda', 'extrato', 'comprovantes', 'clientes'], false, false, false, 2)
on conflict (id) do nothing;
