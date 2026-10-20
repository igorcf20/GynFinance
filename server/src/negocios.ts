// Vários negócios na mesma conta, acesso do contador (só leitura), convites, indicação e os
// aparelhos que recebem avisos no celular.
import { createHash, randomBytes } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { config } from './config.ts'
import { empresaDaSessao, ehSoLeitura } from './dados.ts'
import type { Cliente } from './db.ts'
import { chavePublicaAvisos } from './avisos.ts'

type Guarda = (req: FastifyRequest, rep: FastifyReply) => Promise<unknown>

export const SO_LEITURA = 'Você está vendo este negócio como contador: dá para consultar e exportar, mas não para mudar nada.'

/** O link leva o código; o banco guarda só o hash (como a sessão). */
export const codigoDeConvite = (codigo: string) => createHash('sha256').update(codigo.trim()).digest('hex')

/** Negócios próprios da pessoa e quantos o plano dela permite. Dentro de comUsuario. */
export async function limiteDeNegocios(c: Cliente): Promise<{ meus: number; limite: number }> {
  const meus = (await c.query<{ n: number }>('select count(*)::int as n from empresa where usuario_id = app_usuario()')).rows[0].n
  const p = (await c.query<{ negocios: number }>('select p.negocios from assinatura a join plano p on p.id = a.plano_id where a.usuario_id = app_usuario()')).rows[0]
  return { meus, limite: p?.negocios ?? 1 }
}

/** O que /api/conta acrescenta: negócios, o aberto, o limite do plano e a indicação. Dentro de comUsuario. */
export async function dadosDaConta(c: Cliente, pool: pg.Pool, usuarioId: string) {
  const aberto = await empresaDaSessao(c)
  const lista = (
    await c.query<{ id: string; nome: string; dono: boolean }>(
      'select id, nome_fantasia as nome, usuario_id = app_usuario() as dono from empresa order by usuario_id = app_usuario() desc, criado_em',
    )
  ).rows.map((r) => ({ id: r.id, nome: r.nome, papel: (r.dono ? 'dono' : 'contador') as 'dono' | 'contador' }))
  const negocio = lista.find((n) => n.id === aberto)
  const plano =
    negocio?.papel === 'contador'
      ? (await c.query<{ plano_nome: string; modulos: string[] }>('select * from plano_do_negocio($1)', [negocio.id])).rows[0]
      : undefined
  const { limite } = await limiteDeNegocios(c)
  const codigo = (await pool.query<{ codigo_indicacao: string }>('select codigo_indicacao from usuario where id = $1', [usuarioId])).rows[0]?.codigo_indicacao
  const ind = (await c.query<{ cadastros: number; assinantes: number }>('select * from minhas_indicacoes()')).rows[0]
  return {
    negocio,
    negocios: lista,
    limiteNegocios: limite,
    indicacao: codigo ? { codigo, cadastros: ind?.cadastros ?? 0, assinantes: ind?.assinantes ?? 0 } : undefined,
    planoDoNegocio: plano ? { nome: plano.plano_nome, modulos: plano.modulos } : undefined,
  }
}

interface Opcoes {
  exigirLogin: Guarda
  doUsuario: <T>(req: FastifyRequest, fn: (c: Cliente) => Promise<T>) => Promise<T>
  abrirNegocio: (req: FastifyRequest, empresaId: string) => Promise<unknown>
}

const esquemaInscricao = z.object({
  endpoint: z.url().max(1000).refine((u) => u.startsWith('https://'), 'Endereço inválido.'),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
})

