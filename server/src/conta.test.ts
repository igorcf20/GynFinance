// Testes da base legal e da segurança da conta (termos com versão e aceite, LGPD, registro de
// acessos, travas) contra um Postgres de verdade, num banco próprio (TEST_DATABASE_URL + "_conta").
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dadosIniciais, type ConfigInicial } from '../../src/data/store'
import { paraNovoNegocio } from '../../src/data/sincronizar'
import { criarApp } from './app.ts'
import { limparVencidos, preencherTexto } from './conta.ts'
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

it('textos legais: troca os dados da empresa e marca o que falta', () => {
  const t = preencherTexto('{{empresa.nome}}, {{empresa.cnpj}}, {{contato.whatsapp}}, {{atendimento.horario}}', { 'empresa.cnpj': '12.345.678/0001-90', 'atendimento.horario': 'Segunda a sexta' })
  expect(t).toBe('KodeMI, 12.345.678/0001-90, +351914125381, segunda a sexta')
  expect(preencherTexto('{{contato.email}}', {})).toBe('(a informar)')
})

describe.skipIf(!URL_BASE)('conta e base legal', () => {
  let pool: pg.Pool
  let urlAdmin: string
  let app: Awaited<ReturnType<typeof criarApp>>

  beforeAll(async () => {
    const nome = `${new URL(URL_BASE!).pathname.slice(1)}_conta`
    const admin = new pg.Client({ connectionString: URL_BASE })
    await admin.connect()
    if (!(await admin.query('select 1 from pg_database where datname = $1', [nome])).rowCount) await admin.query(`create database ${admin.escapeIdentifier(nome)}`)
    await admin.end()
    const url = new URL(URL_BASE!)
    url.pathname = `/${nome}`
    urlAdmin = url.toString()
    const limpar = new pg.Client({ connectionString: urlAdmin })
    await limpar.connect()
    await limpar.query('drop schema public cascade; create schema public')
    await limpar.end()
    // O usuário do banco é compartilhado com os outros arquivos de teste: se colidir, tenta de novo.
    await migrar(urlAdmin, 'senha-de-teste').catch(() => migrar(urlAdmin, 'senha-de-teste'))
    url.username = 'gynfinance_app'
    url.password = 'senha-de-teste'
    pool = criarPool(url.toString())
    app = await criarApp(pool, { site: false })
  })
  afterAll(async () => {
    await app?.close()
    await pool?.end()
  })

  const comoAdmin = async <T,>(sql: string, params: unknown[] = []) => {
    const c = new pg.Client({ connectionString: urlAdmin })
    await c.connect()
    try {
      return (await c.query<T & pg.QueryResultRow>(sql, params)).rows
    } finally {
      await c.end()
    }
  }

  let contas = 0
  async function criarConta(email: string, senha = 'senha-forte-1') {
    const lista = process.env.ADMIN_EMAILS
    process.env.ADMIN_EMAILS = ''
    const r = await app.inject({ method: 'POST', url: '/api/conta/criar', remoteAddress: `10.2.0.${++contas}`, payload: { nome: 'Ana', email, senha, aceiteTermos: true } })
    process.env.ADMIN_EMAILS = lista
    expect(r.statusCode).toBe(201)
    return { gyn_sessao: r.cookies.find((x) => x.name === 'gyn_sessao')!.value }
  }
  const pedir = (cookies: Record<string, string>, method: 'GET' | 'POST', url: string, payload?: unknown) => app.inject({ method, url, cookies, payload: payload as object })
  const entrar = (email: string, senha: string, ip = '10.9.9.9') => app.inject({ method: 'POST', url: '/api/conta/entrar', remoteAddress: ip, payload: { email, senha } })

  it('cadastro grava qual versão dos termos e da política foi aceita, e o acesso', async () => {
    const ana = await criarConta('ana@exemplo.com')
    expect((await pedir(ana, 'GET', '/api/conta')).json().aceitesPendentes).toEqual([])
    const aceites = await comoAdmin<{ tipo: string; versao: string; ip: string }>(
      "select d.tipo, d.versao, a.ip from aceite_documento a join documento_legal d on d.id = a.documento_id join usuario u on u.id = a.usuario_id where u.email = 'ana@exemplo.com' order by d.tipo",
    )
    expect(aceites).toEqual([
      { tipo: 'privacidade', versao: '2026-10-19', ip: expect.stringMatching(/^10\.2\.0\./) },
      { tipo: 'termos', versao: '2026-10-19', ip: expect.stringMatching(/^10\.2\.0\./) },
    ])
    const acessos = await comoAdmin<{ evento: string }>("select evento from registro_acesso r join usuario u on u.id = r.usuario_id where u.email = 'ana@exemplo.com'")
    expect(acessos.map((a) => a.evento)).toEqual(['cadastro'])
  })

  it('página pública dos termos sai com os dados da empresa', async () => {
    await comoAdmin("insert into site_conteudo (chave, valor) values ('empresa.cnpj', '12.345.678/0001-90')")
    const r = await app.inject({ method: 'GET', url: '/api/publico/legal/termos' })
    expect(r.statusCode).toBe(200)
    const doc = r.json()
    expect(doc).toMatchObject({ tipo: 'termos', titulo: 'Termos de Uso', versao: '2026-10-19' })
    expect(doc.texto).toContain('KodeMI, documento 12.345.678/0001-90')
    expect(doc.texto).not.toContain('{{')
    expect((await app.inject({ method: 'GET', url: '/api/publico/legal/outro' })).statusCode).toBe(400)
  })

  it('versão nova publicada pelo admin pede novo aceite de quem já tem conta', async () => {
    const bia = await criarConta('bia@exemplo.com')
    const igor = await criarConta('igor@exemplo.com')
    process.env.ADMIN_EMAILS = 'igor@exemplo.com'
    expect((await pedir(bia, 'POST', '/api/admin/legal', { tipo: 'termos', texto: 'x'.repeat(200) })).statusCode).toBe(403)
    const texto = `# Termos novos\n\n${'Texto dos termos. '.repeat(20)}`
    const pub = await pedir(igor, 'POST', '/api/admin/legal', { tipo: 'termos', texto })
    expect(pub.statusCode).toBe(201)
    expect((await pedir(igor, 'POST', '/api/admin/legal', { tipo: 'termos', texto })).statusCode).toBe(400)
    expect((await pedir(bia, 'GET', '/api/conta')).json().aceitesPendentes).toEqual([{ tipo: 'termos', versao: pub.json().versao, titulo: 'Termos de Uso' }])
    expect((await pedir(bia, 'POST', '/api/conta/aceitar')).statusCode).toBe(200)
    expect((await pedir(bia, 'GET', '/api/conta')).json().aceitesPendentes).toEqual([])
    const lista = (await pedir(igor, 'GET', '/api/admin/legal')).json().documentos
    expect(lista.find((d: { versao: string; tipo: string }) => d.tipo === 'termos' && d.versao === pub.json().versao)).toMatchObject({ aceites: 1, publicadoPor: 'igor@exemplo.com' })
  })

  it('e-mail de superadmin não se cadastra pelo site', async () => {
    process.env.ADMIN_EMAILS = 'dono@exemplo.com'
    const r = await app.inject({ method: 'POST', url: '/api/conta/criar', remoteAddress: '10.3.0.1', payload: { nome: 'Intruso', email: 'Dono@Exemplo.com', senha: 'senha-forte-1', aceiteTermos: true } })
    expect(r.statusCode).toBe(403)
  })

  it('senha errada demais trava aquele e-mail, mesmo trocando de endereço', async () => {
    await criarConta('caio@exemplo.com')
    for (let i = 0; i < 8; i++) expect((await entrar('caio@exemplo.com', 'errada', `10.4.0.${i}`)).statusCode).toBe(401)
    expect((await entrar('caio@exemplo.com', 'senha-forte-1', '10.4.1.1')).statusCode).toBe(429)
    // Outro e-mail segue normal.
    await criarConta('dani@exemplo.com')
    expect((await entrar('dani@exemplo.com', 'senha-forte-1', '10.4.1.2')).statusCode).toBe(200)
  })

  it('IP inventado em X-Forwarded-For não escapa do limite de tentativas', async () => {
    let ultimo = 0
    for (let i = 0; i < 12; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/conta/entrar',
        remoteAddress: '127.0.0.1',
        headers: { 'x-forwarded-for': `1.1.1.${i}, 200.200.200.200` },
        payload: { email: `ninguem${i}@exemplo.com`, senha: 'x' },
      })
      ultimo = r.statusCode
    }
    expect(ultimo).toBe(429)
  })

  it('cabeçalhos de segurança e nada de cache nas respostas da conta', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/conta' })
    expect(r.headers['x-frame-options']).toBe('DENY')
    expect(r.headers['x-content-type-options']).toBe('nosniff')
    expect(r.headers['cache-control']).toBe('no-store')
    expect((await app.inject({ method: 'POST', url: '/api/conta/sair', headers: { origin: 'null' } })).statusCode).toBe(403)
  })

  it('troca de senha tira os outros aparelhos e mantém este', async () => {
    const aqui = await criarConta('edu@exemplo.com')
    const outro = { gyn_sessao: (await entrar('edu@exemplo.com', 'senha-forte-1', '10.5.0.1')).cookies.find((c) => c.name === 'gyn_sessao')!.value }
    expect((await pedir(aqui, 'POST', '/api/conta/senha', { atual: 'errada', nova: 'senha-nova-123' })).statusCode).toBe(400)
    expect((await pedir(aqui, 'POST', '/api/conta/senha', { atual: 'senha-forte-1', nova: 'senha-nova-123' })).statusCode).toBe(200)
    expect((await pedir(aqui, 'GET', '/api/conta')).statusCode).toBe(200)
    expect((await pedir(outro, 'GET', '/api/conta')).statusCode).toBe(401)
    expect((await entrar('edu@exemplo.com', 'senha-nova-123', '10.5.0.2')).statusCode).toBe(200)
  })

  it('pedido de cancelamento vira chamado com protocolo', async () => {
    const fabi = await criarConta('fabi@exemplo.com')
    const r = await pedir(fabi, 'POST', '/api/conta/cancelamento', { motivo: 'Fechei a loja.' })
    expect(r.statusCode).toBe(200)
    expect(r.json().protocolo).toBeGreaterThan(0)
    const t = (await pedir(fabi, 'GET', `/api/suporte/tickets/${r.json().ticketId}`)).json().ticket
    expect(t).toMatchObject({ assunto: 'Pedido de cancelamento da assinatura', categoria: 'financeiro' })
    expect(t.mensagens[0].texto).toContain('Fechei a loja.')
    const [a] = await comoAdmin<{ pedido: boolean }>("select cancelamento_pedido_em is not null as pedido from assinatura a join usuario u on u.id = a.usuario_id where u.email = 'fabi@exemplo.com'")
    expect(a.pedido).toBe(true)
  })

  it('baixar meus dados e excluir a conta (LGPD)', async () => {
    const gabi = await criarConta('gabi@exemplo.com')
    expect((await pedir(gabi, 'POST', '/api/negocio', paraNovoNegocio(dadosIniciais(config, '2026-10-16')))).statusCode).toBe(201)
    await comoAdmin(
      "insert into pagamento_assinatura (usuario_id, valor, pago_em, referente) select id, 2500, '2026-10-10', '2026-10-01' from usuario where email = 'gabi@exemplo.com'",
    )
    const arq = await pedir(gabi, 'GET', '/api/conta/meus-dados')
    expect(arq.statusCode).toBe(200)
    expect(arq.headers['content-disposition']).toMatch(/^attachment; filename="gynfinance-meus-dados-/)
    const dados = arq.json()
    expect(dados.conta).toMatchObject({ nome: 'Ana', email: 'gabi@exemplo.com' })
    expect(dados.negocio.empresa.nomeFantasia).toBe('Doces da Ana')
    expect(dados.pagamentos).toHaveLength(1)
    expect(dados.aceites).toHaveLength(2)
    expect(dados.acessos[0]).toMatchObject({ evento: 'cadastro' })

    expect((await pedir(gabi, 'POST', '/api/conta/excluir', { senha: 'errada' })).statusCode).toBe(400)
    expect((await pedir(gabi, 'POST', '/api/conta/excluir', { senha: 'senha-forte-1' })).statusCode).toBe(200)
    expect((await pedir(gabi, 'GET', '/api/conta')).statusCode).toBe(401)
    expect((await entrar('gabi@exemplo.com', 'senha-forte-1', '10.6.0.1')).statusCode).toBe(401)
    expect(await comoAdmin("select 1 from empresa where nome_fantasia = 'Doces da Ana' and usuario_id not in (select id from usuario)")).toHaveLength(0)
    // Fica só o que a lei manda: mensalidades pagas e os registros de acesso.
    const [ex] = await comoAdmin<{ email: string; pagamentos: unknown[] }>("select email, pagamentos from conta_excluida where email = 'gabi@exemplo.com'")
    expect(ex.pagamentos).toEqual([{ valor: 2500, pagoEm: '2026-10-10', referente: '2026-10-01', forma: 'pix' }])
    const acessos = await comoAdmin<{ evento: string }>("select r.evento from registro_acesso r join conta_excluida c on c.usuario_id = r.usuario_id where c.email = 'gabi@exemplo.com' order by r.em")
    expect(acessos.map((a) => a.evento)).toEqual(['cadastro', 'conta excluida'])
  })

  it('limpeza diária apaga só o que passou do prazo', async () => {
    await comoAdmin("insert into registro_acesso (evento, ip, em) values ('entrada', '1.2.3.4', now() - interval '7 months'), ('entrada', '1.2.3.5', now() - interval '5 months')")
    await limparVencidos(pool)
    const ips = (await comoAdmin<{ ip: string }>("select ip from registro_acesso where ip in ('1.2.3.4', '1.2.3.5')")).map((r) => r.ip)
    expect(ips).toEqual(['1.2.3.5'])
  })
})
