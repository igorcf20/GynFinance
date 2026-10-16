// Testes do servidor contra um Postgres de verdade. Rodam só com TEST_DATABASE_URL apontando
// para um banco vazio de teste (administrador), por exemplo:
// TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5499/gyn_teste npm test
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dadosIniciais, type ConfigInicial } from '../../src/data/store'
import { diferencas, paraNovoNegocio } from '../../src/data/sincronizar'
import type { Dados, Lancamento } from '../../src/domain/types'
import { gerarPrevistos } from '../../src/domain/recorrencia'
import { salvarAtendimento } from '../../src/domain/agenda'
import { aplicarImportacao, prepararImportacao } from '../../src/domain/extrato'
import { uid } from '../../src/lib/format'
import { criarApp } from './app.ts'
import { criarPool } from './db.ts'
import { MODULOS } from '../../src/domain/planos'
import { maisUmMes } from './admin.ts'
import { MODULOS_SERVIDOR } from './modulos.ts'
import { migrar } from './migrar.ts'
import { enviarLembretes, agoraBrasilia, type Carteiro, type Email } from './email.ts'

const URL_ADMIN = process.env.TEST_DATABASE_URL

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

// Carteiro de teste: guarda os e-mails em vez de enviar.
const caixa: Email[] = []
const carteiro: Carteiro = { ligado: true, enviar: async (e) => void caixa.push(e) }