export async function rotasNegocios(app: FastifyInstance, pool: pg.Pool, { exigirLogin, doUsuario, abrirNegocio }: Opcoes) {
  const logado = { preHandler: exigirLogin }

  // ---------- Trocar de negócio ----------
  app.post('/api/negocios/abrir', logado, async (req, rep) => {
    const { empresaId } = z.object({ empresaId: z.uuid() }).parse(req.body)
    // As regras do banco só mostram os negócios da pessoa e os de quem a fez contadora.
    const ve = await doUsuario(req, async (c) => !!(await c.query('select 1 from empresa where id = $1', [empresaId])).rowCount)
    if (!ve) return rep.code(404).send({ erro: 'Negócio não encontrado.' })
    await abrirNegocio(req, empresaId)
    return { ok: true }
  })

  // ---------- Contador ----------
  /** Negócio aberto, só se for da pessoa (convidar e tirar contador é coisa do dono). */
  const meuAberto = async (c: Cliente) => {
    const id = await empresaDaSessao(c)
    return id && !(await ehSoLeitura(c, id)) ? id : null
  }

  app.get('/api/contador', logado, async (req) =>
    doUsuario(req, async (c) => {
      const id = await meuAberto(c)
      if (!id) return { contadores: [] }
      const r = await c.query<{ usuario_id: string; nome: string; email: string; desde: Date }>('select * from contadores_do_negocio($1)', [id])
      return { contadores: r.rows.map((x) => ({ id: x.usuario_id, nome: x.nome, email: x.email, desde: x.desde.toISOString().slice(0, 10) })) }
    }),
  )

  app.post('/api/contador/convite', logado, async (req, rep) => {
    const codigo = randomBytes(18).toString('base64url')
    const ok = await doUsuario(req, async (c) => {
      const id = await meuAberto(c)
      if (!id) return false
      // Um convite vale por 7 dias e para uma pessoa só.
      await c.query("insert into convite_contador (codigo_hash, empresa_id, expira_em) values ($1, $2, now() + interval '7 days')", [codigoDeConvite(codigo), id])
      return true
    })
    if (!ok) return rep.code(403).send({ erro: 'Só o dono do negócio convida o contador.' })
    return { link: `${config.urlSistema()}/app/#/convite?codigo=${codigo}`, validoAte: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) }
  })

  app.delete('/api/contador/:usuarioId', logado, async (req, rep) => {
    const { usuarioId } = z.object({ usuarioId: z.uuid() }).parse(req.params)
    const n = await doUsuario(req, async (c) => {
      const id = await meuAberto(c)
      return id ? (await c.query('delete from empresa_membro where empresa_id = $1 and usuario_id = $2', [id, usuarioId])).rowCount : 0
    })
    if (!n) return rep.code(404).send({ erro: 'Esse acesso já tinha sido tirado.' })
    return { ok: true }
  })

  // O contador deixa de ver um negócio.
  app.post('/api/contador/sair', logado, async (req) => {
    const { empresaId } = z.object({ empresaId: z.uuid() }).parse(req.body)
    await doUsuario(req, (c) => c.query('delete from empresa_membro where empresa_id = $1 and usuario_id = app_usuario()', [empresaId]))
    return { ok: true }
  })

  // Sem login: mostra de quem é o convite antes de a pessoa entrar ou criar a conta.
  app.get('/api/convite/:codigo', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, rep) => {
    const { codigo } = z.object({ codigo: z.string().min(10).max(200) }).parse(req.params)
    const negocio = (await pool.query<{ n: string | null }>('select convite_negocio($1) as n', [codigoDeConvite(codigo)])).rows[0]?.n
    if (!negocio) return rep.code(404).send({ erro: 'Este convite já foi usado ou venceu. Peça um novo ao seu cliente.' })
    return { negocio }
  })

  app.post('/api/convite/aceitar', logado, async (req, rep) => {
    const { codigo } = z.object({ codigo: z.string().min(10).max(200) }).parse(req.body)
    const empresaId = await doUsuario(req, async (c) => (await c.query<{ e: string | null }>('select aceitar_convite($1) as e', [codigoDeConvite(codigo)])).rows[0]?.e)
    if (!empresaId) return rep.code(404).send({ erro: 'Este convite já foi usado ou venceu. Peça um novo ao seu cliente.' })
    await abrirNegocio(req, empresaId)
    return { ok: true }
  })

  // ---------- Avisos no celular ----------
  app.get('/api/avisos/chave', async () => ({ chave: await chavePublicaAvisos(pool) }))

  app.post('/api/avisos/inscrever', logado, async (req) => {
    const d = esquemaInscricao.parse(req.body)
    await doUsuario(req, async (c) => {
      // O mesmo navegador pode ter sido de outra conta: o aparelho passa para quem está logado agora.
      await c.query('select esquecer_aparelho($1)', [d.endpoint])
      await c.query(
        `insert into push_inscricao (endpoint, usuario_id, p256dh, auth) values ($1, app_usuario(), $2, $3)
         on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth where push_inscricao.usuario_id = app_usuario()`,
        [d.endpoint, d.keys.p256dh, d.keys.auth],
      )
    })
    return { ok: true }
  })

  app.post('/api/avisos/cancelar', logado, async (req) => {
    const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(req.body)
    await doUsuario(req, (c) => c.query('delete from push_inscricao where endpoint = $1', [endpoint]))
    return { ok: true }
  })
}
