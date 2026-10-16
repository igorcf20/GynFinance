// Painel de superadmin (/api/admin) e o que o site de venda lê sem login (/api/publico).
// O superadmin gere planos, assinaturas, mensalidades, textos e imagens do site e as
// configurações gerais. Nunca lê lançamentos dos clientes.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { config } from './config.ts'
import { comAdmin, type Cliente } from './db.ts'
import { MODULOS_SERVIDOR } from './modulos.ts'

type Linha = Record<string, unknown>
const id = z.uuid()
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const centavos = z.number().int().nonnegative().max(1e11)
const SITUACOES = ['teste', 'ativa', 'atrasada', 'suspensa', 'cancelada'] as const
const idModulo = z.enum(MODULOS_SERVIDOR.map((m) => m.id) as [string, ...string[]])

const esquemaPlano = z.object({
  nome: z.string().trim().min(1, 'Dê um nome ao plano.').max(60),
  descricao: z.string().trim().max(300),
  precoCentavos: centavos,
  modulos: z.array(idModulo).max(20),
  temIa: z.boolean(),
  destaque: z.boolean(),
  ativo: z.boolean(),
  ordem: z.number().int().min(0).max(1000),
})

const esquemaAssinante = z.object({
  planoId: z.string().max(40).optional(),
  situacao: z.enum(SITUACOES).optional(),
  valorCentavos: centavos.nullable().optional(),
  proximoVencimento: data.nullable().optional(),
  observacao: z.string().trim().max(1000).optional(),
  telefone: z.string().trim().max(30).nullable().optional(),
})

const esquemaPagamento = z.object({
  valorCentavos: z.number().int().positive().max(1e11),
  pagoEm: data,
  referente: z.string().regex(/^\d{4}-\d{2}$/),
  forma: z.enum(['pix', 'boleto', 'cartao', 'dinheiro', 'transferencia', 'outro']),
  observacao: z.string().trim().max(300).default(''),
  /** Marca a assinatura como ativa e passa o vencimento para o mês seguinte. */
  avancarVencimento: z.boolean().default(true),
})

const esquemaConfig = z.object({
  cadastroAberto: z.boolean(),
  diasTeste: z.number().int().min(0).max(365),
  planoPadrao: z.string().max(40),
  iaLigada: z.boolean(),
  aviso: z.string().trim().max(300),
  manutencao: z.boolean(),
})

const TIPOS_IMAGEM = { 'image/jpeg': 'ffd8', 'image/png': '89504e47', 'image/webp': '52494646', 'image/svg+xml': '' } as const
const esquemaImagem = z.object({
  id,
  nome: z.string().trim().min(1).max(200),
  tipo: z.enum(Object.keys(TIPOS_IMAGEM) as [keyof typeof TIPOS_IMAGEM]),
  dados: z.string().min(4).max(4_200_000),
})

const plano = (r: Linha) => ({
  id: r.id as string,
  nome: r.nome as string,
  descricao: r.descricao as string,
  precoCentavos: r.preco as number,
  modulos: r.modulos as string[],
  temIa: r.tem_ia as boolean,
  destaque: r.destaque as boolean,
  ativo: r.ativo as boolean,
  ordem: r.ordem as number,
})

const configSistema = (r: Linha) => ({
  cadastroAberto: r.cadastro_aberto as boolean,
  diasTeste: r.dias_teste as number,
  planoPadrao: r.plano_padrao as string,
  iaLigada: r.ia_ligada as boolean,
  aviso: r.aviso as string,
  manutencao: r.manutencao as boolean,
})

const slug = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'plano'

/** Mesmo dia no mês seguinte (31 de janeiro vira 28 ou 29 de fevereiro). */
export function maisUmMes(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate()
  const alvo = new Date(Date.UTC(a, m, Math.min(d, ultimo)))
  return alvo.toISOString().slice(0, 10)
}

/** Roda as consultas uma depois da outra (a mesma conexão não aceita duas ao mesmo tempo). */
async function sequencia<T extends readonly (() => Promise<unknown>)[]>(fns: T): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const r: unknown[] = []
  for (const f of fns) r.push(await f())
  return r as { [K in keyof T]: Awaited<ReturnType<T[K]>> }
}

// SVG pode levar script: só aceita se não tiver nada executável.
const svgSeguro = (texto: string) => !/<script|on[a-z]+\s*=|javascript:|<foreignObject|<iframe|<embed|<object/i.test(texto)

type Guarda = (req: FastifyRequest, rep: FastifyReply) => Promise<unknown>

