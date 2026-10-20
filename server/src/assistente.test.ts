// Testes do assistente contra um Postgres de verdade, com um leitor falso no lugar do serviço de
// IA (nada sai para a internet). Banco próprio: nome do TEST_DATABASE_URL + "_assistente".
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dadosIniciais, type ConfigInicial } from '../../src/data/store'
import { paraNovoNegocio } from '../../src/data/sincronizar'
import { criarApp } from './app.ts'
import { custoMicro, limparResposta, type AcaoAssistente, type LeitorIa, type PedidoAssistente } from './assistente.ts'
import { comAdmin, criarPool } from './db.ts'
import { migrar } from './migrar.ts'

const URL_BASE = process.env.TEST_DATABASE_URL

const config: ConfigInicial = {
  nomeDono: 'Ana',
  nomeFantasia: 'Doces da Ana',
  uf: 'GO',
  ehMei: true,
  mesAbertura: '2024-03',
  atividade: 'comercio',
  saldoBanco: 100000,
  saldoCaixa: 5000,
  dasEmDia: true,
}

const JPEG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex').toString('base64')
const contexto = {
  hoje: '2026-10-19',
  empresa: { nome: 'Doces da Ana', atividade: 'comercio', ehMei: true },
  categorias: [
    { id: 'vendas', nome: 'Vendas', grupo: 'receita' },
    { id: 'transporte', nome: 'Transporte', grupo: 'despesa_variavel' },
  ],
  contas: [
    { id: 'banco', nome: 'Banco', tipo: 'banco' },
    { id: 'caixa', nome: 'Caixa', tipo: 'caixa' },
  ],
  abertas: [{ id: 'luz-out', natureza: 'saida', descricao: 'Luz', valorCentavos: 18000, vencimento: '2026-10-20' }],
}

const acao = (x: Partial<AcaoAssistente>): AcaoAssistente => ({
  tipo: 'lancamento',
  natureza: 'saida',
  situacao: 'realizado',
  valorCentavos: 4500,
  data: '2026-10-19',
  vencimento: null,
  categoriaId: 'transporte',
  contaId: 'caixa',
  formaPagamento: 'dinheiro',
  descricao: 'Gasolina',
  contraparte: 'Posto Avenida',
  parceiroId: null,
  pagoComDinheiroPessoal: false,
  fotoComprovante: null,
  lancamentoId: null,
  hora: null,
  duracaoMin: null,
  telefone: null,
  ...x,
})

describe('limparResposta', () => {
  const pedido = { texto: '', anexos: [{ tipo: 'image/jpeg', dados: JPEG }], historico: [], contexto: { ...contexto, parceiros: [], resumo: '', agenda: false } } as PedidoAssistente
  it('apaga ids que não existem e tira itens sem valor ou que não cabem', () => {
    const r = limparResposta(
      {
        resposta: 'Preparei.',
        acoes: [
          acao({ categoriaId: 'vendas', contaId: 'inventada', fotoComprovante: 0 }),
          acao({ valorCentavos: 0 }),
          acao({ tipo: 'baixa', lancamentoId: 'nao-existe' }),
          acao({ tipo: 'baixa', lancamentoId: 'luz-out', valorCentavos: 18000 }),
          acao({ tipo: 'atendimento', hora: '14:00' }),
          acao({ situacao: 'previsto', vencimento: 'amanhã' }),
          acao({ fotoComprovante: 3, data: 'ontem' }),
        ],
      },
      pedido,
    )
    expect(r.acoes).toHaveLength(4)
    // Categoria de receita numa saída não vale; conta inventada some; a foto 0 existe.
    expect(r.acoes[0]).toMatchObject({ categoriaId: null, contaId: null, fotoComprovante: 0 })
    expect(r.acoes[1]).toMatchObject({ tipo: 'baixa', lancamentoId: 'luz-out' })
    // Previsto sem data de vencimento válida vira realizado.
    expect(r.acoes[2]).toMatchObject({ situacao: 'realizado', vencimento: null })
    expect(r.acoes[3]).toMatchObject({ fotoComprovante: null, data: '2026-10-19' })
  })
  it('custo estimado pelo preço do modelo', () => {
    expect(custoMicro('claude-opus-5-5', 1_000_000, 0)).toBe(4_000_000)
    expect(custoMicro('claude-haiku-5-5', 10_000, 1_000)).toBe(1_500)
  })
})