describe.skipIf(!URL_ADMIN)('servidor', () => {
  let pool: pg.Pool
  let app: Awaited<ReturnType<typeof criarApp>>

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: URL_ADMIN })
    await admin.connect()
    await admin.query('drop schema public cascade; create schema public')
    await admin.end()
    // suporte.test roda junto e mexe no mesmo usuário do banco: se colidir, tenta de novo.
    await migrar(URL_ADMIN!, 'senha-de-teste').catch(() => migrar(URL_ADMIN!, 'senha-de-teste'))
    const u = new URL(URL_ADMIN!)
    u.username = 'gynfinance_app'
    u.password = 'senha-de-teste'
    pool = criarPool(u.toString())
    app = await criarApp(pool, { site: false, carteiro })
  })
  afterAll(async () => {
    await app?.close()
    await pool?.end()
  })

  let contas = 0
  async function criarConta(email: string) {
    // Cada conta vem de um endereço diferente, para não esbarrar no limite de 10 cadastros por minuto.
    const r = await app.inject({ method: 'POST', url: '/api/conta/criar', remoteAddress: `10.0.0.${++contas}`, payload: { nome: 'Ana', email, senha: 'senha-forte-1', aceiteTermos: true } })
    expect(r.statusCode).toBe(201)
    const c = r.cookies.find((x) => x.name === 'gyn_sessao')!
    return { gyn_sessao: c.value }
  }
  const pedir = (cookies: Record<string, string>, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown) => app.inject({ method, url, cookies, payload: payload as object })

  it('o servidor não ignora as regras de acesso', async () => {
    const r = await pool.query<{ rolsuper: boolean; rolbypassrls: boolean }>('select rolsuper, rolbypassrls from pg_roles where rolname = current_user')
    expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false })
  })

  it('conta: criar, repetir e-mail, entrar, senha errada, sair', async () => {
    await criarConta('ana@exemplo.com')
    const dup = await app.inject({ method: 'POST', url: '/api/conta/criar', payload: { nome: 'Outra', email: 'ANA@exemplo.com', senha: 'outra-senha-9', aceiteTermos: true } })
    expect(dup.statusCode).toBe(409)
    const errada = await app.inject({ method: 'POST', url: '/api/conta/entrar', payload: { email: 'ana@exemplo.com', senha: 'nao-e-essa' } })
    expect(errada.statusCode).toBe(401)
    const certa = await app.inject({ method: 'POST', url: '/api/conta/entrar', payload: { email: 'Ana@Exemplo.com', senha: 'senha-forte-1' } })
    expect(certa.statusCode).toBe(200)
    const cookies = { gyn_sessao: certa.cookies.find((x) => x.name === 'gyn_sessao')!.value }
    expect((await pedir(cookies, 'GET', '/api/conta')).json()).toMatchObject({
      usuario: { nome: 'Ana', email: 'ana@exemplo.com' },
      temNegocio: false,
      admin: false,
      assinatura: { planoId: 'essencial', situacao: 'teste', modulos: ['financeiro', 'mei', 'agenda', 'extrato', 'comprovantes'], temIa: false },
      sistema: { aviso: '', manutencao: false },
    })
    await pedir(cookies, 'POST', '/api/conta/sair')
    expect((await pedir(cookies, 'GET', '/api/conta')).statusCode).toBe(401)
    expect((await app.inject({ method: 'GET', url: '/api/dados' })).statusCode).toBe(401)
  })

  it('negócio: cria pela configuração inicial e guarda o que muda no app', async () => {
    const ana = await criarConta('ana2@exemplo.com')
    expect((await pedir(ana, 'GET', '/api/dados')).json()).toEqual({ dados: null })

    const inicial = dadosIniciais(config, '2026-10-16')
    const criado = await pedir(ana, 'POST', '/api/negocio', paraNovoNegocio(inicial))
    expect(criado.statusCode).toBe(201)
    const doServidor: Dados = criado.json().dados
    expect(doServidor).toEqual(inicial)

    // Uma venda, uma conta fixa com os previstos gerados e o DAS de outubro pago.
    const banco = inicial.contas.find((c) => c.tipo === 'banco')!.id
    const venda: Lancamento = {
      id: uid(), empresaId: inicial.empresa.id, natureza: 'entrada', valor: 35000, categoriaId: 'vendas', contaFinanceiraId: banco,
      situacao: 'realizado', dataCompetencia: '2026-10-16', dataPagamento: '2026-10-16', formaPagamento: 'pix', notaEmitida: 'sim', contraparte: 'Maria',
    }
    const rec = {
      id: uid(), empresaId: inicial.empresa.id, frequencia: 'mensal' as const, diaVencimento: 20, inicio: '2026-10-20', seFimDeSemana: 'manter' as const,
      valorVaria: false, ativa: true, modelo: { natureza: 'saida' as const, valor: 120000, categoriaId: 'aluguel', contaFinanceiraId: banco, formaPagamento: 'boleto' as const, descricao: 'Aluguel' },
    }
    const gerado = gerarPrevistos([rec], [venda], '2026-10-16', uid)
    const depois: Dados = {
      ...inicial,
      lancamentos: [venda, ...gerado.novos],
      recorrencias: gerado.recorrencias,
      pagamentosDas: [...inicial.pagamentosDas, { empresaId: inicial.empresa.id, competencia: '2026-10', valor: 8205, vencimento: '2026-10-20', pagoForaDoSistema: true }],
      empresa: { ...inicial.empresa, municipio: 'Goiânia' },
      avisosDispensados: ['das:2026-10'],
    }
    const r = await pedir(ana, 'POST', '/api/sincronizar', diferencas(inicial, depois))
    expect(r.statusCode).toBe(200)
    const lido: Dados = (await pedir(ana, 'GET', '/api/dados')).json().dados
    expect(lido.lancamentos).toHaveLength(3)
    expect(lido).toEqual(depois)

    // Editar a conta fixa: os previstos antigos saem e novos entram no mesmo mês, num envio só.
    const editado: Dados = {
      ...depois,
      lancamentos: [venda, ...gerado.novos.map((l) => ({ ...l, id: uid(), valor: 130000 }))],
    }
    expect((await pedir(ana, 'POST', '/api/sincronizar', diferencas(depois, editado))).statusCode).toBe(200)
    const lido2: Dados = (await pedir(ana, 'GET', '/api/dados')).json().dados
    expect(lido2.lancamentos.map((l) => l.valor).sort((a, b) => a - b)).toEqual([35000, 130000, 130000])
  })

  it('uma pessoa não lê nem altera o negócio de outra', async () => {
    const ana = await criarConta('ana3@exemplo.com')
    const inicial = dadosIniciais(config, '2026-10-16')
    await pedir(ana, 'POST', '/api/negocio', paraNovoNegocio(inicial))
    const banco = inicial.contas.find((c) => c.tipo === 'banco')!.id
    const venda: Lancamento = { id: uid(), empresaId: inicial.empresa.id, natureza: 'entrada', valor: 1000, categoriaId: 'vendas', contaFinanceiraId: banco, situacao: 'realizado', dataCompetencia: '2026-10-16', dataPagamento: '2026-10-16', formaPagamento: 'pix', notaEmitida: 'sim' }
    await pedir(ana, 'POST', '/api/sincronizar', { lancamentos: { salvar: [venda], excluir: [] } })

    const bia = await criarConta('bia@exemplo.com')
    expect((await pedir(bia, 'GET', '/api/dados')).json()).toEqual({ dados: null })
    const outro = dadosIniciais({ ...config, nomeFantasia: 'Bia Modas' }, '2026-10-16')
    await pedir(bia, 'POST', '/api/negocio', paraNovoNegocio(outro))
    // Tentar regravar a venda da Ana com a conta da Ana: recusado.
    const tentativa = await pedir(bia, 'POST', '/api/sincronizar', { lancamentos: { salvar: [{ ...venda, valor: 1 }], excluir: [] } })
    expect(tentativa.statusCode).toBe(400)
    // Com uma conta da Bia: o banco recusa mexer numa linha de outra empresa.
    const contaBia = outro.contas[0].id
    const tentativa2 = await pedir(bia, 'POST', '/api/sincronizar', { lancamentos: { salvar: [{ ...venda, valor: 1, contaFinanceiraId: contaBia }], excluir: [] } })
    expect([400, 403]).toContain(tentativa2.statusCode)
    await pedir(bia, 'POST', '/api/sincronizar', { lancamentos: { salvar: [], excluir: [venda.id] } })

    const daAna: Dados = (await pedir(ana, 'GET', '/api/dados')).json().dados
    expect(daAna.lancamentos).toEqual([venda])
    expect((await pedir(bia, 'GET', '/api/dados')).json().dados.lancamentos).toEqual([])
  })

  it('comprovante: guarda, liga ao pagamento e só a empresa dona abre', async () => {
    const ana = await criarConta('ana5@exemplo.com')
    const inicial = dadosIniciais(config, '2026-10-16')
    await pedir(ana, 'POST', '/api/negocio', paraNovoNegocio(inicial))
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')
    const comp = { id: uid(), nome: 'recibo luz.png', tipo: 'image/png', dados: png.toString('base64') }
    expect((await pedir(ana, 'POST', '/api/comprovantes', comp)).statusCode).toBe(201)
    // Conteúdo que não é foto nem PDF é recusado, mesmo dizendo que é.
    const falso = await pedir(ana, 'POST', '/api/comprovantes', { ...comp, id: uid(), tipo: 'application/pdf', dados: Buffer.from('<script>').toString('base64') })
    expect(falso.statusCode).toBe(400)

    const banco = inicial.contas.find((c) => c.tipo === 'banco')!.id
    const pago: Lancamento = {
      id: uid(), empresaId: inicial.empresa.id, natureza: 'saida', valor: 9000, categoriaId: 'luz', contaFinanceiraId: banco, situacao: 'realizado',
      dataCompetencia: '2026-10-10', dataVencimento: '2026-10-10', dataPagamento: '2026-10-12', formaPagamento: 'pix', notaEmitida: 'nao_se_aplica',
      comprovante: { id: comp.id, nome: comp.nome, tipo: comp.tipo, tamanho: png.length }, observacao: 'pago com juros', parcela: { numero: 1, total: 2 },
    }
    const resto: Lancamento = { ...pago, id: uid(), situacao: 'previsto', dataPagamento: undefined, comprovante: undefined, observacao: undefined, parcelaDe: pago.id, parcela: { numero: 2, total: 2 }, dataVencimento: '2026-11-10' }
    expect((await pedir(ana, 'POST', '/api/sincronizar', { lancamentos: { salvar: [pago, resto], excluir: [] } })).statusCode).toBe(200)
    const lido: Dados = (await pedir(ana, 'GET', '/api/dados')).json().dados
    expect(lido.lancamentos).toEqual([pago, resto])

    const arquivo = await pedir(ana, 'GET', `/api/comprovantes/${comp.id}`)
    expect(arquivo.statusCode).toBe(200)
    expect(arquivo.headers['content-type']).toBe('image/png')
    expect(arquivo.rawPayload.equals(png)).toBe(true)

    const bia = await criarConta('bia2@exemplo.com')
    const outro = dadosIniciais({ ...config, nomeFantasia: 'Bia Modas' }, '2026-10-16')
    await pedir(bia, 'POST', '/api/negocio', paraNovoNegocio(outro))
    expect((await pedir(bia, 'GET', `/api/comprovantes/${comp.id}`)).statusCode).toBe(404)
    const contaBia = outro.contas[0].id
    const pegar = await pedir(bia, 'POST', '/api/sincronizar', { lancamentos: { salvar: [{ ...pago, id: uid(), empresaId: outro.empresa.id, contaFinanceiraId: contaBia }], excluir: [] } })
    expect(pegar.statusCode).toBe(400)
  })

  it('agenda e extrato: atendimento com conta a receber, cancelamento e importação', async () => {
    const ana = await criarConta('ana6@exemplo.com')
    const inicial: Dados = (await pedir(ana, 'POST', '/api/negocio', paraNovoNegocio(dadosIniciais(config, '2026-10-16')))).json().dados
    expect(inicial.atendimentos).toEqual([])
    const sync = async (antes: Dados, depois: Dados) => {
      const r = await pedir(ana, 'POST', '/api/sincronizar', diferencas(antes, depois))
      expect(r.statusCode).toBe(200)
      const lido: Dados = (await pedir(ana, 'GET', '/api/dados')).json().dados
      expect(lido).toEqual(depois)
      return lido
    }
    const at = { cliente: 'Lia', telefone: '(62) 99999-0000', servico: 'Corte', data: '2026-10-20', inicio: '14:30', duracaoMin: 45, situacao: 'agendado' as const, valor: 8000 }
    const id = uid()
    const marcado = await sync(inicial, salvarAtendimento(inicial, at, id, true, uid))
    const contaId = marcado.atendimentos[0].lancamentoId!
    expect(marcado.lancamentos.find((l) => l.id === contaId)).toMatchObject({ situacao: 'previsto', valor: 8000, contraparte: 'Lia' })

    // Cancelar tira a conta a receber e o atendimento fica sem ela, num envio só.
    const cancelado = await sync(marcado, salvarAtendimento(marcado, { ...at, situacao: 'cancelado' }, id, true, uid))
    expect(cancelado.lancamentos).toEqual([])

    // Extrato: dois movimentos novos; importar de novo não duplica.
    const banco = inicial.contas.find((c) => c.tipo === 'banco')!.id
    const movs = [
      { ref: 'ofx-1', data: '2026-10-16', valor: 48050, descricao: 'PIX RECEBIDO MARIA' },
      { ref: 'ofx-2', data: '2026-10-17', valor: -1290, descricao: 'TARIFA PACOTE' },
    ]
    const importado = await sync(cancelado, aplicarImportacao(cancelado, banco, prepararImportacao(cancelado, banco, movs), uid))
    expect(importado.lancamentos.map((l) => [l.refExtrato, l.categoriaId])).toEqual([
      ['ofx-1', 'vendas'],
      ['ofx-2', 'tarifas'],
    ])
    expect(prepararImportacao(importado, banco, movs).every((l) => l.acao === 'repetido')).toBe(true)
  })

  it('recusa pedido de outro site e dados inválidos', async () => {
    const ana = await criarConta('ana4@exemplo.com')
    const r = await app.inject({ method: 'POST', url: '/api/sincronizar', cookies: ana, headers: { origin: 'https://site-malicioso.com', host: 'app.gynfinance.com.br' }, payload: {} })
    expect(r.statusCode).toBe(403)
    const inval = await pedir(ana, 'POST', '/api/negocio', { empresa: { nomeFantasia: '' } })
    expect(inval.statusCode).toBe(400)
  })

  it('superadmin: só quem está em ADMIN_EMAILS entra e não vê lançamentos', async () => {
    process.env.ADMIN_EMAILS = 'igor@exemplo.com'
    const cliente = await criarConta('cliente@exemplo.com')
    expect((await pedir(cliente, 'GET', '/api/admin/resumo')).statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: '/api/admin/assinantes' })).statusCode).toBe(401)

    const igor = await criarConta('igor@exemplo.com')
    expect((await pedir(igor, 'GET', '/api/conta')).json().admin).toBe(true)
    const lista = (await pedir(igor, 'GET', '/api/admin/assinantes')).json().assinantes
    const c = lista.find((x: { email: string }) => x.email === 'cliente@exemplo.com')
    expect(c).toMatchObject({ planoId: 'essencial', situacao: 'teste', precoPlanoCentavos: 2500 })

    // Mesmo com o superadmin ligado, o pedido normal do admin só vê o próprio negócio.
    expect((await pedir(igor, 'GET', '/api/dados')).json()).toEqual({ dados: null })
    // E a transação de admin não lê lançamentos de ninguém.
    const k = await pool.connect()
    await k.query("select set_config('app.superadmin', 'on', false)")
    expect((await k.query('select count(*)::int as n from lancamento')).rows[0].n).toBe(0)
    await k.query("select set_config('app.superadmin', '', false)")
    k.release()
  })

  it('superadmin: planos, assinatura, mensalidade e bloqueio', async () => {
    process.env.ADMIN_EMAILS = 'igor2@exemplo.com'
    const igor = await criarConta('igor2@exemplo.com')
    const bia = await criarConta('bia.admin@exemplo.com')
    const inicial = dadosIniciais(config, '2026-10-16')
    expect((await pedir(bia, 'POST', '/api/negocio', paraNovoNegocio(inicial))).statusCode).toBe(201)
    const biaId = (await pedir(igor, 'GET', '/api/admin/assinantes')).json().assinantes.find((x: { email: string }) => x.email === 'bia.admin@exemplo.com').id
    expect((await pedir(igor, 'GET', '/api/admin/assinantes')).json().assinantes.find((x: { id: string }) => x.id === biaId).negocio).toMatchObject({ nome: 'Doces da Ana', uf: 'GO' })

    // Plano sem agenda: o servidor recusa atendimento.
    const novo = await pedir(igor, 'POST', '/api/admin/planos', { nome: 'Básico', descricao: 'Só o financeiro', precoCentavos: 1500, modulos: ['mei'], temIa: false, destaque: false, ativo: true, ordem: 0 })
    expect(novo.json()).toEqual({ id: 'basico' })
    expect((await pedir(igor, 'PATCH', `/api/admin/assinantes/${biaId}`, { planoId: 'basico', situacao: 'ativa', telefone: '62999990000' })).statusCode).toBe(200)
    expect((await pedir(bia, 'GET', '/api/conta')).json().assinatura).toMatchObject({ planoId: 'basico', modulos: ['financeiro', 'mei'], situacao: 'ativa' })
    const banco = inicial.contas.find((k) => k.tipo === 'banco')!.id
    const comAgenda = salvarAtendimento(inicial, { cliente: 'Lia', data: '2026-10-20', inicio: '10:00', duracaoMin: 60, situacao: 'agendado' }, uid(), false, uid)
    const recusado = await pedir(bia, 'POST', '/api/sincronizar', diferencas(inicial, comAgenda))
    expect(recusado.statusCode).toBe(403)
    expect(recusado.json().erro).toMatch(/agenda/)

    // Mensalidade recebida: fica ativa e o vencimento anda um mês.
    await pedir(igor, 'PATCH', `/api/admin/assinantes/${biaId}`, { proximoVencimento: '2026-10-31', situacao: 'atrasada' })
    const pago = await pedir(igor, 'POST', `/api/admin/assinantes/${biaId}/pagamentos`, { valorCentavos: 1500, pagoEm: '2026-10-16', referente: '2026-10', forma: 'pix' })
    expect(pago.json().proximoVencimento).toBe('2026-11-30')
    expect((await pedir(igor, 'GET', `/api/admin/assinantes/${biaId}/pagamentos`)).json().pagamentos).toHaveLength(1)
    expect((await pedir(igor, 'GET', '/api/admin/resumo')).json()).toMatchObject({ recebidoNoMesCentavos: 1500, pagamentosNoMes: 1 })
    expect((await pedir(igor, 'DELETE', '/api/admin/planos/basico')).statusCode).toBe(409)

    // Suspensa: vê os dados, não grava.
    await pedir(igor, 'PATCH', `/api/admin/assinantes/${biaId}`, { situacao: 'suspensa' })
    const venda: Lancamento = {
      id: uid(), empresaId: inicial.empresa.id, natureza: 'entrada', valor: 1000, categoriaId: 'vendas', contaFinanceiraId: banco,
      situacao: 'realizado', dataCompetencia: '2026-10-16', dataPagamento: '2026-10-16', formaPagamento: 'pix', notaEmitida: 'nao',
    }
    const bloqueado = await pedir(bia, 'POST', '/api/sincronizar', diferencas(inicial, { ...inicial, lancamentos: [venda] }))
    expect(bloqueado.statusCode).toBe(403)
    expect(bloqueado.json().bloqueado).toBe(true)
    expect((await pedir(bia, 'GET', '/api/dados')).statusCode).toBe(200)
    // Refazer a configuração inicial não tira a suspensão.
    expect((await pedir(bia, 'POST', '/api/negocio', paraNovoNegocio(inicial))).statusCode).toBe(403)
    // Cliente não grava a própria assinatura nem com SQL direto.
    await expect(pool.query("update assinatura set situacao = 'ativa'")).resolves.toMatchObject({ rowCount: 0 })
  })

  it('superadmin: site, imagens e configurações', async () => {
    process.env.ADMIN_EMAILS = 'igor3@exemplo.com'
    const igor = await criarConta('igor3@exemplo.com')
    expect((await pedir(igor, 'PUT', '/api/admin/site', { conteudo: { 'hero.titulo': 'Seu dinheiro em ordem', 'contato.whatsapp': '5562999990000' } })).statusCode).toBe(200)
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64')
    const img = await pedir(igor, 'POST', '/api/admin/imagens', { id: uid(), nome: 'logo.png', tipo: 'image/png', dados: png })
    expect(img.statusCode).toBe(201)
    const falso = await pedir(igor, 'POST', '/api/admin/imagens', { id: uid(), nome: 'x.svg', tipo: 'image/svg+xml', dados: Buffer.from('<svg onload="alert(1)"/>').toString('base64') })
    expect(falso.statusCode).toBe(400)
    const pub = (await app.inject({ method: 'GET', url: '/api/publico/site' })).json()
    expect(pub.conteudo).toMatchObject({ 'hero.titulo': 'Seu dinheiro em ordem', 'contato.whatsapp': '5562999990000' })
    expect(pub.planos.map((p: { id: string }) => p.id)).toContain('essencial')
    expect((await app.inject({ method: 'GET', url: img.json().url })).headers['content-type']).toBe('image/png')
    // Texto vazio volta ao padrão.
    await pedir(igor, 'PUT', '/api/admin/site', { conteudo: { 'hero.titulo': '' } })
    expect((await app.inject({ method: 'GET', url: '/api/publico/site' })).json().conteudo['hero.titulo']).toBeUndefined()

    // Cadastro fechado e manutenção.
    const cfg = { cadastroAberto: false, diasTeste: 14, planoPadrao: 'essencial', iaLigada: false, aviso: 'Manutenção às 22h', manutencao: false }
    expect((await pedir(igor, 'PUT', '/api/admin/config', cfg)).statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: '/api/conta/criar', payload: { nome: 'Zé', email: 'ze@exemplo.com', senha: 'senha-forte-1', aceiteTermos: true } })).statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: '/api/publico/site' })).json().cadastroAberto).toBe(false)
    expect((await pedir(igor, 'GET', '/api/conta')).json().sistema.aviso).toBe('Manutenção às 22h')
    await pedir(igor, 'PUT', '/api/admin/config', { ...cfg, cadastroAberto: true, aviso: '' })
    expect((await pedir(igor, 'GET', '/api/admin/registro')).json().registro.length).toBeGreaterThan(2)
  })

  it('esqueci minha senha: link por e-mail, uma vez só, e derruba as sessões antigas', async () => {
    const velha = await criarConta('esqueci@exemplo.com')
    const nada = await app.inject({ method: 'POST', url: '/api/conta/esqueci', payload: { email: 'ninguem@exemplo.com' } })
    expect(nada.json()).toEqual({ ok: true, emailLigado: true })
    const antes = caixa.length
    await app.inject({ method: 'POST', url: '/api/conta/esqueci', payload: { email: 'Esqueci@Exemplo.com' } })
    expect(caixa.length).toBe(antes + 1)
    const email = caixa.at(-1)!
    expect(email.para).toBe('esqueci@exemplo.com')
    const codigo = /codigo=([\w-]+)/.exec(email.texto)![1]
    const curta = await app.inject({ method: 'POST', url: '/api/conta/redefinir', payload: { codigo, senha: '123' } })
    expect(curta.statusCode).toBe(400)
    const ok = await app.inject({ method: 'POST', url: '/api/conta/redefinir', payload: { codigo, senha: 'senha-nova-123' } })
    expect(ok.statusCode).toBe(200)
    expect((await pedir(velha, 'GET', '/api/conta')).statusCode).toBe(401)
    const de_novo = await app.inject({ method: 'POST', url: '/api/conta/redefinir', payload: { codigo, senha: 'outra-senha-123' } })
    expect(de_novo.statusCode).toBe(400)
    const entra = await app.inject({ method: 'POST', url: '/api/conta/entrar', payload: { email: 'esqueci@exemplo.com', senha: 'senha-nova-123' } })
    expect(entra.statusCode).toBe(200)
  })

  it('lembretes por e-mail: conta no dia escolhido, sem lembrete, a receber e DAS, sem repetir', async () => {
    const ana = await criarConta('lembra@exemplo.com')
    const inicial = dadosIniciais(config, '2026-10-16')
    await pedir(ana, 'POST', '/api/negocio', paraNovoNegocio(inicial))
    const banco = inicial.contas.find((k) => k.tipo === 'banco')!.id
    const conta = (valor: number, venc: string, extra: Partial<Lancamento> = {}): Lancamento => ({
      id: uid(), empresaId: inicial.empresa.id, natureza: 'saida', valor, categoriaId: 'aluguel', contaFinanceiraId: banco, situacao: 'previsto',
      dataCompetencia: venc, dataVencimento: venc, formaPagamento: 'boleto', notaEmitida: 'nao_se_aplica', descricao: `Conta ${valor}`, ...extra,
    })
    const depois: Dados = {
      ...inicial,
      lancamentos: [
        conta(10000, '2026-11-16'), // padrão do negócio: 1 dia antes (dia 15)
        conta(20000, '2026-11-18', { lembreteDias: 3 }), // 3 dias antes: dia 15
        conta(30000, '2026-11-15', { lembreteDias: -1 }), // sem lembrete
        conta(40000, '2026-11-15', { natureza: 'entrada', categoriaId: 'vendas', contraparte: 'Maria', descricao: undefined }),
      ],
    }
    expect((await pedir(ana, 'POST', '/api/sincronizar', diferencas(inicial, depois))).statusCode).toBe(200)
    const antes = caixa.length
    // Dia 15: além das contas, o DAS de novembro (não pago) vence dia 20.
    expect(await enviarLembretes(pool, carteiro, '2026-11-15')).toBeGreaterThanOrEqual(1)
    const meu = caixa.slice(antes).find((e) => e.para === 'lembra@exemplo.com')!
    expect(meu.texto).toContain('Vence amanhã: Conta 10000, R$ 100.')
    expect(meu.texto).toContain('Vence em 3 dias (18/11): Conta 20000, R$ 200.')
    expect(meu.texto).not.toContain('Conta 30000')
    expect(meu.texto).toContain('Maria paga hoje: R$ 400.')
    expect(meu.texto).toContain('DAS de 11/2026 vence dia 20')
    // Rodar de novo no mesmo dia não manda outra vez.
    const n = caixa.length
    await enviarLembretes(pool, carteiro, '2026-11-15')
    expect(caixa.slice(n).some((e) => e.para === 'lembra@exemplo.com')).toBe(false)
    // Aviso por e-mail desligado em Configurações: nada sai.
    await pedir(ana, 'POST', '/api/sincronizar', { preferencias: { lembreteDias: 1, lembreteEmail: false, resumoMensal: true } })
    const m = caixa.length
    await enviarLembretes(pool, carteiro, '2026-11-17')
    expect(caixa.slice(m).some((e) => e.para === 'lembra@exemplo.com')).toBe(false)
    // O servidor (sem login) não lê lançamentos fora dessas funções.
    expect((await pool.query('select count(*)::int as n from lancamento')).rows[0].n).toBe(0)
  })
})

describe('superadmin sem banco', () => {
  it('a lista de módulos do servidor é a mesma do app', () => {
    expect(MODULOS_SERVIDOR).toEqual(MODULOS)
  })
  it('vencimento anda um mês', () => {
    expect(maisUmMes('2026-01-31')).toBe('2026-02-28')
    expect(maisUmMes('2026-12-10')).toBe('2027-01-10')
  })
  it('hora de Brasília', () => {
    expect(agoraBrasilia(new Date('2026-10-16T02:30:00Z'))).toEqual({ hoje: '2026-10-15', hora: 23 })
  })
})
