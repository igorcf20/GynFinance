// Testes do suporte (chamados e erros registrados) contra um Postgres de verdade. Usam um banco
// próprio (nome do TEST_DATABASE_URL + "_suporte"), criado aqui se não existir, para rodar ao
// mesmo tempo que app.test.ts sem um apagar o banco do outro.
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dadosIniciais, type ConfigInicial } from '../../src/data/store'
import { paraNovoNegocio } from '../../src/data/sincronizar'
import { uid } from '../../src/lib/format'
import { criarApp } from './app.ts'
import { criarPool } from './db.ts'
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

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')
const JPEG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex')
const contexto = { pagina: '/lancamentos', paginaNome: 'Lançamentos', navegador: 'Mozilla/5.0 (Android 14)', tela: '390x844', plataforma: 'android', versao: '1.2.0', online: true }

describe.skipIf(!URL_BASE)('suporte', () => {
  let pool: pg.Pool
  let app: Awaited<ReturnType<typeof criarApp>>

  beforeAll(async () => {
    const base = new URL(URL_BASE!)
    const nome = `${base.pathname.slice(1)}_suporte`
    const admin = new pg.Client({ connectionString: URL_BASE })
    await admin.connect()
    if (!(await admin.query('select 1 from pg_database where datname = $1', [nome])).rowCount) await admin.query(`create database ${admin.escapeIdentifier(nome)}`)
    await admin.end()
    const url = new URL(URL_BASE!)
    url.pathname = `/${nome}`
    const limpar = new pg.Client({ connectionString: url.toString() })
    await limpar.connect()
    await limpar.query('drop schema public cascade; create schema public')
    await limpar.end()
    // O usuário gynfinance_app é do servidor de banco inteiro: se o outro arquivo de teste o criar
    // ao mesmo tempo, a primeira tentativa pode esbarrar nele.
    await migrar(url.toString(), 'senha-de-teste').catch(() => migrar(url.toString(), 'senha-de-teste'))
    url.username = 'gynfinance_app'
    url.password = 'senha-de-teste'
    pool = criarPool(url.toString())
    app = await criarApp(pool, { site: false })
    process.env.ADMIN_EMAILS = 'suporte@gynfinance.com.br'
  })
  afterAll(async () => {
    await app?.close()
    await pool?.end()
  })

  let contas = 0
  async function criarConta(email: string, nome = 'Ana') {
    const r = await app.inject({ method: 'POST', url: '/api/conta/criar', remoteAddress: `10.1.0.${++contas}`, payload: { nome, email, senha: 'senha-forte-1', aceiteTermos: true } })
    expect(r.statusCode).toBe(201)
    return { gyn_sessao: r.cookies.find((x) => x.name === 'gyn_sessao')!.value }
  }
  const pedir = (cookies: Record<string, string>, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) =>
    app.inject({ method, url, cookies, payload: payload as object })
  const novoTicket = (extra: Record<string, unknown> = {}) => ({
    id: uid(),
    assunto: 'Saldo não bate',
    categoria: 'problema',
    texto: 'O saldo do banco ficou diferente do extrato.',
    contato: '(62) 99999-0000',
    contexto,
    erros: [{ quando: '2026-10-16T12:00:00.000Z', origem: 'tela', mensagem: 'Cannot read properties of undefined', pilha: 'at Lancamentos (x.js:1:2)', pagina: '/lancamentos' }],
    anexos: [{ id: uid(), nome: 'tela.png', tipo: 'image/png', dados: PNG.toString('base64') }],
    ...extra,
  })

  it('chamado: cliente abre com foto, a equipe responde e o cliente vê só o que deve', async () => {
    const ana = await criarConta('ana@exemplo.com', 'Ana Souza')
    expect((await pedir(ana, 'POST', '/api/negocio', paraNovoNegocio(dadosIniciais(config, '2026-10-16')))).statusCode).toBe(201)
    const igor = await criarConta('suporte@gynfinance.com.br', 'Igor')

    // Perfil mandado pelo navegador é ignorado: o servidor monta pela conta.
    const corpo = novoTicket({ perfil: { nome: 'Falso', email: 'falso@x.com' } })
    const criado = await pedir(ana, 'POST', '/api/suporte/tickets', corpo)
    expect(criado.statusCode).toBe(201)
    expect(criado.json()).toEqual({ id: corpo.id, numero: expect.any(Number) })
    // Envio repetido (internet caiu) devolve o mesmo chamado.
    expect((await pedir(ana, 'POST', '/api/suporte/tickets', corpo)).json()).toEqual(criado.json())

    const lista = (await pedir(ana, 'GET', '/api/suporte/tickets')).json()
    expect(lista).toMatchObject({ naoLidos: 0, tickets: [{ id: corpo.id, situacao: 'aberto', naoLido: false, totalMensagens: 1, pagina: '/lancamentos', paginaNome: 'Lançamentos' }] })
    expect(lista.tickets[0].cliente).toBeUndefined()

    const t = (await pedir(ana, 'GET', `/api/suporte/tickets/${corpo.id}`)).json().ticket
    expect(t).toMatchObject({
      assunto: 'Saldo não bate',
      categoria: 'problema',
      prioridade: 'normal',
      contato: '(62) 99999-0000',
      contexto,
      erros: [{ origem: 'tela', mensagem: 'Cannot read properties of undefined', pagina: '/lancamentos' }],
      perfil: {
        nome: 'Ana Souza',
        email: 'ana@exemplo.com',
        negocio: { nome: 'Doces da Ana', ehMei: true, uf: 'GO', atividade: 'comercio' },
        plano: 'Essencial',
        situacaoAssinatura: 'teste',
      },
    })
    expect(t.mensagens).toHaveLength(1)
    expect(t.mensagens[0]).toMatchObject({ autor: 'cliente', autorNome: 'Ana Souza', interna: false, texto: corpo.texto })
    const foto = t.mensagens[0].anexos[0]
    expect(foto).toEqual({ id: corpo.anexos[0].id, nome: 'tela.png', tipo: 'image/png', tamanho: PNG.length, url: `api/suporte/anexos/${corpo.anexos[0].id}` })
    const arquivo = await pedir(ana, 'GET', `/${foto.url}`)
    expect(arquivo.statusCode).toBe(200)
    expect(arquivo.headers['content-type']).toBe('image/png')
    expect(arquivo.headers['x-content-type-options']).toBe('nosniff')
    expect(arquivo.rawPayload.equals(PNG)).toBe(true)

    // Outra pessoa não lê o chamado, a foto nem responde.
    const bia = await criarConta('bia@exemplo.com')
    expect((await pedir(bia, 'GET', `/api/suporte/tickets/${corpo.id}`)).statusCode).toBe(404)
    expect((await pedir(bia, 'GET', `/${foto.url}`)).statusCode).toBe(404)
    expect((await pedir(bia, 'POST', `/api/suporte/tickets/${corpo.id}/mensagens`, { id: uid(), texto: 'oi', anexos: [] })).statusCode).toBe(404)
    expect((await pedir(bia, 'POST', `/api/suporte/tickets/${corpo.id}/resolver`)).statusCode).toBe(404)
    expect((await pedir(bia, 'GET', '/api/suporte/tickets')).json()).toEqual({ tickets: [], naoLidos: 0 })
    expect((await pedir(bia, 'GET', '/api/admin/suporte')).statusCode).toBe(403)
    expect((await pedir(bia, 'GET', '/api/admin/erros')).statusCode).toBe(403)

    // Painel: aparece como não lido, com quem abriu.
    const painel = (await pedir(igor, 'GET', '/api/admin/suporte')).json()
    expect(painel.naoLidos).toBe(1)
    expect(painel.contagem).toEqual({ aberto: 1, em_andamento: 0, aguardando_cliente: 0, resolvido: 0 })
    expect(painel.tickets[0]).toMatchObject({ id: corpo.id, naoLido: true, cliente: { nome: 'Ana Souza', email: 'ana@exemplo.com', negocio: 'Doces da Ana' } })
    expect((await pedir(igor, 'GET', '/api/admin/suporte?busca=doces')).json().tickets).toHaveLength(1)
    expect((await pedir(igor, 'GET', `/api/admin/suporte?busca=%23${criado.json().numero}`)).json().tickets).toHaveLength(1)
    expect((await pedir(igor, 'GET', '/api/admin/suporte?busca=nada-a-ver')).json().tickets).toHaveLength(0)
    expect((await pedir(igor, 'GET', '/api/admin/suporte?situacao=resolvido')).json().tickets).toHaveLength(0)

    const aberto = (await pedir(igor, 'GET', `/api/admin/suporte/${corpo.id}`)).json()
    expect(aberto.outros).toBe(0)
    expect(aberto.ticket.naoLido).toBe(false)
    expect(aberto.ticket.mensagens[0].anexos[0].url).toBe(`api/admin/suporte/anexos/${corpo.anexos[0].id}`)
    expect((await pedir(igor, 'GET', `/${aberto.ticket.mensagens[0].anexos[0].url}`)).rawPayload.equals(PNG)).toBe(true)
    expect((await pedir(igor, 'GET', '/api/admin/suporte')).json().naoLidos).toBe(0)

    // Nota interna (com foto): o cliente não vê nem a nota nem a foto.
    const nota = { id: uid(), texto: 'Parece o arredondamento do extrato.', interna: true, anexos: [{ id: uid(), nome: 'log.jpg', tipo: 'image/jpeg', dados: JPEG.toString('base64') }] }
    expect((await pedir(igor, 'POST', `/api/admin/suporte/${corpo.id}/mensagens`, nota)).statusCode).toBe(201)
    expect((await pedir(igor, 'PATCH', `/api/admin/suporte/${corpo.id}`, { prioridade: 'alta', situacao: 'em_andamento' })).statusCode).toBe(200)
    let visto = (await pedir(ana, 'GET', `/api/suporte/tickets/${corpo.id}`)).json().ticket
    expect(visto.mensagens).toHaveLength(1)
    expect(visto).toMatchObject({ situacao: 'em_andamento', prioridade: 'alta', naoLido: false, totalMensagens: 1 })
    expect((await pedir(ana, 'GET', `/api/suporte/anexos/${nota.anexos[0].id}`)).statusCode).toBe(404)

    // Resposta pública: chega como não lida e o chamado fica aguardando o cliente.
    const resposta = { id: uid(), texto: 'Oi Ana! Já corrigimos, confere de novo?', anexos: [] }
    expect((await pedir(igor, 'POST', `/api/admin/suporte/${corpo.id}/mensagens`, resposta)).json()).toEqual({ id: resposta.id })
    const listaAna = (await pedir(ana, 'GET', '/api/suporte/tickets')).json()
    expect(listaAna).toMatchObject({ naoLidos: 1, tickets: [{ naoLido: true, situacao: 'aguardando_cliente', totalMensagens: 2, ultimaMensagem: { autor: 'suporte', texto: resposta.texto } }] })
    expect((await pedir(ana, 'GET', '/api/conta')).json().suporte).toEqual({ naoLidos: 1 })
    visto = (await pedir(ana, 'GET', `/api/suporte/tickets/${corpo.id}`)).json().ticket
    expect(visto.mensagens.map((m: { autor: string; autorNome: string }) => [m.autor, m.autorNome])).toEqual([
      ['cliente', 'Ana Souza'],
      ['suporte', 'Equipe Gynfinance'],
    ])
    expect((await pedir(ana, 'GET', '/api/conta')).json().suporte).toEqual({ naoLidos: 0 })

    // No painel a nota interna aparece.
    const doPainel = (await pedir(igor, 'GET', `/api/admin/suporte/${corpo.id}`)).json().ticket
    expect(doPainel.mensagens.map((m: { interna: boolean }) => m.interna)).toEqual([false, true, false])

    // Cliente responde: volta para aberto e fica não lido para a equipe.
    const volta = { id: uid(), texto: 'Ainda não bateu.', anexos: [{ id: uid(), nome: 'extrato.jpg', tipo: 'image/jpeg', dados: JPEG.toString('base64') }] }
    expect((await pedir(ana, 'POST', `/api/suporte/tickets/${corpo.id}/mensagens`, volta)).statusCode).toBe(201)
    const painel2 = (await pedir(igor, 'GET', '/api/admin/suporte')).json()
    expect(painel2).toMatchObject({ naoLidos: 1, tickets: [{ situacao: 'aberto', naoLido: true, ultimaMensagem: { autor: 'cliente' } }] })

    // Resolver.
    expect((await pedir(ana, 'POST', `/api/suporte/tickets/${corpo.id}/resolver`)).json()).toEqual({ ok: true })
    expect((await pedir(igor, 'GET', '/api/admin/suporte?situacao=resolvido')).json().tickets).toHaveLength(1)
    expect((await pedir(igor, 'GET', '/api/admin/registro')).json().registro.map((r: { acao: string }) => r.acao)).toContain('chamado respondido')

    // Um segundo chamado da mesma pessoa conta em "outros".
    expect((await pedir(ana, 'POST', '/api/suporte/tickets', novoTicket({ anexos: [], erros: [] }))).statusCode).toBe(201)
    expect((await pedir(igor, 'GET', `/api/admin/suporte/${corpo.id}`)).json().outros).toBe(1)
  })

  it('chamado: recusa foto falsa e dados inválidos, e funciona com a assinatura suspensa', async () => {
    const zeca = await criarConta('zeca@exemplo.com', 'Zeca')
    const falsa = await pedir(zeca, 'POST', '/api/suporte/tickets', novoTicket({ anexos: [{ id: uid(), nome: 'virus.png', tipo: 'image/png', dados: Buffer.from('<script>alert(1)</script>').toString('base64') }] }))
    expect(falsa.statusCode).toBe(400)
    expect(falsa.json().erro).toBe('A foto "virus.png" não parece ser uma imagem JPG, PNG ou WebP.')
    expect((await pedir(zeca, 'POST', '/api/suporte/tickets', novoTicket({ assunto: 'oi' }))).statusCode).toBe(400)
    expect((await pedir(zeca, 'POST', '/api/suporte/tickets', novoTicket({ categoria: 'xingamento' }))).statusCode).toBe(400)
    const seis = Array.from({ length: 6 }, () => ({ id: uid(), nome: 'a.png', tipo: 'image/png', dados: PNG.toString('base64') }))
    expect((await pedir(zeca, 'POST', '/api/suporte/tickets', novoTicket({ anexos: seis }))).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/api/suporte/tickets', payload: novoTicket() })).statusCode).toBe(401)

    // Sem negócio e com a assinatura suspensa ainda dá para pedir ajuda.
    const igor = await criarConta('suporte2@exemplo.com')
    process.env.ADMIN_EMAILS = 'suporte@gynfinance.com.br,suporte2@exemplo.com'
    const zecaId = (await pedir(igor, 'GET', '/api/admin/assinantes')).json().assinantes.find((x: { email: string }) => x.email === 'zeca@exemplo.com').id
    expect((await pedir(igor, 'PATCH', `/api/admin/assinantes/${zecaId}`, { situacao: 'suspensa' })).statusCode).toBe(200)
    const corpo = novoTicket({ categoria: 'financeiro', anexos: [], contato: undefined })
    expect((await pedir(zeca, 'POST', '/api/suporte/tickets', corpo)).statusCode).toBe(201)
    const t = (await pedir(zeca, 'GET', `/api/suporte/tickets/${corpo.id}`)).json().ticket
    expect(t.perfil).toEqual({ nome: 'Zeca', email: 'zeca@exemplo.com', plano: 'Essencial', situacaoAssinatura: 'suspensa' })
    expect(t.contato).toBeUndefined()
  })

  it('erros: registra com e sem login, agrupa no painel e some ao resolver', async () => {
    const lia = await criarConta('lia@exemplo.com')
    const igor = await criarConta('suporte3@exemplo.com')
    process.env.ADMIN_EMAILS = 'suporte3@exemplo.com'
    const erro = { quando: new Date().toISOString(), origem: 'script', mensagem: 'x is not a function\n    at y', pilha: 'at y (a.js:1:1)', pagina: '/agenda' }
    const env = await pedir(lia, 'POST', '/api/suporte/erros', { erros: [erro], contexto: { ...contexto, pagina: '/agenda' } })
    expect(env.statusCode).toBe(204)
    expect((await app.inject({ method: 'POST', url: '/api/suporte/erros', payload: { erros: [{ ...erro, mensagem: 'x is not a function\n    at z' }] } })).statusCode).toBe(204)
    expect((await app.inject({ method: 'POST', url: '/api/suporte/erros', payload: { erros: [] } })).statusCode).toBe(400)

    const { grupos } = (await pedir(igor, 'GET', '/api/admin/erros')).json()
    const g = grupos.find((x: { pagina: string }) => x.pagina === '/agenda')
    expect(g).toMatchObject({ origem: 'script', vezes: 2, pessoas: 1, resolvido: false })
    expect(g.chave).toMatch(/^[0-9a-f]{16}$/)
    expect((await pedir(igor, 'POST', `/api/admin/erros/${g.chave}/resolver`)).json()).toEqual({ ok: true })
    expect((await pedir(igor, 'GET', '/api/admin/erros')).json().grupos.find((x: { chave: string }) => x.chave === g.chave)).toBeUndefined()
    expect((await pedir(igor, 'GET', '/api/admin/erros?resolvidos=1')).json().grupos.find((x: { chave: string }) => x.chave === g.chave)).toMatchObject({ resolvido: true })
    expect((await pedir(igor, 'POST', '/api/admin/erros/0000000000000000/resolver')).statusCode).toBe(404)

    // Ninguém lê os erros sem ser o painel, nem com SQL direto.
    expect((await pool.query('select count(*)::int as n from erro_app')).rows[0].n).toBe(0)
  })

  it('erro 500 do servidor aparece no painel', async () => {
    const igor = await criarConta('suporte4@exemplo.com')
    process.env.ADMIN_EMAILS = 'suporte4@exemplo.com'
    // Banco recusando uma consulta no meio do pedido: vira 500 e é registrado.
    const original = pool.query.bind(pool)
    let quebrou = false
    ;(pool as unknown as { query: unknown }).query = (...args: Parameters<typeof original>) => {
      if (!quebrou && typeof args[0] === 'string' && args[0].startsWith('select 1')) {
        quebrou = true
        return Promise.reject(new Error('banco fora do ar'))
      }
      return original(...args)
    }
    expect((await app.inject({ method: 'GET', url: '/api/saude' })).statusCode).toBe(500)
    ;(pool as unknown as { query: unknown }).query = original
    let grupo: { origem: string; pagina: string } | undefined
    for (let i = 0; i < 20 && !grupo; i++) {
      grupo = (await pedir(igor, 'GET', '/api/admin/erros')).json().grupos.find((x: { mensagem: string }) => x.mensagem === 'banco fora do ar')
      if (!grupo) await new Promise((r) => setTimeout(r, 50))
    }
    expect(grupo).toMatchObject({ origem: 'servidor', pagina: 'GET /api/saude' })
  })
})
