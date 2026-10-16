// Suporte: chamados que o cliente abre de dentro do sistema (/api/suporte) e que a equipe
// responde pelo painel de superadmin (/api/admin/suporte), com fotos, a cópia do perfil, a tela
// onde a pessoa estava e os erros recentes do app. Também recebe os erros que o app registra
// sozinho (/api/suporte/erros) e mostra tudo agrupado no painel (/api/admin/erros).
// Os formatos JSON seguem src/domain/suporte.ts (o servidor não importa de src/).
import { createHash, randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import type { GuardaAdmin } from './admin.ts'
import { comAdmin, comUsuario, type Cliente } from './db.ts'

type Linha = Record<string, unknown>
type Guarda = (req: FastifyRequest, rep: FastifyReply) => Promise<unknown>

const CATEGORIAS = ['duvida', 'problema', 'financeiro', 'sugestao', 'outro'] as const
const SITUACOES = ['aberto', 'em_andamento', 'aguardando_cliente', 'resolvido'] as const
const PRIORIDADES = ['baixa', 'normal', 'alta', 'urgente'] as const
const ORIGENS = ['tela', 'script', 'promessa', 'servidor', 'conexao'] as const
const TIPOS_FOTO = { 'image/jpeg': 'ffd8', 'image/png': '89504e47', 'image/webp': '52494646' } as const
const MAX_FOTO = 5 * 1024 * 1024
// Até 5 fotos de 5 MB não cabem num pedido só: o app reduz as fotos antes. O nginx aceita 10 MB.
const LIMITE_CORPO = 9 * 1024 * 1024

type Situacao = (typeof SITUACOES)[number]

// ---------- Formatos que chegam ----------
const id = z.uuid()
/** Texto que o app junta sozinho (navegador, erros): o que passar do limite é cortado, não recusado. */
const corte = (max: number) => z.string().max(max * 20).transform((s) => s.slice(0, max))

const esquemaContexto = z.object({
  pagina: corte(200).default(''),
  paginaNome: corte(300).default(''),
  navegador: corte(300).default(''),
  tela: corte(300).default(''),
  plataforma: corte(300).default(''),
  versao: corte(300).default(''),
  online: z.boolean().default(true),
})

const esquemaErro = z.object({
  quando: corte(40).default(''),
  origem: z.enum(ORIGENS, { error: 'Tipo de erro desconhecido.' }),
  mensagem: corte(500).transform((s) => s || 'Erro sem mensagem'),
  pilha: corte(2000).optional(),
  pagina: corte(200).default(''),
})

const esquemaAnexo = z.object({
  id,
  nome: z.string().max(1000).transform((s) => s.trim().slice(0, 200) || 'foto'),
  tipo: z.enum(Object.keys(TIPOS_FOTO) as [keyof typeof TIPOS_FOTO], { error: 'Mande fotos em JPG, PNG ou WebP.' }),
  /** Conteúdo em base64, sem o prefixo data: (até 5 MB depois de decodificado). */
  dados: z.string().min(4).max(7_000_000, 'Cada foto pode ter até 5 MB.'),
})
const anexos = z.array(esquemaAnexo).max(5, 'Mande até 5 fotos por mensagem.').default([])
const textoMensagem = z.string().trim().min(1, 'Escreva a mensagem.').max(5000, 'A mensagem pode ter até 5.000 letras.')

const esquemaNovoTicket = z.object({
  id,
  assunto: z.string().trim().min(3, 'Escreva o assunto com pelo menos 3 letras.').max(120, 'O assunto pode ter até 120 letras.'),
  categoria: z.enum(CATEGORIAS, { error: 'Escolha sobre o que é o pedido.' }),
  texto: textoMensagem,
  contato: z.string().trim().max(30, 'O telefone para retorno pode ter até 30 caracteres.').optional(),
  contexto: esquemaContexto.default(esquemaContexto.parse({})),
  erros: z.array(esquemaErro).max(10, 'Mande até 10 erros.').default([]),
  anexos,
})

const esquemaMensagem = z.object({ id, texto: textoMensagem, anexos })
const esquemaMensagemAdmin = esquemaMensagem.extend({
  interna: z.boolean().default(false),
  situacao: z.enum(SITUACOES).optional(),
})

const esquemaErros = z.object({
  erros: z.array(esquemaErro).min(1).max(5, 'Mande até 5 erros por vez.'),
  contexto: esquemaContexto.optional(),
})

// ---------- Fotos ----------
interface Foto {
  id: string
  nome: string
  tipo: string
  dados: Buffer
}

/** Decodifica e confere as fotos (pelo conteúdo, não só pelo tipo informado). */
function lerFotos(lista: z.infer<typeof esquemaAnexo>[]): { fotos: Foto[] } | { erro: string } {
  const fotos: Foto[] = []
  for (const a of lista) {
    const dados = Buffer.from(a.dados, 'base64')
    if (!dados.length || dados.length > MAX_FOTO) return { erro: `A foto "${a.nome}" precisa ter até 5 MB.` }
    // JPEG começa com FFD8, PNG com 89504E47, WebP com RIFF.
    if (!dados.subarray(0, 4).toString('hex').startsWith(TIPOS_FOTO[a.tipo])) return { erro: `A foto "${a.nome}" não parece ser uma imagem JPG, PNG ou WebP.` }
    fotos.push({ id: a.id, nome: a.nome, tipo: a.tipo, dados })
  }
  return { fotos }
}

async function gravarFotos(c: Cliente, ticketId: string, mensagemId: string, fotos: Foto[]) {
  for (const f of fotos)
    await c.query('insert into ticket_anexo (id, ticket_id, mensagem_id, nome, tipo, tamanho, dados) values ($1, $2, $3, $4, $5, $6, $7) on conflict (id) do nothing', [
      f.id,
      ticketId,
      mensagemId,
      f.nome,
      f.tipo,
      f.dados.length,
      f.dados,
    ])
}

// ---------- Formatos que saem ----------
const iso = (d: unknown) => (d as Date).toISOString()

function resumo(x: Linha, naoLido: boolean) {
  return {
    id: x.id as string,
    numero: x.numero as number,
    assunto: x.assunto as string,
    categoria: x.categoria as string,
    situacao: x.situacao as string,
    prioridade: x.prioridade as string,
    pagina: x.pagina as string,
    paginaNome: x.pagina_nome as string,
    criadoEm: iso(x.criado_em),
    atualizadoEm: iso(x.atualizado_em),
    naoLido,
    totalMensagens: (x.total_mensagens as number | undefined) ?? 0,
    ultimaMensagem: x.ultima_autor
      ? { autor: x.ultima_autor as string, texto: (x.ultima_texto as string).slice(0, 200), criadoEm: iso(x.ultima_em) }
      : undefined,
    cliente: x.cliente_id
      ? { id: x.cliente_id as string, nome: x.cliente_nome as string, email: x.cliente_email as string, negocio: (x.cliente_negocio as string | null) ?? undefined }
      : undefined,
  }
}

// Total de mensagens e a última. "interna" entra só no painel (o cliente nem enxerga as notas internas).
const colunasResumo = (comInternas: boolean) => `
  (select count(*)::int from ticket_mensagem m where m.ticket_id = t.id ${comInternas ? '' : 'and not m.interna'}) as total_mensagens,
  um.autor as ultima_autor, um.texto as ultima_texto, um.criado_em as ultima_em`
const juntaUltima = (comInternas: boolean) => `
  left join lateral (select autor, texto, criado_em from ticket_mensagem m where m.ticket_id = t.id ${comInternas ? '' : 'and not m.interna'}
                     order by criado_em desc limit 1) um on true`

/** Chamado completo, com as mensagens e as fotos. "base" é o começo do endereço das fotos. */
async function lerTicket(c: Cliente, ticketId: string, painel: boolean) {
  const r = await c.query<Linha>(
    `select t.*, ${colunasResumo(painel)}
     ${painel ? ", u.id as cliente_id, u.nome as cliente_nome, u.email as cliente_email, coalesce(e.nome_fantasia, t.perfil->'negocio'->>'nome') as cliente_negocio" : ''}
     from ticket t ${juntaUltima(painel)}
     ${painel ? 'join usuario u on u.id = t.usuario_id left join empresa e on e.id = t.empresa_id' : ''}
     where t.id = $1`,
    [ticketId],
  )
  const t = r.rows[0]
  if (!t) return null
  const msgs = await c.query<Linha>(
    `select id, autor, autor_nome, texto, interna, criado_em from ticket_mensagem where ticket_id = $1 ${painel ? '' : 'and not interna'} order by criado_em, id`,
    [ticketId],
  )
  const fotos = await c.query<Linha>('select id, mensagem_id, nome, tipo, tamanho from ticket_anexo where ticket_id = $1 order by criado_em, nome', [ticketId])
  const base = painel ? 'api/admin/suporte/anexos/' : 'api/suporte/anexos/'
  return {
    ...resumo(t, (painel ? t.nao_lido_suporte : t.nao_lido_cliente) as boolean),
    perfil: t.perfil,
    contexto: t.contexto,
    erros: t.erros,
    contato: (t.contato as string | null) || undefined,
    mensagens: msgs.rows.map((m) => ({
      id: m.id as string,
      autor: m.autor as string,
      autorNome: m.autor_nome as string,
      texto: m.texto as string,
      interna: m.interna as boolean,
      criadoEm: iso(m.criado_em),
      anexos: fotos.rows
        .filter((f) => f.mensagem_id === m.id)
        .map((f) => ({ id: f.id as string, nome: f.nome as string, tipo: f.tipo as string, tamanho: f.tamanho as number, url: `${base}${f.id}` })),
    })),
  }
}

/** Monta a cópia do perfil pela conta (nunca pelo que o navegador manda). Roda dentro de comUsuario. */
async function montarPerfil(c: Cliente, usuarioId: string) {
  const u = (await c.query<Linha>('select nome, email, telefone_whatsapp from usuario where id = $1', [usuarioId])).rows[0]
  const e = (
    await c.query<Linha>('select id, nome_fantasia, cnpj, eh_mei, uf, municipio, atividade from empresa where usuario_id = app_usuario() order by criado_em limit 1')
  ).rows[0]
  const a = (await c.query<Linha>('select p.nome, a.situacao from assinatura a join plano p on p.id = a.plano_id where a.usuario_id = app_usuario()')).rows[0]
  const perfil = {
    nome: (u?.nome as string) ?? '',
    email: (u?.email as string) ?? '',
    telefone: (u?.telefone_whatsapp as string | null) ?? undefined,
    negocio: e
      ? {
          nome: e.nome_fantasia as string,
          cnpj: (e.cnpj as string | null) ?? undefined,
          ehMei: e.eh_mei as boolean,
          uf: e.uf as string,
          municipio: (e.municipio as string | null) ?? undefined,
          atividade: e.atividade as string,
        }
      : undefined,
    plano: (a?.nome as string | undefined) ?? undefined,
    situacaoAssinatura: (a?.situacao as string | undefined) ?? undefined,
  }
  return { perfil, empresaId: (e?.id as string | undefined) ?? null }
}

/** Chamados com resposta que a pessoa logada ainda não leu (para o aviso no menu). Dentro de comUsuario. */
export async function contarNaoLidos(c: Cliente): Promise<number> {
  return (await c.query<{ n: number }>('select count(*)::int as n from ticket where usuario_id = app_usuario() and nao_lido_cliente')).rows[0].n
}

// ---------- Erros registrados sozinhos ----------
/** Agrupa ocorrências do mesmo erro na mesma tela. */
const chaveErro = (origem: string, mensagem: string, pagina: string) =>
  createHash('sha1')
    .update(`${origem}|${mensagem.split('\n')[0].trim()}|${pagina}`)
    .digest('hex')
    .slice(0, 16)

interface NovoErro {
  origem: string
  mensagem: string
  pilha: string
  pagina: string
  contexto: Record<string, unknown>
}

async function gravarErros(pool: pg.Pool, usuarioId: string | undefined, erros: NovoErro[]) {
  const inserir = async (c: Cliente | pg.Pool) => {
    for (const e of erros)
      await c.query('insert into erro_app (chave, origem, mensagem, pilha, pagina, usuario_id, contexto) values ($1, $2, $3, $4, $5, app_usuario(), $6)', [
        chaveErro(e.origem, e.mensagem, e.pagina),
        e.origem,
        e.mensagem,
        e.pilha,
        e.pagina,
        e.contexto,
      ])
  }
  // Logado: o banco confere que o erro é da própria pessoa. Sem login: app_usuario() fica vazio.
  if (usuarioId) await comUsuario(pool, usuarioId, inserir)
  else await inserir(pool)
}

/**
 * Registra um erro 500 do servidor para aparecer no painel. Não espera e nunca dá erro: se nem
 * isso der certo, o erro já foi para o log.
 */
export function registrarErroServidor(pool: pg.Pool, req: FastifyRequest, erro: Error) {
  try {
    const pagina = `${req.method} ${req.routeOptions?.url ?? req.url.split('?')[0]}`.slice(0, 200)
    const pilha = (erro.stack ?? '').split('\n').slice(0, 12).join('\n').slice(0, 2000)
    gravarErros(pool, req.usuarioId, [{ origem: 'servidor', mensagem: String(erro.message || 'Erro sem mensagem').slice(0, 500), pilha, pagina, contexto: {} }]).catch(
      (e: Error) => req.log.warn({ err: e }, 'Não deu para registrar o erro no painel.'),
    )
  } catch {
    // Nada a fazer.
  }
}

// ---------- Rotas ----------
export async function rotasSuporte(
  app: FastifyInstance,
  pool: pg.Pool,
  opcoes: {
    exigirLogin: Guarda
    /** Lê a sessão do cookie sem exigir login (para registrar erros de quem ainda não entrou). */
    lerSessao: (req: FastifyRequest) => Promise<string | undefined>
    admin: GuardaAdmin
  },
) {
  const { exigirLogin, lerSessao } = opcoes
  const { exigirAdmin, registrar } = opcoes.admin
  const logado = { preHandler: exigirLogin }
  const so = { preHandler: exigirAdmin }
  const comFotos = (preHandler: Guarda) => ({ preHandler, bodyLimit: LIMITE_CORPO })
  const naoEncontrado = (rep: FastifyReply) => rep.code(404).send({ erro: 'Chamado não encontrado.' })

  const enviarFoto = (rep: FastifyReply, f: { tipo: string; nome: string; dados: Buffer } | undefined) => {
    if (!f) return rep.code(404).send({ erro: 'Foto não encontrada.' })
    return rep
      .header('content-type', f.tipo)
      .header('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.nome)}`)
      .header('cache-control', 'private, max-age=86400')
      .header('x-content-type-options', 'nosniff')
      .send(f.dados)
  }

  // ---------- Cliente ----------
  // Chamados não dependem da assinatura nem da manutenção: quem está bloqueado precisa poder pedir ajuda.
  app.get('/api/suporte/tickets', logado, async (req) =>
    comUsuario(pool, req.usuarioId!, async (c) => {
      const r = await c.query<Linha>(
        `select t.*, ${colunasResumo(false)} from ticket t ${juntaUltima(false)}
         where t.usuario_id = app_usuario() order by t.atualizado_em desc limit 200`,
      )
      return { tickets: r.rows.map((x) => resumo(x, x.nao_lido_cliente as boolean)), naoLidos: r.rows.filter((x) => x.nao_lido_cliente).length }
    }),
  )

  app.post(
    '/api/suporte/tickets',
    { ...comFotos(exigirLogin), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, rep) => {
      const d = esquemaNovoTicket.parse(req.body)
      const lidas = lerFotos(d.anexos)
      if ('erro' in lidas) return rep.code(400).send({ erro: lidas.erro })
      const r = await comUsuario(pool, req.usuarioId!, async (c) => {
        const { perfil, empresaId } = await montarPerfil(c, req.usuarioId!)
        const novo = await c.query<{ numero: number }>(
          `insert into ticket (id, usuario_id, empresa_id, assunto, categoria, pagina, pagina_nome, contato, perfil, contexto, erros, nao_lido_suporte)
           values ($1, app_usuario(), $2, $3, $4, $5, $6, $7, $8, $9, $10, true) on conflict (id) do nothing returning numero`,
          [d.id, empresaId, d.assunto, d.categoria, d.contexto.pagina, d.contexto.paginaNome, d.contato || null, perfil, d.contexto, JSON.stringify(d.erros)],
        )
        if (!novo.rows[0]) {
          // Mesmo chamado enviado de novo (internet caiu no meio): devolve o que já existe.
          const ja = await c.query<{ numero: number }>('select numero from ticket where id = $1', [d.id])
          return ja.rows[0] ? { id: d.id, numero: ja.rows[0].numero } : null
        }
        const msgId = randomUUID()
        await c.query("insert into ticket_mensagem (id, ticket_id, autor, autor_nome, texto) values ($1, $2, 'cliente', $3, $4)", [msgId, d.id, perfil.nome, d.texto])
        await gravarFotos(c, d.id, msgId, lidas.fotos)
        return { id: d.id, numero: novo.rows[0].numero }
      })
      if (!r) return rep.code(400).send({ erro: 'Dados inválidos.' })
      return rep.code(201).send(r)
    },
  )

  app.get('/api/suporte/tickets/:id', logado, async (req, rep) => {
    const { id: ticketId } = z.object({ id }).parse(req.params)
    const ticket = await comUsuario(pool, req.usuarioId!, async (c) => {
      await c.query('update ticket set nao_lido_cliente = false where id = $1 and nao_lido_cliente', [ticketId])
      return lerTicket(c, ticketId, false)
    })
    if (!ticket) return naoEncontrado(rep)
    return { ticket }
  })

  app.post('/api/suporte/tickets/:id/mensagens', comFotos(exigirLogin), async (req, rep) => {
    const { id: ticketId } = z.object({ id }).parse(req.params)
    const d = esquemaMensagem.parse(req.body)
    const lidas = lerFotos(d.anexos)
    if ('erro' in lidas) return rep.code(400).send({ erro: lidas.erro })
    const ok = await comUsuario(pool, req.usuarioId!, async (c) => {
      const t = await c.query('select 1 from ticket where id = $1', [ticketId])
      if (!t.rowCount) return false
      const nome = (await c.query<{ nome: string }>('select nome from usuario where id = $1', [req.usuarioId])).rows[0]?.nome ?? ''
      const nova = await c.query(
        "insert into ticket_mensagem (id, ticket_id, autor, autor_nome, texto) values ($1, $2, 'cliente', $3, $4) on conflict (id) do nothing",
        [d.id, ticketId, nome, d.texto],
      )
      // Já tinha chegado (envio repetido): não faz nada de novo.
      if (!nova.rowCount) return true
      await gravarFotos(c, ticketId, d.id, lidas.fotos)
      await c.query(
        `update ticket set situacao = case when situacao = 'em_andamento' then situacao else 'aberto' end,
                nao_lido_suporte = true, atualizado_em = now() where id = $1`,
        [ticketId],
      )
      return true
    })
    if (!ok) return naoEncontrado(rep)
    return rep.code(201).send({ id: d.id })
  })

  app.post('/api/suporte/tickets/:id/resolver', logado, async (req, rep) => {
    const { id: ticketId } = z.object({ id }).parse(req.params)
    const r = await comUsuario(pool, req.usuarioId!, (c) => c.query("update ticket set situacao = 'resolvido', atualizado_em = now() where id = $1", [ticketId]))
    if (!r.rowCount) return naoEncontrado(rep)
    return { ok: true }
  })

  app.get('/api/suporte/anexos/:id', logado, async (req, rep) => {
    const { id: fotoId } = z.object({ id }).parse(req.params)
    // As regras do banco só deixam abrir fotos dos próprios chamados, fora das notas internas.
    const f = await comUsuario(pool, req.usuarioId!, async (c) => (await c.query<Foto>('select nome, tipo, dados from ticket_anexo where id = $1', [fotoId])).rows[0])
    return enviarFoto(rep, f)
  })

  // Erros que o app pegou sozinho. Funciona com ou sem login.
  app.post('/api/suporte/erros', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, rep) => {
    const d = esquemaErros.parse(req.body)
    const usuarioId = await lerSessao(req)
    const { pagina: paginaAtual, paginaNome, ...aparelho } = d.contexto ?? esquemaContexto.parse({})
    await gravarErros(
      pool,
      usuarioId,
      d.erros.map((e) => ({
        origem: e.origem,
        mensagem: e.mensagem,
        pilha: e.pilha ?? '',
        pagina: e.pagina || paginaAtual,
        contexto: { ...aparelho, paginaNome, quando: e.quando },
      })),
    )
    return rep.code(204).send()
  })

  // ---------- Painel ----------
  app.get('/api/admin/suporte', so, async (req) => {
    const q = z
      .object({
        situacao: z.enum(SITUACOES).or(z.literal('')).or(z.literal('todos')).default(''),
        busca: z.string().max(200).default(''),
      })
      .parse(req.query)
    const busca = q.busca.trim().replace(/^#/, '')
    return comAdmin(pool, async (c) => {
      const r = await c.query<Linha>(
        `select t.*, ${colunasResumo(true)},
                u.id as cliente_id, u.nome as cliente_nome, u.email as cliente_email,
                coalesce(e.nome_fantasia, t.perfil->'negocio'->>'nome') as cliente_negocio
         from ticket t ${juntaUltima(true)}
         join usuario u on u.id = t.usuario_id
         left join empresa e on e.id = t.empresa_id
         where ($1 = '' or $1 = 'todos' or t.situacao = $1)
           and ($2 = '' or t.numero::text = $2
                or strpos(lower(concat_ws(' ', t.assunto, u.nome, u.email, e.nome_fantasia, t.perfil->'negocio'->>'nome', t.pagina_nome)), lower($2)) > 0)
         order by t.nao_lido_suporte desc,
                  case when t.situacao = 'resolvido' then 4
                       else case t.prioridade when 'urgente' then 0 when 'alta' then 1 when 'normal' then 2 else 3 end end,
                  t.atualizado_em desc
         limit 300`,
        [q.situacao, busca],
      )
      const cont = await c.query<{ situacao: Situacao; n: number }>('select situacao, count(*)::int as n from ticket group by situacao')
      const contagem = Object.fromEntries(SITUACOES.map((s) => [s, 0])) as Record<Situacao, number>
      for (const x of cont.rows) contagem[x.situacao] = x.n
      const naoLidos = (await c.query<{ n: number }>('select count(*)::int as n from ticket where nao_lido_suporte')).rows[0].n
      return { tickets: r.rows.map((x) => resumo(x, x.nao_lido_suporte as boolean)), contagem, naoLidos }
    })
  })

  app.get('/api/admin/suporte/anexos/:id', so, async (req, rep) => {
    const { id: fotoId } = z.object({ id }).parse(req.params)
    const f = await comAdmin(pool, async (c) => (await c.query<Foto>('select nome, tipo, dados from ticket_anexo where id = $1', [fotoId])).rows[0])
    return enviarFoto(rep, f)
  })

  app.get('/api/admin/suporte/:id', so, async (req, rep) => {
    const { id: ticketId } = z.object({ id }).parse(req.params)
    const r = await comAdmin(pool, async (c) => {
      await c.query('update ticket set nao_lido_suporte = false where id = $1 and nao_lido_suporte', [ticketId])
      const ticket = await lerTicket(c, ticketId, true)
      if (!ticket) return null
      const outros = (
        await c.query<{ n: number }>('select count(*)::int as n from ticket where usuario_id = (select usuario_id from ticket where id = $1) and id <> $1', [ticketId])
      ).rows[0].n
      return { ticket, outros }
    })
    if (!r) return naoEncontrado(rep)
    return r
  })

  app.post('/api/admin/suporte/:id/mensagens', comFotos(exigirAdmin), async (req, rep) => {
    const { id: ticketId } = z.object({ id }).parse(req.params)
    const d = esquemaMensagemAdmin.parse(req.body)
    const lidas = lerFotos(d.anexos)
    if ('erro' in lidas) return rep.code(400).send({ erro: lidas.erro })
    const ok = await comAdmin(pool, async (c) => {
      const t = await c.query<{ numero: number }>('select numero from ticket where id = $1', [ticketId])
      if (!t.rows[0]) return false
      const nova = await c.query(
        "insert into ticket_mensagem (id, ticket_id, autor, autor_nome, texto, interna) values ($1, $2, 'suporte', 'Equipe Gynfinance', $3, $4) on conflict (id) do nothing",
        [d.id, ticketId, d.texto, d.interna],
      )
      if (!nova.rowCount) return true
      await gravarFotos(c, ticketId, d.id, lidas.fotos)
      if (!d.interna)
        await c.query('update ticket set situacao = $2, nao_lido_cliente = true, nao_lido_suporte = false, atualizado_em = now() where id = $1', [
          ticketId,
          d.situacao ?? 'aguardando_cliente',
        ])
      else if (d.situacao) await c.query('update ticket set situacao = $2, atualizado_em = now() where id = $1', [ticketId, d.situacao])
      await registrar(c, req, d.interna ? 'nota interna no chamado' : 'chamado respondido', `#${t.rows[0].numero}${d.situacao ? ` (${d.situacao})` : ''}`)
      return true
    })
    if (!ok) return naoEncontrado(rep)
    return rep.code(201).send({ id: d.id })
  })

  app.patch('/api/admin/suporte/:id', so, async (req, rep) => {
    const { id: ticketId } = z.object({ id }).parse(req.params)
    const d = z
      .object({ situacao: z.enum(SITUACOES).optional(), prioridade: z.enum(PRIORIDADES).optional() })
      .refine((x) => x.situacao || x.prioridade, 'Diga o que mudar.')
      .parse(req.body)
    const ok = await comAdmin(pool, async (c) => {
      const r = await c.query<{ numero: number }>(
        'update ticket set situacao = coalesce($2, situacao), prioridade = coalesce($3, prioridade), atualizado_em = now() where id = $1 returning numero',
        [ticketId, d.situacao ?? null, d.prioridade ?? null],
      )
      if (!r.rows[0]) return false
      await registrar(c, req, 'chamado alterado', `#${r.rows[0].numero}: ${JSON.stringify(d)}`)
      return true
    })
    if (!ok) return naoEncontrado(rep)
    return { ok: true }
  })

  app.get('/api/admin/erros', so, async (req) => {
    const todos = z.object({ resolvidos: z.string().optional() }).parse(req.query).resolvidos === '1'
    return comAdmin(pool, async (c) => {
      const r = await c.query<Linha>(
        `with g as (
           select chave, count(*)::int as vezes, count(distinct usuario_id)::int as pessoas,
                  min(criado_em) as primeira, max(criado_em) as ultima, bool_and(resolvido) as resolvido
           from erro_app where criado_em > now() - interval '30 days' group by chave
         )
         select g.*, x.origem, x.mensagem, x.pilha, x.pagina, x.contexto->>'navegador' as navegador
         from g join lateral (select * from erro_app e where e.chave = g.chave order by criado_em desc limit 1) x on true
         where $1 or not g.resolvido
         order by g.ultima desc limit 200`,
        [todos],
      )
      return {
        grupos: r.rows.map((x) => ({
          chave: x.chave as string,
          origem: x.origem as string,
          mensagem: x.mensagem as string,
          pilha: x.pilha as string,
          pagina: x.pagina as string,
          vezes: x.vezes as number,
          pessoas: x.pessoas as number,
          primeiraVez: iso(x.primeira),
          ultimaVez: iso(x.ultima),
          navegador: (x.navegador as string | null) || undefined,
          resolvido: x.resolvido as boolean,
        })),
      }
    })
  })

  app.post('/api/admin/erros/:chave/resolver', so, async (req, rep) => {
    const { chave } = z.object({ chave: z.string().regex(/^[0-9a-f]{16}$/, 'Erro não encontrado.') }).parse(req.params)
    const ok = await comAdmin(pool, async (c) => {
      const r = await c.query('update erro_app set resolvido = true where chave = $1', [chave])
      if (!r.rowCount) return false
      await registrar(c, req, 'erro marcado como resolvido', chave)
      return true
    })
    if (!ok) return rep.code(404).send({ erro: 'Erro não encontrado.' })
    return { ok: true }
  })
}