/**
 * Porteiro do painel (só quem está em ADMIN_EMAILS) e o registro do que o admin mudou.
 * Usado aqui e nas rotas de suporte (suporte.ts).
 */
export function guardaAdmin(pool: pg.Pool, exigirLogin: Guarda) {
  async function emailDe(usuarioId: string) {
    return (await pool.query<{ email: string }>('select email from usuario where id = $1', [usuarioId])).rows[0]?.email.toLowerCase() ?? ''
  }

  async function exigirAdmin(req: FastifyRequest, rep: FastifyReply) {
    await exigirLogin(req, rep)
    if (rep.sent) return
    if (!config.adminEmails().includes(await emailDe(req.usuarioId!))) return rep.code(403).send({ erro: 'Só o administrador do sistema entra aqui.' })
  }

  const registrar = async (c: Cliente, req: FastifyRequest, acao: string, detalhe = '') =>
    c.query('insert into admin_registro (admin_email, acao, detalhe) values ($1, $2, $3)', [await emailDe(req.usuarioId!), acao, detalhe.slice(0, 500)])

  return { exigirAdmin, registrar }
}
export type GuardaAdmin = ReturnType<typeof guardaAdmin>

export async function rotasAdmin(app: FastifyInstance, pool: pg.Pool, exigirLogin: Guarda, guarda: GuardaAdmin = guardaAdmin(pool, exigirLogin)) {
  const { exigirAdmin, registrar } = guarda
  const so = { preHandler: exigirAdmin }

  // ---------- Público (site de venda) ----------
  app.get('/api/publico/site', async (_req, rep) => {
    const [conteudo, planos] = await Promise.all([
      pool.query<{ chave: string; valor: string }>('select chave, valor from site_conteudo'),
      pool.query<Linha>('select * from plano where ativo order by ordem, preco'),
    ])
    rep.header('cache-control', 'public, max-age=60')
    return {
      conteudo: Object.fromEntries(conteudo.rows.map((r) => [r.chave, r.valor])),
      planos: planos.rows.map(plano),
      modulos: MODULOS_SERVIDOR,
    }
  })

  app.get('/api/publico/imagens/:id', async (req, rep) => {
    const { id: imagemId } = z.object({ id }).parse(req.params)
    const r = await pool.query<{ tipo: string; dados: Buffer }>('select tipo, dados from site_imagem where id = $1', [imagemId])
    if (!r.rows[0]) return rep.code(404).send({ erro: 'Imagem não encontrada.' })
    return rep
      .header('content-type', r.rows[0].tipo)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'")
      .send(r.rows[0].dados)
  })

  // ---------- Resumo ----------
  app.get('/api/admin/resumo', so, async () =>
    comAdmin(pool, async (c) => {
      const [porSituacao, receita, mes, novos, vencendo] = await sequencia([
        () => c.query<{ situacao: string; n: number }>('select situacao, count(*)::int as n from assinatura group by situacao'),
        // Receita por mês: só quem está ativo ou atrasado (teste ainda não paga).
        () => c.query<{ total: number }>(
          `select coalesce(sum(coalesce(a.valor, p.preco)), 0)::bigint as total
           from assinatura a join plano p on p.id = a.plano_id where a.situacao in ('ativa', 'atrasada')`,
        ),
        () => c.query<{ total: number; n: number }>(
          `select coalesce(sum(valor), 0)::bigint as total, count(*)::int as n from pagamento_assinatura
           where date_trunc('month', pago_em) = date_trunc('month', current_date)`,
        ),
        () => c.query<{ n: number }>("select count(*)::int as n from usuario where criado_em > now() - interval '30 days'"),
        () => c.query<{ n: number; vencidas: number }>(
          `select count(*) filter (where proximo_vencimento between current_date and current_date + 7)::int as n,
                  count(*) filter (where proximo_vencimento < current_date)::int as vencidas
           from assinatura where situacao in ('teste', 'ativa', 'atrasada')`,
        ),
      ] as const)
      const contagem = Object.fromEntries(SITUACOES.map((s) => [s, 0])) as Record<(typeof SITUACOES)[number], number>
      for (const r of porSituacao.rows) contagem[r.situacao as (typeof SITUACOES)[number]] = r.n
      return {
        situacoes: contagem,
        total: Object.values(contagem).reduce((a, b) => a + b, 0),
        receitaMensalCentavos: receita.rows[0].total,
        recebidoNoMesCentavos: mes.rows[0].total,
        pagamentosNoMes: mes.rows[0].n,
        novos30Dias: novos.rows[0].n,
        vencendo7Dias: vencendo.rows[0].n,
        vencidas: vencendo.rows[0].vencidas,
      }
    }),
  )

  // ---------- Assinantes ----------
  app.get('/api/admin/assinantes', so, async () =>
    comAdmin(pool, async (c) => {
      const r = await c.query<Linha>(
        `select u.id, u.nome, u.email, u.telefone_whatsapp, u.criado_em,
                (select max(s.criada_em) from sessao s where s.usuario_id = u.id) as ultimo_acesso,
                e.nome_fantasia, e.cnpj, e.eh_mei, e.uf, e.municipio, e.atividade,
                a.plano_id, a.situacao, a.valor, a.proximo_vencimento, a.observacao,
                p.nome as plano_nome, p.preco as plano_preco,
                (select max(pg.pago_em) from pagamento_assinatura pg where pg.usuario_id = u.id) as ultimo_pagamento
         from usuario u
         left join lateral (select * from empresa where usuario_id = u.id order by criado_em limit 1) e on true
         left join assinatura a on a.usuario_id = u.id
         left join plano p on p.id = a.plano_id
         order by u.criado_em desc`,
      )
      return {
        assinantes: r.rows.map((x) => ({
          id: x.id as string,
          nome: x.nome as string,
          email: x.email as string,
          telefone: (x.telefone_whatsapp as string | null) ?? undefined,
          criadoEm: (x.criado_em as Date).toISOString(),
          ultimoAcesso: x.ultimo_acesso ? (x.ultimo_acesso as Date).toISOString() : undefined,
          negocio: x.nome_fantasia
            ? {
                nome: x.nome_fantasia as string,
                cnpj: (x.cnpj as string | null) ?? undefined,
                ehMei: x.eh_mei as boolean,
                uf: x.uf as string,
                municipio: (x.municipio as string | null) ?? undefined,
                atividade: x.atividade as string,
              }
            : undefined,
          planoId: (x.plano_id as string | null) ?? 'essencial',
          planoNome: (x.plano_nome as string | null) ?? '',
          situacao: (x.situacao as string | null) ?? 'teste',
          valorCentavos: (x.valor as number | null) ?? undefined,
          precoPlanoCentavos: (x.plano_preco as number | null) ?? 0,
          proximoVencimento: (x.proximo_vencimento as string | null) ?? undefined,
          observacao: (x.observacao as string | null) ?? '',
          ultimoPagamento: (x.ultimo_pagamento as string | null) ?? undefined,
        })),
      }
    }),
  )

  app.patch('/api/admin/assinantes/:id', so, async (req, rep) => {
    const { id: usuarioId } = z.object({ id }).parse(req.params)
    const d = esquemaAssinante.parse(req.body)
    const ok = await comAdmin(pool, async (c) => {
      const existe = await c.query('select 1 from usuario where id = $1', [usuarioId])
      if (!existe.rowCount) return false
      await c.query(
        `insert into assinatura (usuario_id, plano_id) values ($1, (select plano_padrao from config_sistema)) on conflict do nothing`,
        [usuarioId],
      )
      const campos: string[] = []
      const valores: unknown[] = [usuarioId]
      const por = (coluna: string, v: unknown) => {
        valores.push(v)
        campos.push(`${coluna} = $${valores.length}`)
      }
      if (d.planoId !== undefined) por('plano_id', d.planoId)
      if (d.situacao !== undefined) por('situacao', d.situacao)
      if (d.valorCentavos !== undefined) por('valor', d.valorCentavos)
      if (d.proximoVencimento !== undefined) por('proximo_vencimento', d.proximoVencimento)
      if (d.observacao !== undefined) por('observacao', d.observacao)
      if (campos.length) await c.query(`update assinatura set ${campos.join(', ')}, atualizado_em = now() where usuario_id = $1`, valores)
      if (d.telefone !== undefined) await c.query('update usuario set telefone_whatsapp = $2, atualizado_em = now() where id = $1', [usuarioId, d.telefone || null])
      await registrar(c, req, 'assinante alterado', `${usuarioId}: ${JSON.stringify(d)}`)
      return true
    })
    if (!ok) return rep.code(404).send({ erro: 'Assinante não encontrado.' })
    return { ok: true }
  })

  app.get('/api/admin/assinantes/:id/pagamentos', so, async (req) => {
    const { id: usuarioId } = z.object({ id }).parse(req.params)
    return comAdmin(pool, async (c) => {
      const r = await c.query<Linha>(
        "select id, valor, pago_em, to_char(referente, 'YYYY-MM') as mes, forma, observacao from pagamento_assinatura where usuario_id = $1 order by pago_em desc, criado_em desc",
        [usuarioId],
      )
      return {
        pagamentos: r.rows.map((x) => ({
          id: x.id as string,
          valorCentavos: x.valor as number,
          pagoEm: x.pago_em as string,
          referente: x.mes as string,
          forma: x.forma as string,
          observacao: x.observacao as string,
        })),
      }
    })
  })

  app.post('/api/admin/assinantes/:id/pagamentos', so, async (req, rep) => {
    const { id: usuarioId } = z.object({ id }).parse(req.params)
    const d = esquemaPagamento.parse(req.body)
    const r = await comAdmin(pool, async (c) => {
      const a = (await c.query<{ proximo_vencimento: string | null }>('select proximo_vencimento from assinatura where usuario_id = $1', [usuarioId])).rows[0]
      if (!a) return null
      const p = await c.query<{ id: string }>(
        'insert into pagamento_assinatura (usuario_id, valor, pago_em, referente, forma, observacao) values ($1, $2, $3, $4, $5, $6) returning id',
        [usuarioId, d.valorCentavos, d.pagoEm, `${d.referente}-01`, d.forma, d.observacao],
      )
      let proximo = a.proximo_vencimento ?? undefined
      if (d.avancarVencimento) {
        proximo = maisUmMes(a.proximo_vencimento ?? d.pagoEm)
        await c.query("update assinatura set situacao = 'ativa', proximo_vencimento = $2, atualizado_em = now() where usuario_id = $1", [usuarioId, proximo])
      }
      await registrar(c, req, 'mensalidade recebida', `${usuarioId}: ${d.valorCentavos} em ${d.pagoEm}`)
      return { id: p.rows[0].id, proximoVencimento: proximo }
    })
    if (!r) return rep.code(404).send({ erro: 'Assinante não encontrado.' })
    return rep.code(201).send(r)
  })

  app.delete('/api/admin/pagamentos/:id', so, async (req, rep) => {
    const { id: pagamentoId } = z.object({ id }).parse(req.params)
    const apagou = await comAdmin(pool, async (c) => {
      const r = await c.query('delete from pagamento_assinatura where id = $1', [pagamentoId])
      if (r.rowCount) await registrar(c, req, 'mensalidade apagada', pagamentoId)
      return !!r.rowCount
    })
    if (!apagou) return rep.code(404).send({ erro: 'Pagamento não encontrado.' })
    return { ok: true }
  })

  // ---------- Planos ----------
  app.get('/api/admin/planos', so, async () =>
    comAdmin(pool, async (c) => {
      const r = await c.query<Linha>(
        `select p.*, (select count(*)::int from assinatura a where a.plano_id = p.id and a.situacao <> 'cancelada') as assinantes
         from plano p order by ordem, preco`,
      )
      return { planos: r.rows.map((x) => ({ ...plano(x), assinantes: x.assinantes as number })), modulos: MODULOS_SERVIDOR }
    }),
  )

  app.post('/api/admin/planos', so, async (req, rep) => {
    const d = esquemaPlano.parse(req.body)
    const r = await comAdmin(pool, async (c) => {
      // O código do plano sai do nome; se já existir, ganha um número no fim.
      const base = slug(d.nome)
      let novoId = base
      for (let i = 2; (await c.query('select 1 from plano where id = $1', [novoId])).rowCount; i++) novoId = `${base}-${i}`
      await c.query('insert into plano (id, nome, descricao, preco, modulos, tem_ia, destaque, ativo, ordem) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
        novoId,
        d.nome,
        d.descricao,
        d.precoCentavos,
        [...new Set(['financeiro', ...d.modulos])],
        d.temIa,
        d.destaque,
        d.ativo,
        d.ordem,
      ])
      await registrar(c, req, 'plano criado', `${novoId}: ${d.nome}`)
      return novoId
    })
    return rep.code(201).send({ id: r })
  })

  app.put('/api/admin/planos/:id', so, async (req, rep) => {
    const { id: planoId } = z.object({ id: z.string().max(40) }).parse(req.params)
    const d = esquemaPlano.parse(req.body)
    const ok = await comAdmin(pool, async (c) => {
      const r = await c.query(
        'update plano set nome = $2, descricao = $3, preco = $4, modulos = $5, tem_ia = $6, destaque = $7, ativo = $8, ordem = $9, atualizado_em = now() where id = $1',
        [planoId, d.nome, d.descricao, d.precoCentavos, [...new Set(['financeiro', ...d.modulos])], d.temIa, d.destaque, d.ativo, d.ordem],
      )
      if (r.rowCount) await registrar(c, req, 'plano alterado', `${planoId}: ${JSON.stringify(d)}`)
      return !!r.rowCount
    })
    if (!ok) return rep.code(404).send({ erro: 'Plano não encontrado.' })
    return { ok: true }
  })

  app.delete('/api/admin/planos/:id', so, async (req, rep) => {
    const { id: planoId } = z.object({ id: z.string().max(40) }).parse(req.params)
    const r = await comAdmin(pool, async (c) => {
      const usado = await c.query("select 1 from assinatura where plano_id = $1 union all select 1 from config_sistema where plano_padrao = $1 limit 1", [planoId])
      if (usado.rowCount) return 'usado'
      const del = await c.query('delete from plano where id = $1', [planoId])
      if (del.rowCount) await registrar(c, req, 'plano apagado', planoId)
      return del.rowCount ? 'ok' : 'nao'
    })
    if (r === 'usado') return rep.code(409).send({ erro: 'Há clientes neste plano (ou ele é o plano dos novos cadastros). Mude-os de plano ou só desative este.' })
    if (r === 'nao') return rep.code(404).send({ erro: 'Plano não encontrado.' })
    return { ok: true }
  })

  // ---------- Site ----------
  app.get('/api/admin/site', so, async () =>
    comAdmin(pool, async (c) => {
      const conteudo = await c.query<{ chave: string; valor: string }>('select chave, valor from site_conteudo')
      const imagens = await c.query<Linha>('select id, nome, tipo, tamanho, criado_em from site_imagem order by criado_em desc')
      return {
        conteudo: Object.fromEntries(conteudo.rows.map((r) => [r.chave, r.valor])),
        imagens: imagens.rows.map((x) => ({ id: x.id as string, nome: x.nome as string, tipo: x.tipo as string, tamanho: x.tamanho as number })),
      }
    }),
  )

  /** Grava só as chaves enviadas. Texto vazio apaga a chave (o site volta ao texto padrão). */
  app.put('/api/admin/site', so, async (req) => {
    const d = z
      .object({ conteudo: z.record(z.string().regex(/^[a-z0-9_.-]{1,80}$/), z.string().max(5000)) })
      .refine((x) => Object.keys(x.conteudo).length <= 300)
      .parse(req.body)
    await comAdmin(pool, async (c) => {
      for (const [chave, valor] of Object.entries(d.conteudo)) {
        if (valor.trim() === '') await c.query('delete from site_conteudo where chave = $1', [chave])
        else
          await c.query('insert into site_conteudo (chave, valor) values ($1, $2) on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()', [
            chave,
            valor,
          ])
      }
      await registrar(c, req, 'site alterado', Object.keys(d.conteudo).join(', '))
    })
    return { ok: true }
  })

  app.post('/api/admin/imagens', { preHandler: exigirAdmin, bodyLimit: 6 * 1024 * 1024 }, async (req, rep) => {
    const d = esquemaImagem.parse(req.body)
    const dados = Buffer.from(d.dados, 'base64')
    if (!dados.length || dados.length > 3 * 1024 * 1024) return rep.code(400).send({ erro: 'A imagem precisa ter até 3 MB.' })
    const confere = TIPOS_IMAGEM[d.tipo]
    if (d.tipo === 'image/svg+xml' ? !svgSeguro(dados.toString('utf8')) : !dados.subarray(0, 4).toString('hex').startsWith(confere))
      return rep.code(400).send({ erro: 'O arquivo não parece ser uma imagem JPG, PNG, WebP ou SVG.' })
    await comAdmin(pool, async (c) => {
      await c.query('insert into site_imagem (id, nome, tipo, tamanho, dados) values ($1, $2, $3, $4, $5)', [d.id, d.nome, d.tipo, dados.length, dados])
      await registrar(c, req, 'imagem enviada', d.nome)
    })
    return rep.code(201).send({ id: d.id, url: `/api/publico/imagens/${d.id}` })
  })

  app.delete('/api/admin/imagens/:id', so, async (req, rep) => {
    const { id: imagemId } = z.object({ id }).parse(req.params)
    const apagou = await comAdmin(pool, async (c) => {
      const r = await c.query('delete from site_imagem where id = $1', [imagemId])
      if (r.rowCount) await registrar(c, req, 'imagem apagada', imagemId)
      return !!r.rowCount
    })
    if (!apagou) return rep.code(404).send({ erro: 'Imagem não encontrada.' })
    return { ok: true }
  })

  // ---------- Configurações e registro ----------
  app.get('/api/admin/config', so, async () => comAdmin(pool, async (c) => ({ config: configSistema((await c.query<Linha>('select * from config_sistema')).rows[0]) })))

  app.put('/api/admin/config', so, async (req, rep) => {
    const d = esquemaConfig.parse(req.body)
    const ok = await comAdmin(pool, async (c) => {
      if (!(await c.query('select 1 from plano where id = $1', [d.planoPadrao])).rowCount) return false
      await c.query(
        'update config_sistema set cadastro_aberto = $1, dias_teste = $2, plano_padrao = $3, ia_ligada = $4, aviso = $5, manutencao = $6, atualizado_em = now()',
        [d.cadastroAberto, d.diasTeste, d.planoPadrao, d.iaLigada, d.aviso, d.manutencao],
      )
      await registrar(c, req, 'configurações alteradas', JSON.stringify(d))
      return true
    })
    if (!ok) return rep.code(400).send({ erro: 'Escolha um plano que exista para os novos cadastros.' })
    return { ok: true }
  })

  app.get('/api/admin/registro', so, async () =>
    comAdmin(pool, async (c) => {
      const r = await c.query<Linha>('select quando, admin_email, acao, detalhe from admin_registro order by quando desc limit 200')
      return { registro: r.rows.map((x) => ({ quando: (x.quando as Date).toISOString(), admin: x.admin_email as string, acao: x.acao as string, detalhe: x.detalhe as string })) }
    }),
  )
}

