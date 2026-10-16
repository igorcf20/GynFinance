// Servidor do Gynfinance: login, dados do negócio e o próprio site (pasta dist).
import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import bcrypt from 'bcryptjs'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { config } from './config.ts'
import { aplicarMudancas, criarNegocio, empresaDaSessao, ErroDeDados, gravarComprovante, lerComprovante, lerDados } from './dados.ts'
import { comUsuario } from './db.ts'
import * as esquema from './esquemas.ts'

const COOKIE = 'gyn_sessao'
const hash = (token: string) => createHash('sha256').update(token).digest('hex')
// Hash pronto para comparar quando o e-mail não existe: a resposta leva o mesmo tempo.
const HASH_FALSO = bcrypt.hashSync('senha-que-ninguem-usa', 12)

declare module 'fastify' {
  interface FastifyRequest {
    usuarioId?: string
  }
}

export async function criarApp(pool: pg.Pool, opcoes: { site?: boolean; logger?: boolean } = {}) {
  // O sistema abre em /app/ e chama api/... relativo: /app/api/x vira /api/x.
  const app = Fastify({
    logger: opcoes.logger ?? false,
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: true,
    rewriteUrl: (req) => (req.url?.startsWith('/app/api/') ? req.url.slice(4) : (req.url ?? '/')),
  })
  await app.register(cookie)
  await app.register(rateLimit, { global: false })

  // Pedido que muda dados precisa vir do próprio site (proteção contra outro site postando em nome da pessoa).
  app.addHook('onRequest', async (req, rep) => {
    if (req.method === 'GET' || req.method === 'HEAD' || !req.url.startsWith('/api/')) return
    const origem = req.headers.origin
    if (origem && new URL(origem).host !== req.headers.host) return rep.code(403).send({ erro: 'Origem não permitida.' })
  })

  function abrirSessao(rep: FastifyReply, usuarioId: string) {
    const token = randomBytes(32).toString('base64url')
    const expira = new Date(Date.now() + config.diasSessao * 864e5)
    rep.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.cookieSeguro, expires: expira })
    return pool.query('insert into sessao (token_hash, usuario_id, expira_em) values ($1, $2, $3)', [hash(token), usuarioId, expira])
  }

  async function exigirLogin(req: FastifyRequest, rep: FastifyReply) {
    const token = req.cookies[COOKIE]
    if (token) {
      const r = await pool.query<{ usuario_id: string }>('select usuario_id from sessao where token_hash = $1 and expira_em > now()', [hash(token)])
      if (r.rows[0]) {
        req.usuarioId = r.rows[0].usuario_id
        return
      }
    }
    return rep.code(401).send({ erro: 'Entre na sua conta para continuar.' })
  }

  // Erros de validação viram 400 com uma frase simples; o resto é 500 sem detalhes.
  app.setErrorHandler((erro, req, rep) => {
    if (erro instanceof z.ZodError) return rep.code(400).send({ erro: erro.issues[0]?.message ?? 'Dados inválidos.' })
    if (erro instanceof ErroDeDados) return rep.code(400).send({ erro: erro.message })
    const codigo = (erro as { code?: string }).code
    if (codigo === '23503' || codigo === '23514' || codigo === '22P02' || codigo === '23505') return rep.code(400).send({ erro: 'Dados inválidos.' })
    if (codigo === '42501') return rep.code(403).send({ erro: 'Sem permissão para esses dados.' })
    if ((erro as { statusCode?: number }).statusCode === 429) return rep.code(429).send({ erro: 'Muitas tentativas. Espere um minuto e tente de novo.' })
    req.log.error(erro)
    return rep.code(500).send({ erro: 'Algo deu errado no servidor. Tente de novo.' })
  })

  app.get('/api/saude', async () => {
    await pool.query('select 1')
    return { ok: true }
  })

  const limite = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }

  app.post('/api/conta/criar', limite, async (req, rep) => {
    const d = esquema.criarConta.parse(req.body)
    const email = d.email.trim().toLowerCase()
    const senhaHash = await bcrypt.hash(d.senha, 12)
    const r = await pool.query<{ id: string }>(
      'insert into usuario (nome, email, senha_hash, aceite_termos_em) values ($1, $2, $3, now()) on conflict do nothing returning id',
      [d.nome, email, senhaHash],
    )
    if (!r.rows[0]) return rep.code(409).send({ erro: 'Já existe uma conta com esse e-mail. Tente entrar.' })
    await abrirSessao(rep, r.rows[0].id)
    return rep.code(201).send({ usuario: { nome: d.nome, email }, temNegocio: false })
  })

  app.post('/api/conta/entrar', limite, async (req, rep) => {
    const d = esquema.entrar.parse(req.body)
    const r = await pool.query<{ id: string; nome: string; email: string; senha_hash: string }>('select id, nome, email, senha_hash from usuario where lower(email) = lower($1)', [d.email])
    const u = r.rows[0]
    const confere = await bcrypt.compare(d.senha, u?.senha_hash ?? HASH_FALSO)
    if (!u || !confere) return rep.code(401).send({ erro: 'E-mail ou senha não conferem.' })
    await abrirSessao(rep, u.id)
    const temNegocio = await comUsuario(pool, u.id, async (c) => !!(await empresaDaSessao(c)))
    return { usuario: { nome: u.nome, email: u.email }, temNegocio }
  })

  app.post('/api/conta/sair', async (req, rep) => {
    const token = req.cookies[COOKIE]
    if (token) await pool.query('delete from sessao where token_hash = $1', [hash(token)])
    rep.clearCookie(COOKIE, { path: '/' })
    return { ok: true }
  })

  app.get('/api/conta', { preHandler: exigirLogin }, async (req) => {
    const u = (await pool.query<{ nome: string; email: string }>('select nome, email from usuario where id = $1', [req.usuarioId])).rows[0]
    const temNegocio = await comUsuario(pool, req.usuarioId!, async (c) => !!(await empresaDaSessao(c)))
    return { usuario: u, temNegocio }
  })

  app.get('/api/dados', { preHandler: exigirLogin }, async (req) => ({ dados: await comUsuario(pool, req.usuarioId!, lerDados) }))

  app.post('/api/negocio', { preHandler: exigirLogin }, async (req, rep) => {
    const n = esquema.novoNegocio.parse(req.body)
    const dados = await comUsuario(pool, req.usuarioId!, async (c) => {
      await criarNegocio(c, req.usuarioId!, n)
      return lerDados(c)
    })
    return rep.code(201).send({ dados })
  })

  app.post('/api/sincronizar', { preHandler: exigirLogin }, async (req, rep) => {
    const m = esquema.mudancas.parse(req.body)
    const ok = await comUsuario(pool, req.usuarioId!, async (c) => {
      const empresaId = await empresaDaSessao(c)
      if (!empresaId) return false
      await aplicarMudancas(c, empresaId, m)
      return true
    })
    if (!ok) return rep.code(409).send({ erro: 'Faça a configuração inicial do negócio primeiro.' })
    return { ok: true }
  })

  // Comprovantes: até 5 MB por arquivo (em base64 o corpo fica cerca de 1/3 maior).
  app.post('/api/comprovantes', { preHandler: exigirLogin, bodyLimit: 8 * 1024 * 1024 }, async (req, rep) => {
    const d = esquema.novoComprovante.parse(req.body)
    const dados = Buffer.from(d.dados, 'base64')
    if (!dados.length || dados.length > 5 * 1024 * 1024) return rep.code(400).send({ erro: 'O arquivo precisa ter até 5 MB.' })
    // Confere o conteúdo, não só o tipo informado: PDF começa com %PDF, JPEG com FFD8, PNG com 89504E47, WebP com RIFF.
    const assinatura = dados.subarray(0, 4).toString('hex')
    const confere = { 'application/pdf': '25504446', 'image/jpeg': 'ffd8', 'image/png': '89504e47', 'image/webp': '52494646' }[d.tipo]
    if (!assinatura.startsWith(confere)) return rep.code(400).send({ erro: 'O arquivo não parece ser uma foto ou um PDF.' })
    const ok = await comUsuario(pool, req.usuarioId!, async (c) => {
      const empresaId = await empresaDaSessao(c)
      if (!empresaId) return false
      await gravarComprovante(c, empresaId, { id: d.id, nome: d.nome, tipo: d.tipo, dados })
      return true
    })
    if (!ok) return rep.code(409).send({ erro: 'Faça a configuração inicial do negócio primeiro.' })
    return rep.code(201).send({ ok: true })
  })

  app.get('/api/comprovantes/:id', { preHandler: exigirLogin }, async (req, rep) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params)
    const comp = await comUsuario(pool, req.usuarioId!, (c) => lerComprovante(c, id))
    if (!comp) return rep.code(404).send({ erro: 'Comprovante não encontrado.' })
    return rep
      .header('content-type', comp.tipo)
      .header('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(comp.nome)}`)
      .header('cache-control', 'private, max-age=86400')
      .header('x-content-type-options', 'nosniff')
      .send(comp.dados)
  })

  app.all('/api/*', async (_req, rep) => rep.code(404).send({ erro: 'Endereço não encontrado.' }))

  // Arquivos em assets/ têm o hash no nome: podem ficar no cache por um ano. O resto (index.html,
  // páginas do site de venda) é conferido a cada visita, para uma atualização chegar na hora.
  const cabecalhos = (res: { header: (k: string, v: string) => unknown }, caminho: string) => {
    res.header('cache-control', /[\\/]assets[\\/]/.test(caminho) ? 'public, max-age=31536000, immutable' : 'no-cache')
  }
  if (opcoes.site !== false && existsSync(config.pastaSite)) {
    app.get('/app', async (_req, rep) => rep.redirect('/app/', 301))
    await app.register(fastifyStatic, {
      root: config.pastaSite,
      prefix: '/app/',
      index: 'index.html',
      cacheControl: false,
      setHeaders: cabecalhos,
    })
  }
  if (opcoes.site !== false && existsSync(config.pastaVitrine)) {
    await app.register(fastifyStatic, {
      root: config.pastaVitrine,
      prefix: '/',
      index: 'index.html',
      cacheControl: false,
      decorateReply: false,
      setHeaders: cabecalhos,
    })
  }
  return app
}
