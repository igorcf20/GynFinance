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
import { migrar } from './migrar.ts'

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

describe.skipIf(!URL_ADMIN)('servidor', () => {
  let pool: pg.Pool
  let app: Awaited<ReturnType<typeof criarApp>>

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: URL_ADMIN })
    await admin.connect()
    await admin.query('drop schema public cascade; create schema public')
    await admin.end()
    await migrar(URL_ADMIN!, 'senha-de-teste')
    const u = new URL(URL_ADMIN!)
    u.username = 'gynfinance_app'
    u.password = 'senha-de-teste'
    pool = criarPool(u.toString())
    app = await criarApp(pool, { site: false })
  })
  afterAll(async () => {
    await app?.close()
    await pool?.end()
  })

  async function criarConta(email: string) {
    const r = await app.inject({ method: 'POST', url: '/api/conta/criar', payload: { nome: 'Ana', email, senha: 'senha-forte-1', aceiteTermos: true } })
    expect(r.statusCode).toBe(201)
    const c = r.cookies.find((x) => x.name === 'gyn_sessao')!
    return { gyn_sessao: c.value }
  }
  const pedir = (cookies: Record<string, string>, method: 'GET' | 'POST', url: string, payload?: unknown) => app.inject({ method, url, cookies, payload: payload as object })

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
    expect((await pedir(cookies, 'GET', '/api/conta')).json()).toEqual({ usuario: { nome: 'Ana', email: 'ana@exemplo.com' }, temNegocio: false })
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
})
