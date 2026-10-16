import pg from 'pg'

// Datas como texto AAAA-MM-DD (igual ao app) e bigint (centavos) como número.
pg.types.setTypeParser(1082, (v) => v)
pg.types.setTypeParser(20, (v) => Number(v))

export type Cliente = pg.PoolClient

export function criarPool(url: string): pg.Pool {
  const pool = new pg.Pool({ connectionString: url, max: 10 })
  // Banco reiniciou com conexões paradas: só registra. Sem isso, o servidor inteiro cai.
  pool.on('error', (e) => console.error('Conexão com o banco perdida:', e.message))
  return pool
}

/**
 * Roda fn numa transação marcada com a pessoa logada: as regras de acesso do banco (RLS)
 * só deixam ver e gravar as empresas dela.
 */
export async function comUsuario<T>(pool: pg.Pool, usuarioId: string, fn: (c: Cliente) => Promise<T>): Promise<T> {
  const c = await pool.connect()
  try {
    await c.query('begin')
    await c.query("select set_config('app.usuario_id', $1, true)", [usuarioId])
    const r = await fn(c)
    await c.query('commit')
    return r
  } catch (e) {
    await c.query('rollback').catch(() => {})
    throw e
  } finally {
    c.release()
  }
}

/**
 * Transação do painel de superadmin: liga app.superadmin só aqui dentro. Nunca usar nos pedidos
 * normais, porque as consultas do cliente contam com as regras de acesso para ver só o que é dele.
 */
export async function comAdmin<T>(pool: pg.Pool, fn: (c: Cliente) => Promise<T>): Promise<T> {
  const c = await pool.connect()
  try {
    await c.query('begin')
    await c.query("select set_config('app.superadmin', 'on', true)")
    const r = await fn(c)
    await c.query('commit')
    return r
  } catch (e) {
    await c.query('rollback').catch(() => {})
    throw e
  } finally {
    c.release()
  }
}
