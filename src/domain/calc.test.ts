import { describe, expect, it } from 'vitest'
import { dadosDemo, DEMO_HOJE } from '../data/demo'
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
  serieMensal,
  situacaoMei,
  variacao,
  vendasSemNota,
} from './calc'

const dados = dadosDemo()

describe('dados de demonstração batem com o DESIGN.md', () => {
  it('outubro: entrou, saiu, sobrou, retirei', () => {
    const r = resumoMes(dados.lancamentos, '2026-10')
    expect(r).toMatchObject({ entrou: 6320, saiu: 3840, sobrou: 2480, retirei: 1500, ficou: 980 })
    expect(fraseSobrou(r, [])).toBe('Bom mês. Dá para guardar R$ 500 de reserva.')
  })

  it('setembro fechou com R$ 2.100 e +18% em outubro', () => {
    const set = resumoMes(dados.lancamentos, '2026-09')
    expect(set.sobrou).toBe(2100)
    expect(reservaSugerida(set)).toBe(300)
    expect(Math.round(variacao(2480, set.sobrou)! * 100)).toBe(18)
    expect(vendasSemNota(dados.lancamentos, '2026-09')).toBe(2)
    expect(gastosPorCategoria(dados.lancamentos, dados.categorias, '2026-09').slice(0, 3).map((g) => g.nome)).toEqual([
      'Mercadoria e matéria-prima',
      'Aluguel',
      'Embalagem',
    ])
  })

  it('saldo do caixa hoje é R$ 4.150', () => {
    expect(saldoCaixa(dados)).toBe(4150)
  })

  it('MEI: faturado, restante e projeção', () => {
    const s = situacaoMei(dados, DEMO_HOJE)
    expect(s.faturado).toBe(52400)
    expect(s.limite).toBe(81000)
    expect(s.restante).toBe(28600)
    expect(Math.round(s.usado * 100)).toBe(65)
    expect(s.projecao).toBe(62880)
  })

  it('contas e alertas do dia 15/10', () => {
    const pagar = contasAbertas(dados.lancamentos, 'pagar')
    expect(pagar.map((l) => [l.descricao, grupoPrazo(l.dataVencimento!, DEMO_HOJE)])).toEqual([
      ['Internet', 'atrasadas'],
      ['Aluguel', 'semana'],
      ['Fornecedor de embalagens', 'depois'],
    ])
    expect(alertas(dados, DEMO_HOJE).map((a) => a.texto)).toContain('O DAS de outubro vence dia 20.')
  })

  it('gráfico dos últimos 5 meses', () => {
    expect(serieMensal(dados.lancamentos, '2026-10', 5).map((r) => r.sobrou)).toEqual([1650, 1900, 1780, 2100, 2480])
  })
})

describe('regras do MEI', () => {
  it('limite proporcional no ano de abertura', () => {
    expect(limiteDoAno(2026, '2026-04-10')).toBe(6750 * 9)
  })
  it('projeção conta só os meses de atividade no ano de abertura', () => {
    expect(projecaoAno(12000, '2026-06-15', '2026-04-01')).toBe(36000)
  })
})

describe('frase do sobrou', () => {
  it('mês negativo cita as maiores saídas', () => {
    const r = { mes: '2026-01', entrou: 100, saiu: 300, sobrou: -200, retirei: 0, ficou: -200 }
    expect(fraseSobrou(r, ['Aluguel', 'Mercadoria'])).toBe('Saiu mais do que entrou. As maiores saídas foram Aluguel e Mercadoria.')
  })
  it('sem lançamentos', () => {
    const r = { mes: '2026-01', entrou: 0, saiu: 0, sobrou: 0, retirei: 0, ficou: 0 }
    expect(fraseSobrou(r, [])).toBe('Lance as entradas e saídas da semana para ver quanto sobra.')
  })
})
