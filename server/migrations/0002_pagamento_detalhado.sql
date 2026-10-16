-- Pagamento com detalhes: comprovante (foto ou PDF), observação, parcial e parcelado.

create table comprovante (
  id uuid primary key,
  empresa_id uuid not null references empresa (id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  tamanho int not null check (tamanho > 0 and tamanho <= 5242880),
  dados bytea not null,
  criado_em timestamptz not null default now()
);
create index on comprovante (empresa_id);

alter table comprovante enable row level security;
alter table comprovante force row level security;
create policy "da minha empresa" on comprovante for all using (minha_empresa(empresa_id)) with check (minha_empresa(empresa_id));

alter table lancamento drop column comprovante_url;
alter table lancamento add column comprovante_id uuid references comprovante (id) on delete set null;
alter table lancamento add column observacao text;
-- O que ficou para depois num pagamento parcial ou parcelado aponta a conta de origem.
alter table lancamento add column parcela_de uuid references lancamento (id) on delete set null;
alter table lancamento add column parcela_numero int;
alter table lancamento add column parcela_total int;
alter table lancamento add constraint parcela_valida check (
  (parcela_numero is null and parcela_total is null)
  or (parcela_numero between 1 and parcela_total and parcela_total between 2 and 60)
);
