import { describe, expect, it } from 'vitest'
import { dadosDemo, DEMO_HOJE } from '../data/demo'
import { conflitos, eventosDoPeriodo, excluirAtendimento, gradeDoMes, inicioDaSemana, salvarAtendimento, somarMinutos, type NovoAtendimento } from './agenda'
import { aReceberFuturo, emAtraso } from './calc'

let n = 0
const novoId = () => `novo-${++n}`
const todos = { atendimentos: true, pagar: true, receber: true }

const base: NovoAtendimento = { cliente: 'Lia', servico: 'Corte', data: '2026-10-20', inicio: '14:00', duracaoMin: 60, situacao: 'agendado', valor: 8000 }

describe('agenda', () => {
  it('semana começa no domingo e o mês tem 6 semanas na grade', () => {
    expect(inicioDaSemana('2026-10-15')).toBe('2026-10-11')
    const g = gradeDoMes('2026-10')
    expect(g).toHaveLength(42)
    expect(g[0]).toBe('2026-09-27')
    expect(somarMinutos('09:30', 45)).toBe('10:15')
  })

  it('contas a pagar e a receber entram sozinhas no dia do vencimento', () => {
    const d = dadosDemo()
    const ev = eventosDoPeriodo(d, '2026-10-01', '2026-10-31', DEMO_HOJE, todos)
    const aluguel = ev.find((e) => e.tipo === 'pagar' && e.titulo === 'Aluguel')
    expect(aluguel?.data).toBe('2026-10-16')
    // A conta do Buffet é de um atendimento: aparece uma vez só, como atendimento.
    expect(ev.filter((e) => e.titulo === 'Buffet Estrela').map((e) => e.tipo)).toEqual(['atendimento'])
    const soPagar = eventosDoPeriodo(d, '2026-10-01', '2026-10-31', DEMO_HOJE, { atendimentos: false, pagar: true, receber: false })
    expect(soPagar.every((e) => e.tipo === 'pagar')).toBe(true)
  })

  it('atendimento com valor cria a conta a receber, acompanha e some ao cancelar', () => {
    const d = dadosDemo()
    const d1 = salvarAtendimento(d, base, 'at1', true, novoId)
    const a = d1.atendimentos.find((x) => x.id === 'at1')!
    const conta = d1.lancamentos.find((l) => l.id === a.lancamentoId)!
    expect(conta).toMatchObject({ natureza: 'entrada', situacao: 'previsto', valor: 8000, dataVencimento: '2026-10-20', contraparte: 'Lia' })
    expect(aReceberFuturo(d1.lancamentos, DEMO_HOJE).total - aReceberFuturo(d.lancamentos, DEMO_HOJE).total).toBe(8000)

    const d2 = salvarAtendimento(d1, { ...base, valor: 9000, data: '2026-10-21' }, 'at1', true, novoId)
    expect(d2.lancamentos.find((l) => l.id === a.lancamentoId)).toMatchObject({ valor: 9000, dataVencimento: '2026-10-21' })

    const d3 = salvarAtendimento(d2, { ...base, situacao: 'cancelado' }, 'at1', true, novoId)
    expect(d3.lancamentos.some((l) => l.id === a.lancamentoId)).toBe(false)
    expect(d3.atendimentos.find((x) => x.id === 'at1')!.lancamentoId).toBeUndefined()
  })

  it('conta já recebida não é mexida nem apagada', () => {
    const d1 = salvarAtendimento(dadosDemo(), base, 'at2', true, novoId)
    const id = d1.atendimentos.find((x) => x.id === 'at2')!.lancamentoId!
    const pago = { ...d1, lancamentos: d1.lancamentos.map((l) => (l.id === id ? { ...l, situacao: 'realizado' as const, dataPagamento: '2026-10-20' } : l)) }
    const d2 = salvarAtendimento(pago, { ...base, valor: 1 }, 'at2', true, novoId)
    expect(d2.lancamentos.find((l) => l.id === id)!.valor).toBe(8000)
    const d3 = excluirAtendimento(d2, 'at2')
    expect(d3.lancamentos.some((l) => l.id === id)).toBe(true)
    expect(d3.atendimentos.some((x) => x.id === 'at2')).toBe(false)
  })

  it('avisa quando dois atendimentos se cruzam, menos cancelados', () => {
    const d = dadosDemo()
    const choque = conflitos(d.atendimentos, { id: 'x', data: '2026-10-15', inicio: '09:15', duracaoMin: 30 })
    expect(choque.map((c) => c.cliente)).toEqual(['Maria Souza'])
    expect(conflitos(d.atendimentos, { id: 'x', data: '2026-10-14', inicio: '15:00', duracaoMin: 30 })).toEqual([])
  })

  it('painel: em atraso dos dois lados', () => {
    const d = dadosDemo()
    const a = emAtraso(d.lancamentos, DEMO_HOJE)
    expect(a.receber.quantidade).toBe(1)
    expect(a.receber.total).toBe(35000)
    expect(a.pagar.quantidade).toBeGreaterThanOrEqual(1)
  })
})
