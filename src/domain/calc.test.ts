import { describe, expect, it } from 'vitest'
import { dadosDemo, DEMO_HOJE } from '../data/demo'
import type { Lancamento } from './types'
import {
  alertas,
  contasAbertas,
  fraseSobrou,
  gastosPorCategoria,
  grupoPrazo,
  limiteDoAno,
  projecaoAno,
  reservaSugerida,
  resumoMes,
  saldoCaixa,
  saldoPorConta,
  serieMensal,
  situacaoMei,
  variacao,
  vendasSemNota,
} from './calc'

const dados = dadosDemo()

describe('dados de demonstração batem com o DESIGN.md', () => {
  it('outubro: entrou, saiu, sobrou, retirei', () => {
    const r = resumoMes(dados.lancamentos, '2026-10')
    expect(r).toMatchObject({ entrou: 632000, saiu: 384000, sobrou: 248000, retirei: 150000, ficou: 98000 })
    expect(fraseSobrou(r, [])).toBe('Bom mês. Dá para guardar R$ 500 de reserva.')
  })

  it('setembro fechou com R$ 2.100 e +18% em outubro', () => {
    const set = resumoMes(dados.lancamentos, '2026-09')
    expect(set.sobrou).toBe(210000)
    expect(reservaSugerida(set)).toBe(30000)
    expect(Math.round(variacao(248000, set.sobrou)! * 100)).toBe(18)
    expect(vendasSemNota(dados.lancamentos, '2026-09')).toBe(2)
    expect(gastosPorCategoria(dados.lancamentos, dados.categorias, '2026-09').slice(0, 3).map((g) => g.nome)).toEqual([
      'Mercadoria e matéria-prima',
      'Aluguel',
      'Embalagem',
    ])
  })

  it('saldo do caixa hoje é R$ 4.150', () => {
    expect(saldoCaixa(dados)).toBe(415000)
  })

  it('MEI: faturado, restante e projeção', () => {
    const s = situacaoMei(dados, DEMO_HOJE)
    expect(s.faturado).toBe(5_240_000)
    expect(s.limite).toBe(8_100_000)
    expect(s.restante).toBe(2_860_000)
    expect(Math.round(s.usado * 100)).toBe(65)
    expect(s.projecao).toBe(6_288_000)
  })

  it('contas e alertas do dia 15/10', () => {
    const pagar = contasAbertas(dados.lancamentos, 'pagar')
    expect(pagar.map((l) => [l.descricao, l.dataVencimento, grupoPrazo(l.dataVencimento!, DEMO_HOJE)])).toEqual([
      ['Internet', '2026-10-12', 'atrasadas'],
      ['Aluguel', '2026-10-16', 'semana'],
      ['Conta de luz', '2026-10-20', 'semana'],
      ['Fornecedor de embalagens', '2026-10-24', 'depois'],
      ['Internet', '2026-11-12', 'depois'],
      ['Aluguel', '2026-11-16', 'depois'],
      ['Conta de luz', '2026-11-20', 'depois'],
    ])
    expect(alertas(dados, DEMO_HOJE).map((a) => a.texto)).toContain('O DAS de outubro vence dia 20.')
  })

  it('gráfico dos últimos 5 meses', () => {
    expect(serieMensal(dados.lancamentos, '2026-10', 5).map((r) => r.sobrou / 100)).toEqual([1650, 1900, 1780, 2100, 2480])
  })
})

describe('regras do MEI', () => {
  it('limite proporcional no ano de abertura', () => {
    expect(limiteDoAno(2026, '2026-04-10')).toBe(675_000 * 9)
  })
  it('projeção conta só os meses de atividade no ano de abertura', () => {
    expect(projecaoAno(1_200_000, '2026-06-15', '2026-04-01')).toBe(3_600_000)
  })
})

describe('transferência e retirada ficam fora do "Saiu no mês"', () => {
  it('Caixa para Reserva e pró-labore não mexem no saiu, mas mexem no saldo de cada conta', () => {
    const base = dadosDemo()
    const antes = resumoMes(base.lancamentos, '2026-10')
    const saldosAntes = saldoPorConta(base)
    const extra: Lancamento[] = [
      { id: 't1', empresaId: base.empresa.id, natureza: 'transferencia', valor: 50000, contaFinanceiraId: 'caixa', contaDestinoId: 'reserva', situacao: 'realizado', dataCompetencia: DEMO_HOJE, dataPagamento: DEMO_HOJE, formaPagamento: 'pix', notaEmitida: 'nao_se_aplica' },
      { id: 'r1', empresaId: base.empresa.id, natureza: 'retirada', valor: 20000, categoriaId: 'prolabore', contaFinanceiraId: 'conta-pj', situacao: 'realizado', dataCompetencia: DEMO_HOJE, dataPagamento: DEMO_HOJE, formaPagamento: 'pix', notaEmitida: 'nao_se_aplica' },
    ]
    const depois = { ...base, lancamentos: [...base.lancamentos, ...extra] }
    const r = resumoMes(depois.lancamentos, '2026-10')
    expect(r.saiu).toBe(antes.saiu)
    expect(r.entrou).toBe(antes.entrou)
    expect(r.retirei).toBe(antes.retirei + 20000)
    const saldos = saldoPorConta(depois)
    expect(saldos.get('caixa')).toBe(saldosAntes.get('caixa')! - 50000)
    expect(saldos.get('reserva')).toBe(saldosAntes.get('reserva')! + 50000)
    expect(saldos.get('conta-pj')).toBe(saldosAntes.get('conta-pj')! - 20000)
    expect(saldoCaixa(depois)).toBe(saldoCaixa(base) - 70000)
  })
})

describe('frase do sobrou', () => {
  it('mês negativo cita as maiores saídas', () => {
    const r = { mes: '2026-01', entrou: 10000, saiu: 30000, sobrou: -20000, retirei: 0, ficou: -20000 }
    expect(fraseSobrou(r, ['Aluguel', 'Mercadoria'])).toBe('Saiu mais do que entrou. As maiores saídas foram Aluguel e Mercadoria.')
  })
  it('sem lançamentos', () => {
    const r = { mes: '2026-01', entrou: 0, saiu: 0, sobrou: 0, retirei: 0, ficou: 0 }
    expect(fraseSobrou(r, [])).toBe('Lance as entradas e saídas da semana para ver quanto sobra.')
  })
})
