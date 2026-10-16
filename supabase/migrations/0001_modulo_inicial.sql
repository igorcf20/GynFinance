-- Gynfinance: banco do módulo inicial (Postgres / Supabase).
-- Segue o "Modelo de dados" do planejamento e os tipos de src/domain/types.ts.
-- Dinheiro em centavos inteiros (bigint). Toda tabela de negócio tem empresa_id, e o acesso
-- é limitado pelas regras de segurança (RLS) no fim do arquivo: cada pessoa só lê e grava
-- os dados das empresas de que é dona, mesmo que o navegador mande outro id.

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type atividade as enum ('servico', 'comercio', 'industria', 'misto');
create type tipo_conta as enum ('caixa', 'banco', 'reserva');
create type grupo_categoria as enum ('receita', 'custo', 'despesa_fixa', 'despesa_variavel', 'imposto', 'retirada');
create type natureza as enum ('entrada', 'saida', 'retirada', 'aporte', 'transferencia');
create type situacao as enum ('realizado', 'previsto', 'cancelado');
create type forma_pagamento as enum ('pix', 'dinheiro', 'debito', 'credito', 'boleto', 'outro');
create type nota_emitida as enum ('sim', 'nao', 'nao_se_aplica');
create type se_fim_de_semana as enum ('manter', 'antecipar', 'adiar');
create type tipo_lembrete as enum ('conta', 'das', 'limite_mei', 'dasn', 'fechamento');
create type canal_lembrete as enum ('app', 'email', 'whatsapp');
create type status_lembrete as enum ('pendente', 'enviado', 'lido', 'dispensado');

-- ---------- Usuário (o login fica em auth.users do Supabase) ----------
create table usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  telefone_whatsapp text,
  aceite_termos_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table empresa (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario (id) on delete cascade,
  nome_dono text not null,
  nome_fantasia text not null,
  cnpj text,
  eh_mei boolean not null,
  data_abertura date not null,
  atividade atividade not null,
  uf char(2) not null,
  municipio text,
  prolabore_desejado bigint check (prolabore_desejado >= 0),
  -- Vendas do ano feitas antes de usar o Gynfinance (configuração inicial).
  faturado_antes_ano int,
  faturado_antes_valor bigint check (faturado_antes_valor >= 0),
  modulos_ativos text[] not null default array['financeiro'],
  -- Preferências de aviso (Configurações, Notificações).
  lembrete_dias smallint not null default 1 check (lembrete_dias in (0, 1, 3)),
  lembrete_email boolean not null default true,
  resumo_mensal boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on empresa (usuario_id);

create table conta_financeira (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id) on delete cascade,
  nome text not null,
  tipo tipo_conta not null,
  saldo_inicial bigint not null default 0,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on conta_financeira (empresa_id);

-- empresa_id vazio = categoria padrão do sistema (lida por todos, gravada por ninguém).
create table categoria (
  id text primary key,
  empresa_id uuid references empresa (id) on delete cascade,
  nome text not null,
  grupo grupo_categoria not null,
  conta_no_faturamento boolean not null default false,
  icone text,
  ativa boolean not null default true
);
create index on categoria (empresa_id);

-- Categorias que a empresa desligou na configuração inicial (ex.: serviço não vê mercadoria).
create table categoria_desativada (
  empresa_id uuid not null references empresa (id) on delete cascade,
  categoria_id text not null references categoria (id) on delete cascade,
  primary key (empresa_id, categoria_id)
);

create table recorrencia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id) on delete cascade,
  natureza natureza not null,
  valor bigint not null check (valor > 0),
  categoria_id text references categoria (id),
  conta_financeira_id uuid not null references conta_financeira (id),
  forma_pagamento forma_pagamento not null,
  descricao text,
  contraparte text,
  frequencia text not null default 'mensal' check (frequencia = 'mensal'),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  inicio date not null,
  fim date,
  se_fim_de_semana se_fim_de_semana not null default 'manter',
  valor_varia boolean not null default false,
  ativa boolean not null default true,
  ultima_geracao date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on recorrencia (empresa_id);

