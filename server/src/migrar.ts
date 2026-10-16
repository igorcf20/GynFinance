// Aplica as migrações de server/migrations em ordem e garante o usuário do banco que o
// servidor usa (gynfinance_app), sem superpoderes, para as regras de acesso valerem.
// Uso: DATABASE_URL=... APP_DB_PASSWORD=... node server/src/migrar.ts
import { readdir, readFile } from 'node:fs/promises'
import pg from 'pg'
import { config } from './config.ts'

const pasta = new URL('../migrations/', import.meta.url)

export async function migrar(urlAdmin: string, senhaApp?: string): Promise<string[]> {
  const c = new pg.Client({ connectionString: urlAdmin })
  await c.connect()
  const aplicadas: string[] = []
  try {
    await c.query('create table if not exists migracao (nome text primary key, aplicada_em timestamptz not null default now())')
    const feitas = new Set((await c.query<{ nome: string }>('select nome from migracao')).rows.map((r) => r.nome))
    const arquivos = (await readdir(pasta)).filter((f) => f.endsWith('.sql')).sort()
    for (const nome of arquivos) {
      if (feitas.has(nome)) continue
      const sql = await readFile(new URL(nome, pasta), 'utf8')
      await c.query('begin')
      try {
        await c.query(sql)
        await c.query('insert into migracao (nome) values ($1)', [nome])
        await c.query('commit')
        aplicadas.push(nome)
      } catch (e) {
        await c.query('rollback')
        throw new Error(`Migração ${nome} falhou: ${(e as Error).message}`)
      }
    }
    if (senhaApp) {
      const existe = (await c.query("select 1 from pg_roles where rolname = 'gynfinance_app'")).rowCount
      const senha = c.escapeLiteral(senhaApp)
      await c.query(existe ? `alter role gynfinance_app with login password ${senha}` : `create role gynfinance_app with login password ${senha} nosuperuser nobypassrls`)
      await c.query('grant usage on schema public to gynfinance_app')
      await c.query('grant select, insert, update, delete on all tables in schema public to gynfinance_app')
      await c.query('grant execute on all functions in schema public to gynfinance_app')
    }
  } finally {
    await c.end()
  }
  return aplicadas
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const feitas = await migrar(config.bancoAdmin(), process.env.APP_DB_PASSWORD)
  console.log(feitas.length ? `Migrações aplicadas: ${feitas.join(', ')}` : 'Banco já está em dia.')
}
