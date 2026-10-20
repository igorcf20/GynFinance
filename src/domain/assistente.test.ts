import { describe, expect, it } from 'vitest'
import { DEMO_HOJE, dadosDemo } from '../data/demo'
import { interpretarDemo, itemParaAtendimento, itemParaLancamento, montarContexto, tituloDoItem, type ItemAssistente } from './assistente'

const d = dadosDemo()
const hoje = DEMO_HOJE

const item = (x: Partial<ItemAssistente>): ItemAssistente => ({
  tipo: 'lancamento',
  natureza: 'saida',
  situacao: 'realizado',
  valorCentavos: 4590,
  data: hoje,
  vencimento: null,
  categoriaId: null,
  contaId: null,
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

describe('assistente', () => {
  it('contexto leva só categorias e contas ativas e as contas em aberto', () => {
    const c = montarContexto(d, hoje, true)
    expect(c.contas.length).toBeGreaterThan(0)
    expect(c.categorias.every((x) => d.categorias.find((y) => y.id === x.id)?.ativa)).toBe(true)
    expect(c.abertas.every((a) => d.lancamentos.find((l) => l.id === a.id)?.situacao === 'previsto')).toBe(true)
    expect(c.resumo).toMatch(/sobrou/)
  })

  it('item vira lançamento: categoria pela pista, dinheiro no caixa, data de pagamento', () => {
    const l = itemParaLancamento(item({}), d)
    expect(l).toMatchObject({ natureza: 'saida', valor: 4590, categoriaId: 'transporte', situacao: 'realizado', dataPagamento: hoje, notaEmitida: 'nao_se_aplica' })
    expect(d.contas.find((c) => c.id === l.contaFinanceiraId)?.tipo).toBe('caixa')
    const conta = itemParaLancamento(item({ situacao: 'previsto', vencimento: '2026-10-25', formaPagamento: 'boleto' }), d)
    expect(conta).toMatchObject({ situacao: 'previsto', dataVencimento: '2026-10-25', dataPagamento: undefined })
    expect(itemParaLancamento(item({ natureza: 'retirada' }), d).categoriaId).toBe('prolabore')
    expect(itemParaLancamento(item({ natureza: 'aporte' }), d).categoriaId).toBeUndefined()
    expect(tituloDoItem(item({ situacao: 'previsto', vencimento: '2026-10-25', valorCentavos: 30000 }))).toBe('Conta a pagar de R$ 300,00')
  })

  it('atendimento com valor', () => {
    expect(itemParaAtendimento(item({ tipo: 'atendimento', hora: '14:00', valorCentavos: 8000, contraparte: 'Maria', descricao: 'Corte' }))).toMatchObject({
      cliente: 'Maria',
      servico: 'Corte',
      inicio: '14:00',
      duracaoMin: 60,
      valor: 8000,
      situacao: 'agendado',
    })
  })

  it('demonstração entende frases simples', () => {
    expect(interpretarDemo('gastei 45,90 de gasolina hoje', d, hoje, 0).acoes[0]).toMatchObject({ natureza: 'saida', valorCentavos: 4590, descricao: 'Gasolina' })
    expect(interpretarDemo('Vendi 3 bolos por 120 no Pix', d, hoje, 0).acoes[0]).toMatchObject({ natureza: 'entrada', valorCentavos: 12000, formaPagamento: 'pix', descricao: 'Bolos' })
    const boleto = interpretarDemo('Boleto de 300 do fornecedor vence dia 25', d, hoje, 0).acoes[0]
    expect(boleto).toMatchObject({ situacao: 'previsto', valorCentavos: 30000, vencimento: '2026-10-25', formaPagamento: 'boleto' })
    expect(interpretarDemo('quanto sobrou este mês?', d, hoje, 0)).toMatchObject({ acoes: [] })
    expect(interpretarDemo('comprei uma coisa', d, hoje, 0).resposta).toMatch(/valor/)
    expect(interpretarDemo('', d, hoje, 1).resposta).toMatch(/fotos/)
  })
})