export interface Acesso {
  assinatura: {
    planoId: string
    planoNome: string
    modulos: string[]
    temIa: boolean
    situacao: (typeof SITUACOES)[number]
    proximoVencimento?: string
  }
  sistema: { aviso: string; manutencao: boolean; iaLigada: boolean }
}

/** Plano e situação da pessoa logada (dentro de comUsuario), mais os avisos gerais do sistema. */
export async function lerAcesso(c: Cliente): Promise<Acesso> {
  // Uma consulta de cada vez: a mesma conexão não roda duas ao mesmo tempo.
  const a = await c.query<Linha>(
    `select a.situacao, a.proximo_vencimento, p.id, p.nome, p.modulos, p.tem_ia
     from assinatura a join plano p on p.id = a.plano_id where a.usuario_id = app_usuario()`,
  )
  const cfg = await c.query<Linha>('select aviso, manutencao, ia_ligada from config_sistema')
  const x = a.rows[0]
  const s = cfg.rows[0] ?? { aviso: '', manutencao: false, ia_ligada: false }
  return {
    assinatura: x
      ? {
          planoId: x.id as string,
          planoNome: x.nome as string,
          modulos: x.modulos as string[],
          temIa: (x.tem_ia as boolean) && (s.ia_ligada as boolean),
          situacao: x.situacao as (typeof SITUACOES)[number],
          proximoVencimento: (x.proximo_vencimento as string | null) ?? undefined,
        }
      : // Conta sem assinatura (não deveria acontecer): tudo liberado, como no teste.
        { planoId: 'essencial', planoNome: 'Essencial', modulos: MODULOS_SERVIDOR.filter((m) => m.pronto).map((m) => m.id), temIa: false, situacao: 'teste' },
    sistema: { aviso: s.aviso as string, manutencao: s.manutencao as boolean, iaLigada: s.ia_ligada as boolean },
  }
}

/** Frase de bloqueio quando a conta não pode gravar (ou undefined quando pode). */
export function bloqueioDeGravacao(acesso: Acesso): string | undefined {
  if (acesso.sistema.manutencao) return 'O sistema está em manutenção. Seus dados estão guardados; tente gravar de novo daqui a pouco.'
  const s = acesso.assinatura.situacao
  if (s === 'suspensa' || s === 'cancelada')
    return `Sua assinatura está ${s}. Você ainda vê e exporta seus dados, mas para gravar fale com a gente e regularize a mensalidade.`
  return undefined
}

export const ehAdmin = async (pool: pg.Pool, usuarioId: string) => {
  const email = (await pool.query<{ email: string }>('select email from usuario where id = $1', [usuarioId])).rows[0]?.email.toLowerCase()
  return !!email && config.adminEmails().includes(email)
}
