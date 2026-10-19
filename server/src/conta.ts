// Base legal da conta: termos de uso e política de privacidade com versões e aceite (/api/publico/legal,
// /api/admin/legal), direitos do titular pela LGPD (baixar meus dados, excluir a conta), troca de senha,
// pedido de cancelamento da assinatura e o registro de acessos que o Marco Civil da Internet exige.
// Os textos iniciais ficam em server/legal/*.md e são gravados pelo migrador.
import bcrypt from 'bcryptjs'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import type { GuardaAdmin } from './admin.ts'
import { lerDados } from './dados.ts'
import { comAdmin, comUsuario, type Cliente } from './db.ts'

type Guarda = (req: FastifyRequest, rep: FastifyReply) => Promise<unknown>
type Linha = Record<string, unknown>

export const TIPOS_DOCUMENTO = ['termos', 'privacidade'] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]
const TITULOS: Record<TipoDocumento, string> = { termos: 'Termos de Uso', privacidade: 'Política de Privacidade' }

// ---------- Registro de acessos (Marco Civil, art. 15) ----------
export type EventoAcesso = 'cadastro' | 'entrada' | 'entrada recusada' | 'saida' | 'senha trocada' | 'senha redefinida' | 'conta excluida'

/** Grava IP, porta e hora do evento. Nunca derruba o pedido se falhar. */
export async function registrarAcesso(pool: pg.Pool, req: FastifyRequest, usuarioId: string | undefined, evento: EventoAcesso) {
  try {
    await pool.query('insert into registro_acesso (usuario_id, evento, ip, porta, navegador) values ($1, $2, $3, $4, $5)', [
      usuarioId ?? null,
      evento,
      req.ip,
      portaDoCliente(req),
      String(req.headers['user-agent'] ?? '').slice(0, 300),
    ])
  } catch (e) {
    req.log.error(e, 'Registro de acesso não gravado')
  }
}

/** Porta de origem do visitante: o nginx manda em X-Forwarded-Port só se estiver configurado para isso (X-Real-Port). */
function portaDoCliente(req: FastifyRequest): number | null {
  const n = Number(req.headers['x-real-port'] ?? req.socket.remotePort)
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : null
}

// ---------- Tentativas de senha por conta ----------
/**
 * Além do limite por endereço de internet, conta os erros de senha por e-mail: depois de 8 erros em
 * 15 minutos, aquele e-mail espera 15 minutos. Guardado na memória do servidor (um processo só).
 */
export function criarTravaDeSenha(maxErros = 8, janelaMs = 15 * 60_000) {
  const erros = new Map<string, number[]>()
  const recentes = (email: string) => (erros.get(email) ?? []).filter((t) => Date.now() - t < janelaMs)
  return {
    travado: (email: string) => recentes(email.toLowerCase()).length >= maxErros,
    errou(email: string) {
      const k = email.toLowerCase()
      erros.set(k, [...recentes(k), Date.now()])
      // Não deixa o mapa crescer sem fim com e-mails inventados.
      if (erros.size > 10_000) for (const [chave] of erros) if (!recentes(chave).length) erros.delete(chave)
    },
    acertou: (email: string) => void erros.delete(email.toLowerCase()),
  }
}

// ---------- Documentos legais ----------
// Valores padrão das chaves do site (iguais a src/domain/conteudoSite.ts) usados nos textos.
const PADRAO_SITE: Record<string, string> = {
  'empresa.nome': 'KodeMI',
  'contato.whatsapp': '351914125381',
  'atendimento.horario': 'segunda a sexta, em horário comercial',
}

const telefone = (n: string) => (n ? `+${n.replace(/\D/g, '')}` : '')

/** Troca {{empresa.nome}} e companhia pelos dados preenchidos em Superadmin > Site. */
export function preencherTexto(texto: string, conteudo: Record<string, string>): string {
  return texto.replace(/\{\{([a-z0-9_.]+)\}\}/g, (_, chave: string) => {
    const v = (conteudo[chave] ?? PADRAO_SITE[chave] ?? '').trim()
    if (!v) return '(a informar)'
    if (chave === 'contato.whatsapp') return telefone(v)
    if (chave === 'atendimento.horario') return v.charAt(0).toLowerCase() + v.slice(1)
    return v
  })
}

interface Documento {
  id: number
  tipo: TipoDocumento
  versao: string
  texto: string
  publicadoEm: string
}

const documento = (x: Linha): Documento => ({
  id: Number(x.id),
  tipo: x.tipo as TipoDocumento,
  versao: x.versao as string,
  texto: x.texto as string,
  publicadoEm: new Date(x.publicado_em as string).toISOString(),
})

