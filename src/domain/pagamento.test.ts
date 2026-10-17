import { describe, expect, it } from 'vitest'
import { dadosDemo } from '../data/demo'
import { aplicarPagamento, dividirEmParcelas, reverterDados, type DetalhesPagamento } from './pagamento'
import type { Dados, Lancamento } from './types'

let n = 0
const novoId = () => `novo-${++n}`

function comConta(valor = 30000): { d: Dados; conta: Lancamento } {
  const d = dadosDemo()
  const base = d.lancamentos.find((l) => l.situacao === 'previsto' && l.natureza === 'saida')!
  const conta = { ...base, valor, dataVencimento: '2026-10-20' }
  return { d: { ...d, lancamentos: d.lancamentos.map((l) => (l.id === base.id ? conta : l)) }, conta }
}

const basico = (d: Dados, extra: Partial<DetalhesPagamento>): DetalhesPagamento => ({
  modo: 'total',
  valorPago: 0,
  dataPagamento: '2026-10-15',
  contaFinanceiraId: d.contas.find((c) => c.tipo === 'caixa')!.id,
  formaPagamento: 'dinheiro',
  ...extra,
})

describe('registrar pagamento', () => {
  it('total: guarda data, conta, forma, comprovante e o valor real', () => {
    const { d, conta } = comConta()
    const comp = { id: 'c1', nome: 'recibo.jpg', tipo: 'image/jpeg', tamanho: 1000 }
    const r = aplicarPagamento(d, conta.id, basico(d, { valorPago: 31500, comprovante: comp, observacao: ' com juros ' }), novoId)
    const pago = r.lancamentos.find((l) => l.id === conta.id)!
    expect(pago).toMatchObject({ situacao: 'realizado', valor: 31500, dataPagamento: '2026-10-15', formaPagamento: 'dinheiro', comprovante: comp, observacao: 'com juros' })
    expect(pago.contaFinanceiraId).toBe(d.contas.find((c) => c.tipo === 'caixa')!.id)
    expect(r.lancamentos).toHaveLength(d.lancamentos.length)
  })

  it('parcial: paga uma parte e o resto volta como conta a pagar, sem a conta fixa', () => {
    const { d, conta } = comConta(30000)
    const r = aplicarPagamento(d, conta.id, basico(d, { modo: 'parcial', valorPago: 10000, restanteVence: '2026-10-30' }), novoId)
    const pago = r.lancamentos.find((l) => l.id === conta.id)!
    const resto = r.lancamentos.find((l) => l.parcelaDe === conta.id)!
    expect(pago.valor).toBe(10000)
    expect(resto).toMatchObject({ situacao: 'previsto', valor: 20000, dataVencimento: '2026-10-30', recorrenciaId: undefined, dataPagamento: undefined })
    // O resto entra logo depois da conta original.
    expect(r.lancamentos.indexOf(resto)).toBe(r.lancamentos.indexOf(pago) + 1)
  })

  it('parcelado com a 1ª paga agora: parcelas mensais que somam o total', () => {
    const { d, conta } = comConta(10000)
    const r = aplicarPagamento(d, conta.id, basico(d, { modo: 'parcelado', parcelas: 3, primeiraPagaAgora: true, proximaVence: '2026-11-30' }), novoId)
    const pago = r.lancamentos.find((l) => l.id === conta.id)!
    const outras = r.lancamentos.filter((l) => l.parcelaDe === conta.id)
    expect(pago).toMatchObject({ situacao: 'realizado', valor: 3334, parcela: { numero: 1, total: 3 } })
    expect(outras.map((l) => [l.valor, l.dataVencimento, l.parcela?.numero])).toEqual([
      [3333, '2026-11-30', 2],
      [3333, '2026-12-30', 3],
    ])
  })

  it('parcelado sem pagar agora: a conta vira a 1ª parcela com o novo vencimento', () => {
    const { d, conta } = comConta(9000)
    const r = aplicarPagamento(d, conta.id, basico(d, { modo: 'parcelado', parcelas: 3, primeiraPagaAgora: false, proximaVence: '2027-01-31' }), novoId)
    const primeira = r.lancamentos.find((l) => l.id === conta.id)!
    expect(primeira).toMatchObject({ situacao: 'previsto', valor: 3000, dataVencimento: '2027-01-31' })
    expect(r.lancamentos.filter((l) => l.parcelaDe === conta.id).map((l) => l.dataVencimento)).toEqual(['2027-02-28', '2027-03-31'])
  })

  it('divide centavos sem perder nenhum', () => {
    expect(dividirEmParcelas(1000, 3)).toEqual([334, 333, 333])
    expect(dividirEmParcelas(1000, 3).reduce((a, b) => a + b)).toBe(1000)
  })

  it('desfazer volta a conta e tira as partes criadas, sem apagar o que veio depois', () => {
    const { d, conta } = comConta(30000)
    const depois = aplicarPagamento(d, conta.id, basico(d, { modo: 'parcial', valorPago: 10000, restanteVence: '2026-10-30' }), novoId)
    const outra: Lancamento = { ...conta, id: 'lancado-depois', situacao: 'realizado', dataPagamento: '2026-10-15' }
    const atual = { ...depois, lancamentos: [...depois.lancamentos, outra] }
    const voltou = reverterDados(atual, d, depois)
    expect(voltou.lancamentos.find((l) => l.id === conta.id)).toBe(conta)
    expect(voltou.lancamentos.some((l) => l.parcelaDe === conta.id)).toBe(false)
    expect(voltou.lancamentos.some((l) => l.id === 'lancado-depois')).toBe(true)
  })
})
