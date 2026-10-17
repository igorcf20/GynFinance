-- Agenda de atendimentos e importação de extrato.

create table atendimento (
  id uuid primary key,
  empresa_id uuid not null references empresa (id) on delete cascade,
  cliente text not null check (length(cliente) between 1 and 120),
  telefone text,
  servico text,
  data date not null,
  inicio time not null,
  duracao_min int not null check (duracao_min between 5 and 1440),
  valor bigint check (valor > 0),
  situacao text not null check (situacao in ('agendado', 'confirmado', 'concluido', 'faltou', 'cancelado')),
  observacao text,
  -- Conta a receber criada junto com o atendimento.
  lancamento_id uuid references lancamento (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on atendimento (empresa_id, data);

alter table atendimento enable row level security;
alter table atendimento force row level security;
create policy "da minha empresa" on atendimento for all using (minha_empresa(empresa_id)) with check (minha_empresa(empresa_id));

-- Código da transação no banco, para o mesmo extrato não entrar duas vezes.
alter table lancamento add column ref_extrato text;
create index on lancamento (empresa_id, ref_extrato) where ref_extrato is not null;

-- Para o extrato: tarifas do banco e uma categoria para o que não se encaixa em nenhuma outra.
insert into categoria (id, nome, grupo, conta_no_faturamento) values
  ('tarifas', 'Tarifas do banco', 'despesa_variavel', false),
  ('outras-saidas', 'Outras saídas', 'despesa_variavel', false)
on conflict (id) do nothing;