-- O centro do modelo: uma conta a pagar é só um lançamento com situação "previsto".
create table lancamento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id) on delete cascade,
  natureza natureza not null,
  valor bigint not null check (valor > 0),
  categoria_id text references categoria (id),
  conta_financeira_id uuid not null references conta_financeira (id),
  conta_destino_id uuid references conta_financeira (id),
  situacao situacao not null,
  data_competencia date not null,
  data_vencimento date,
  data_pagamento date,
  forma_pagamento forma_pagamento not null,
  descricao text,
  contraparte text,
  nota_emitida nota_emitida not null default 'nao_se_aplica',
  nota_numero text,
  comprovante_url text,
  recorrencia_id uuid references recorrencia (id) on delete set null,
  pago_com_dinheiro_pessoal boolean not null default false,
  -- Liga a despesa ao aporte espelho criado por "paguei com dinheiro pessoal".
  espelho_de uuid references lancamento (id) on delete cascade,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (natureza not in ('entrada', 'saida') or categoria_id is not null),
  check (natureza <> 'transferencia' or conta_destino_id is not null),
  check (situacao <> 'previsto' or data_vencimento is not null),
  check (situacao <> 'realizado' or data_pagamento is not null)
);
create index on lancamento (empresa_id, data_pagamento);
create index on lancamento (empresa_id, situacao, data_vencimento);
-- O gerador de contas fixas cria no máximo um previsto por regra e mês.
create unique index lancamento_um_por_mes on lancamento (recorrencia_id, date_trunc('month', data_competencia::timestamp)) where recorrencia_id is not null;

-- Tabela do sistema, por ano: muda por lei e salário mínimo.
create table parametro_mei (
  ano int primary key,
  limite_anual bigint not null,
  limite_mensal_proporcional bigint not null,
  salario_minimo bigint not null,
  das_comercio bigint not null,
  das_industria bigint not null,
  das_servico bigint not null,
  das_misto bigint not null,
  das_dia_vencimento smallint not null default 20
);

create table pagamento_das (
  empresa_id uuid not null references empresa (id) on delete cascade,
  competencia date not null, -- primeiro dia do mês
  valor bigint not null,
  vencimento date not null,
  lancamento_id uuid references lancamento (id) on delete set null,
  pago_fora_do_sistema boolean not null default false,
  primary key (empresa_id, competencia)
);

create table lembrete (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id) on delete cascade,
  tipo tipo_lembrete not null,
  lancamento_id uuid references lancamento (id) on delete cascade,
  disparar_em timestamptz not null,
  canal canal_lembrete not null default 'app',
  status status_lembrete not null default 'pendente',
  criado_em timestamptz not null default now()
);
create index on lembrete (status, disparar_em);

-- Avisos do painel que a pessoa dispensou (o id já traz o mês ou a conta).
create table aviso_dispensado (
  empresa_id uuid not null references empresa (id) on delete cascade,
  aviso_id text not null,
  dispensado_em timestamptz not null default now(),
  primary key (empresa_id, aviso_id)
);

-- ---------- Segurança: cada pessoa só enxerga as próprias empresas ----------
create function minha_empresa(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from empresa where id = e and usuario_id = auth.uid())
$$;

alter table usuario enable row level security;
create policy "dono" on usuario for all using (id = auth.uid()) with check (id = auth.uid());

alter table empresa enable row level security;
create policy "dono" on empresa for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['conta_financeira', 'categoria_desativada', 'recorrencia', 'lancamento', 'pagamento_das', 'lembrete', 'aviso_dispensado'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "da minha empresa" on %I for all using (minha_empresa(empresa_id)) with check (minha_empresa(empresa_id))', t);
  end loop;
end $$;

alter table categoria enable row level security;
create policy "padrao ou minha" on categoria for select using (empresa_id is null or minha_empresa(empresa_id));
create policy "so as minhas" on categoria for all using (empresa_id is not null and minha_empresa(empresa_id)) with check (empresa_id is not null and minha_empresa(empresa_id));

alter table parametro_mei enable row level security;
create policy "leitura" on parametro_mei for select using (true);

-- ---------- Dados do sistema ----------
-- Valores de 2026 a confirmar com o Igor (iguais a src/domain/parametros.ts).
insert into parametro_mei values (2026, 8100000, 675000, 162100, 8205, 8205, 8605, 8705, 20);

insert into categoria (id, nome, grupo, conta_no_faturamento) values
  ('vendas', 'Vendas', 'receita', true),
  ('servicos', 'Serviços prestados', 'receita', true),
  ('outras-entradas', 'Outras entradas', 'receita', false),
  ('mercadoria', 'Mercadoria e matéria-prima', 'custo', false),
  ('aluguel', 'Aluguel', 'despesa_fixa', false),
  ('internet', 'Internet e telefone', 'despesa_fixa', false),
  ('luz', 'Luz e água', 'despesa_fixa', false),
  ('contador', 'Contador', 'despesa_fixa', false),
  ('sistema', 'Sistema e apps', 'despesa_fixa', false),
  ('transporte', 'Transporte', 'despesa_variavel', false),
  ('embalagem', 'Embalagem', 'despesa_variavel', false),
  ('maquininha', 'Taxa de maquininha', 'despesa_variavel', false),
  ('marketing', 'Marketing', 'despesa_variavel', false),
  ('manutencao', 'Manutenção', 'despesa_variavel', false),
  ('das', 'DAS e impostos', 'imposto', false),
  ('prolabore', 'Pró-labore', 'retirada', false);