/** Versão em vigor de cada documento (a mais nova). */
async function vigentes(c: pg.Pool | Cliente): Promise<Documento[]> {
  const r = await c.query<Linha>('select distinct on (tipo) * from documento_legal order by tipo, publicado_em desc, id desc')
  return r.rows.map(documento)
}

/** Grava o aceite das versões em vigor (no cadastro e quando a pessoa aceita uma versão nova). */
export async function aceitarVigentes(c: Cliente, ip: string) {
  await c.query(
    `insert into aceite_documento (usuario_id, documento_id, ip)
     select app_usuario(), d.id, $1 from (select distinct on (tipo) id from documento_legal order by tipo, publicado_em desc, id desc) d
     on conflict do nothing`,
    [ip],
  )
}

/** Documentos em vigor que a pessoa ainda não aceitou (tipo e versão). */
export async function aceitesPendentes(c: Cliente): Promise<{ tipo: TipoDocumento; versao: string; titulo: string }[]> {
  const r = await c.query<{ tipo: TipoDocumento; versao: string }>(
    `select d.tipo, d.versao from (select distinct on (tipo) * from documento_legal order by tipo, publicado_em desc, id desc) d
     where not exists (select 1 from aceite_documento a where a.documento_id = d.id and a.usuario_id = app_usuario())
     order by d.tipo desc`,
  )
  return r.rows.map((x) => ({ ...x, titulo: TITULOS[x.tipo] }))
}

// ---------- Limpeza diária ----------
/** Apaga o que já passou do prazo de guarda (ver a Política de Privacidade, item 6). */
export async function limparVencidos(pool: pg.Pool) {
  await comAdmin(pool, async (c) => {
    await c.query("delete from registro_acesso where em < now() - interval '6 months'")
    await c.query("delete from erro_app where criado_em < now() - interval '90 days'")
    await c.query("delete from conta_excluida where excluida_em < now() - interval '5 years'")
  })
  await pool.query("delete from sessao where expira_em < now() - interval '1 day'")
  await pool.query("delete from senha_redefinicao where expira_em < now() - interval '1 day'")
}

export function agendarLimpeza(pool: pg.Pool): () => void {
  const volta = () => limparVencidos(pool).catch((e) => console.error('Limpeza diária falhou:', (e as Error).message))
  const t = setInterval(volta, 24 * 60 * 60 * 1000)
  void volta()
  return () => clearInterval(t)
}

// ---------- Rotas ----------
const esquemaExcluir = z.object({ senha: z.string().min(1, 'Digite a sua senha para confirmar.').max(200) })
const esquemaSenha = z.object({
  atual: z.string().min(1, 'Digite a senha atual.').max(200),
  nova: z.string().min(8, 'A senha nova precisa de pelo menos 8 caracteres.').max(200),
})
const esquemaCancelar = z.object({ motivo: z.string().trim().max(1000).default('') })
const esquemaPublicar = z.object({
  tipo: z.enum(TIPOS_DOCUMENTO),
  texto: z.string().trim().min(100, 'O texto está curto demais.').max(200000),
})