describe.skipIf(!URL_BASE)('assistente no servidor', () => {
  let pool: pg.Pool
  let app: Awaited<ReturnType<typeof criarApp>>
  const pedidos: PedidoAssistente[] = []
  let falhar = false
  const leitor: LeitorIa = async ({ pedido }) => {
    if (falhar) throw new Error('fora do ar')
    pedidos.push(pedido)
    return { modelo: 'claude-opus-5-5', tokensEntrada: 3000, tokensSaida: 400, resposta: { resposta: 'Preparei 1 saída. Confira.', acoes: [acao({ fotoComprovante: pedido.anexos.length ? 0 : null })] } }
  }

  beforeAll(async () => {
    const base = new URL(URL_BASE!)
    const nome = `${base.pathname.slice(1)}_assistente`
    const adm = new pg.Client({ connectionString: URL_BASE })
    await adm.connect()
    if (!(await adm.query('select 1 from pg_database where datname = $1', [nome])).rowCount) await adm.query(`create database ${adm.escapeIdentifier(nome)}`)
    await adm.end()
    const url = new URL(URL_BASE!)
    url.pathname = `/${nome}`
    const limpar = new pg.Client({ connectionString: url.toString() })
    await limpar.connect()
    await limpar.query('drop schema public cascade; create schema public')
    await limpar.end()
    await migrar(url.toString(), 'senha-de-teste').catch(() => migrar(url.toString(), 'senha-de-teste'))
    url.username = 'gynfinance_app'
    url.password = 'senha-de-teste'
    pool = criarPool(url.toString())
    app = await criarApp(pool, { site: false, leitorIa: leitor })
  })
  afterAll(async () => {
    await app?.close()
    await pool?.end()
  })

  let n = 0
  async function criarConta(email: string) {
    const r = await app.inject({ method: 'POST', url: '/api/conta/criar', remoteAddress: `10.2.0.${++n}`, payload: { nome: 'Ana', email, senha: 'senha-forte-1', aceiteTermos: true } })
    expect(r.statusCode).toBe(201)
    return { gyn_sessao: r.cookies.find((x) => x.name === 'gyn_sessao')!.value }
  }
  const pedir = (cookies: Record<string, string>, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) => app.inject({ method, url, cookies, payload: payload as object, remoteAddress: '10.2.1.1' })
  const corpo = (extra: Record<string, unknown> = {}) => ({ texto: 'gastei 45 de gasolina', contexto, ...extra })

  it('só funciona com a IA ligada, no plano com IA, com chave; conta o uso e respeita o limite do dia', async () => {
    const ana = await criarConta('ana@exemplo.com')
    expect((await pedir(ana, 'POST', '/api/negocio', paraNovoNegocio(dadosIniciais(config, '2026-10-19')))).statusCode).toBe(201)
    const igor = await criarConta('igor@kodemi.pt')
    process.env.ADMIN_EMAILS = 'igor@kodemi.pt'
    delete process.env.ANTHROPIC_API_KEY

    // Desligada no Superadmin.
    let r = await pedir(ana, 'POST', '/api/assistente', corpo())
    expect(r.statusCode).toBe(403)
    expect(r.json().erro).toMatch(/desligado/)

    await comAdmin(pool, (c) => c.query('update config_sistema set ia_ligada = true'))
    r = await pedir(ana, 'POST', '/api/assistente', corpo())
    expect(r.json().erro).toMatch(/plano/)

    await comAdmin(pool, (c) => c.query("update plano set tem_ia = true where id = 'essencial'"))
    r = await pedir(ana, 'POST', '/api/assistente', corpo())
    expect(r.statusCode).toBe(503)

    // Cliente não mexe na configuração; o superadmin salva chave, modelo e limite.
    expect((await pedir(ana, 'GET', '/api/admin/ia')).statusCode).toBe(403)
    expect((await pedir(igor, 'PUT', '/api/admin/ia', { chave: 'sk-ant-teste-abcd', modelo: 'claude-haiku-5-5', limiteDia: 2 })).statusCode).toBe(200)
    const cfg = (await pedir(igor, 'GET', '/api/admin/ia')).json().ia
    expect(cfg).toMatchObject({ origemChave: 'painel', finalChave: 'abcd', modelo: 'claude-haiku-5-5', limiteDia: 2 })
    expect(JSON.stringify(cfg)).not.toContain('sk-ant-teste')

    // O cliente não consegue ler a chave nem pelo banco.
    const lida = await pool.connect()
    try {
      await lida.query('begin')
      expect((await lida.query('select * from ia_config')).rowCount).toBe(0)
      await lida.query('rollback')
    } finally {
      lida.release()
    }

    r = await pedir(ana, 'POST', '/api/assistente', corpo({ anexos: [{ tipo: 'image/jpeg', dados: JPEG }] }))
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ resposta: 'Preparei 1 saída. Confira.', acoes: [{ natureza: 'saida', valorCentavos: 4500, fotoComprovante: 0 }] })
    expect(pedidos.at(-1)?.anexos).toHaveLength(1)

    // Arquivo que não é foto é recusado antes de sair para a leitura.
    r = await pedir(ana, 'POST', '/api/assistente', corpo({ anexos: [{ tipo: 'image/jpeg', dados: Buffer.from('nao sou foto').toString('base64') }] }))
    expect(r.statusCode).toBe(400)

    // Falha do serviço: mensagem simples e não conta no limite.
    falhar = true
    r = await pedir(ana, 'POST', '/api/assistente', corpo())
    expect(r.statusCode).toBe(502)
    falhar = false

    expect((await pedir(ana, 'POST', '/api/assistente', corpo())).statusCode).toBe(200)
    r = await pedir(ana, 'POST', '/api/assistente', corpo())
    expect(r.statusCode).toBe(429)
    expect(r.json().erro).toMatch(/limite do dia/)

    const uso = (await pedir(igor, 'GET', '/api/admin/ia')).json().ia.uso
    expect(uso.hoje).toMatchObject({ pedidos: 2, fotos: 1, clientes: 1 })
    expect(uso.mes.custoMicro).toBe(2 * custoMicro('claude-opus-5-5', 3000, 400))

    // Apagar a chave volta a deixar o assistente sem configuração.
    await pedir(igor, 'PUT', '/api/admin/ia', { chave: null, modelo: 'claude-opus-5-5', limiteDia: 0 })
    expect((await pedir(igor, 'GET', '/api/admin/ia')).json().ia.origemChave).toBe('nenhuma')
  })
})