export async function rotasConta(
  app: FastifyInstance,
  pool: pg.Pool,
  { exigirLogin, admin, sairDeTodos }: { exigirLogin: Guarda; admin: GuardaAdmin; sairDeTodos: (rep: FastifyReply, usuarioId: string, manter?: string) => Promise<void> },
) {
  const { exigirAdmin, registrar } = admin
  const so = { preHandler: exigirAdmin }
  const logado = { preHandler: exigirLogin }
  // Pedidos que pedem senha: poucos por minuto, para ninguém adivinhar.
  const comSenha = { preHandler: exigirLogin, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }

  async function conferirSenha(usuarioId: string, senha: string) {
    const r = await pool.query<{ senha_hash: string }>('select senha_hash from usuario where id = $1', [usuarioId])
    return !!r.rows[0] && (await bcrypt.compare(senha, r.rows[0].senha_hash))
  }

  // Texto público (site: /termos.html e /privacidade.html), já com os dados da empresa.
  app.get('/api/publico/legal/:tipo', async (req, rep) => {
    const { tipo } = z.object({ tipo: z.enum(TIPOS_DOCUMENTO) }).parse(req.params)
    const doc = (await vigentes(pool)).find((d) => d.tipo === tipo)
    if (!doc) return rep.code(404).send({ erro: 'Documento não encontrado.' })
    const conteudo = (await pool.query<{ chave: string; valor: string }>('select chave, valor from site_conteudo')).rows
    rep.header('cache-control', 'public, max-age=60')
    return { tipo, titulo: TITULOS[tipo], versao: doc.versao, publicadoEm: doc.publicadoEm, texto: preencherTexto(doc.texto, Object.fromEntries(conteudo.map((r) => [r.chave, r.valor]))) }
  })

  // Aceite de uma versão nova dos termos ou da política.
  app.post('/api/conta/aceitar', logado, async (req) => {
    await comUsuario(pool, req.usuarioId!, (c) => aceitarVigentes(c, req.ip))
    return { ok: true }
  })

  // LGPD, art. 18 (acesso e portabilidade): tudo o que está guardado da pessoa, num arquivo só.
  app.get('/api/conta/meus-dados', { ...logado, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, rep) => {
    const tudo = await comUsuario(pool, req.usuarioId!, async (c) => {
      const conta = (await c.query<Linha>('select nome, email, telefone_whatsapp, aceite_termos_em, criado_em from usuario where id = app_usuario()')).rows[0]
      const assinatura = (await c.query<Linha>('select plano_id, situacao, valor, proximo_vencimento, cancelamento_pedido_em, criado_em from assinatura where usuario_id = app_usuario()')).rows[0] ?? null
      const pagamentos = (await c.query<Linha>('select valor, pago_em, referente, forma, criado_em from pagamento_assinatura where usuario_id = app_usuario() order by pago_em')).rows
      const aceites = (await c.query<Linha>('select d.tipo, d.versao, a.aceito_em, a.ip from aceite_documento a join documento_legal d on d.id = a.documento_id where a.usuario_id = app_usuario() order by a.aceito_em')).rows
      const acessos = (await c.query<Linha>('select evento, ip, porta, navegador, em from registro_acesso where usuario_id = app_usuario() order by em desc limit 1000')).rows
      const tickets = (await c.query<Linha>('select id, numero, assunto, categoria, situacao, criado_em from ticket where usuario_id = app_usuario() order by criado_em')).rows
      const mensagens = (await c.query<Linha>('select ticket_id, autor, autor_nome, texto, criado_em from ticket_mensagem where meu_ticket(ticket_id) and not interna order by criado_em')).rows
      const comprovantes = (await c.query<Linha>('select id, nome, tipo, tamanho, criado_em from comprovante order by criado_em')).rows
      return {
        conta,
        assinatura,
        pagamentos,
        aceites,
        acessos,
        suporte: tickets.map((t) => ({ ...t, mensagens: mensagens.filter((m) => m.ticket_id === t.id).map((m) => ({ autor: m.autor, autorNome: m.autor_nome, texto: m.texto, criadoEm: m.criado_em })) })),
        negocio: await lerDados(c),
        comprovantes,
      }
    })
    const nome = `gynfinance-meus-dados-${new Date().toISOString().slice(0, 10)}.json`
    return rep
      .header('content-type', 'application/json; charset=utf-8')
      .header('content-disposition', `attachment; filename="${nome}"`)
      .header('cache-control', 'no-store')
      .send(JSON.stringify({ geradoEm: new Date().toISOString(), observacao: 'Cópia dos seus dados guardados no Gynfinance (LGPD, art. 18). Os arquivos dos comprovantes abrem um a um no sistema.', ...tudo }, null, 2))
  })

  // LGPD, art. 18 (eliminação): apaga a conta e tudo o que depende dela. Fica só o que a lei
  // obriga a guardar: registros de acesso (6 meses) e mensalidades pagas (5 anos).
  app.post('/api/conta/excluir', comSenha, async (req, rep) => {
    const { senha } = esquemaExcluir.parse(req.body)
    const usuarioId = req.usuarioId!
    if (!(await conferirSenha(usuarioId, senha))) return rep.code(400).send({ erro: 'A senha não confere.' })
    await comAdmin(pool, async (c) => {
      await c.query(
        `insert into conta_excluida (usuario_id, nome, email, criada_em, pagamentos)
         select u.id, u.nome, u.email, u.criado_em,
           coalesce((select jsonb_agg(jsonb_build_object('valor', p.valor, 'pagoEm', p.pago_em, 'referente', p.referente, 'forma', p.forma) order by p.pago_em)
                     from pagamento_assinatura p where p.usuario_id = u.id), '[]')
         from usuario u where u.id = $1`,
        [usuarioId],
      )
      await c.query('delete from usuario where id = $1', [usuarioId])
    })
    await registrarAcesso(pool, req, usuarioId, 'conta excluida')
    rep.clearCookie('gyn_sessao', { path: '/' })
    return { ok: true }
  })

  app.post('/api/conta/senha', comSenha, async (req, rep) => {
    const d = esquemaSenha.parse(req.body)
    const usuarioId = req.usuarioId!
    if (!(await conferirSenha(usuarioId, d.atual))) return rep.code(400).send({ erro: 'A senha atual não confere.' })
    await pool.query('update usuario set senha_hash = $2, atualizado_em = now() where id = $1', [usuarioId, await bcrypt.hash(d.nova, 12)])
    // Os outros aparelhos saem; este continua conectado.
    await sairDeTodos(rep, usuarioId, req.cookies.gyn_sessao)
    await registrarAcesso(pool, req, usuarioId, 'senha trocada')
    return { ok: true }
  })

  // Cancelamento pelo próprio sistema (Decreto 7.962/2013, art. 5º, e CDC): vira um chamado com protocolo.
  app.post('/api/conta/cancelamento', { ...logado, config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, async (req) => {
    const { motivo } = esquemaCancelar.parse(req.body)
    const usuarioId = req.usuarioId!
    const r = await comUsuario(pool, usuarioId, async (c) => {
      const u = (await c.query<Linha>('select nome, email from usuario where id = app_usuario()')).rows[0]
      const a = (await c.query<Linha>('select a.situacao, p.nome as plano from assinatura a join plano p on p.id = a.plano_id where a.usuario_id = app_usuario()')).rows[0]
      const empresa = (await c.query<{ id: string; nome_fantasia: string }>('select id, nome_fantasia from empresa where usuario_id = app_usuario() limit 1')).rows[0]
      const id = crypto.randomUUID()
      const novo = await c.query<{ numero: number }>(
        `insert into ticket (id, usuario_id, empresa_id, assunto, categoria, prioridade, pagina, pagina_nome, perfil, nao_lido_suporte)
         values ($1, app_usuario(), $2, 'Pedido de cancelamento da assinatura', 'financeiro', 'alta', '/configuracoes/assinatura', 'Configurações > Assinatura', $3, true)
         returning numero`,
        [id, empresa?.id ?? null, { nome: u?.nome, email: u?.email, negocio: empresa?.nome_fantasia, plano: a?.plano, situacao: a?.situacao }],
      )
      const texto = `Quero cancelar a minha assinatura.${motivo ? `\n\nMotivo: ${motivo}` : ''}`
      await c.query("insert into ticket_mensagem (id, ticket_id, autor, autor_nome, texto) values ($1, $2, 'cliente', $3, $4)", [crypto.randomUUID(), id, u?.nome ?? '', texto])
      return { ticketId: id, protocolo: novo.rows[0].numero }
    })
    await comAdmin(pool, (c) => c.query('update assinatura set cancelamento_pedido_em = coalesce(cancelamento_pedido_em, now()), atualizado_em = now() where usuario_id = $1', [usuarioId]))
    return r
  })

  // ---------- Painel: versões dos documentos ----------
  app.get('/api/admin/legal', so, async () =>
    comAdmin(pool, async (c) => {
      const r = await c.query<Linha>(
        `select d.*, (select count(*) from aceite_documento a where a.documento_id = d.id) as aceites
         from documento_legal d order by d.tipo, d.publicado_em desc, d.id desc`,
      )
      return { documentos: r.rows.map((x) => ({ ...documento(x), aceites: Number(x.aceites), publicadoPor: x.publicado_por as string })) }
    }),
  )

  // Publicar = versão nova; quem já tem conta aceita de novo ao entrar.
  app.post('/api/admin/legal', so, async (req, rep) => {
    const d = esquemaPublicar.parse(req.body)
    const r = await comAdmin(pool, async (c) => {
      const atual = (await vigentes(c)).find((x) => x.tipo === d.tipo)
      if (atual && atual.texto === d.texto) return null
      const hoje = new Date().toISOString().slice(0, 10)
      const iguais = Number((await c.query<{ n: string }>("select count(*) as n from documento_legal where tipo = $1 and versao like $2 || '%'", [d.tipo, hoje])).rows[0].n)
      const versao = iguais ? `${hoje}.${iguais + 1}` : hoje
      const email = (await c.query<{ email: string }>('select email from usuario where id = $1', [req.usuarioId])).rows[0]?.email ?? ''
      await c.query('insert into documento_legal (tipo, versao, texto, publicado_por) values ($1, $2, $3, $4)', [d.tipo, versao, d.texto, email])
      await registrar(c, req, 'documento legal publicado', `${TITULOS[d.tipo]}, versão ${versao}`)
      return versao
    })
    if (!r) return rep.code(400).send({ erro: 'O texto é igual ao da versão em vigor.' })
    return rep.code(201).send({ versao: r })
  })
}
