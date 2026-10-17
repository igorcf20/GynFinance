import { describe, expect, it } from 'vitest'
import { ajustarFimDeSemana, dataNominal, gerarPrevistos, limiteGeracao } from './recorrencia'
import type { Recorrencia } from './types'

const rec = (p: Partial<Recorrencia> = {}): Recorrencia => ({
  id: 'r',
  empresaId: 'e',
  modelo: { natureza: 'saida', valor: 120000, categoriaId: 'aluguel', contaFinanceiraId: 'c', formaPagamento: 'boleto', descricao: 'Aluguel' },
  frequencia: 'mensal',
  diaVencimento: 10,
  inicio: '2026-10-10',
  seFimDeSemana: 'manter',
  valorVaria: false,
  ativa: true,
  ...p,
})
let n = 0
const novoId = () => `n${++n}`

describe('fim de semana', () => {
  // 10/10/2026 é sábado; 11/10/2026 é domingo.
  it('antecipa sábado e domingo para sexta', () => {
    expect(ajustarFimDeSemana('2026-10-10', 'antecipar')).toBe('2026-10-09')
    expect(ajustarFimDeSemana('2026-10-11', 'antecipar')).toBe('2026-10-09')
  })
  it('adia sábado e domingo para segunda', () => {
    expect(ajustarFimDeSemana('2026-10-10', 'adiar')).toBe('2026-10-12')
    expect(ajustarFimDeSemana('2026-10-11', 'adiar')).toBe('2026-10-12')
  })
  it('mantém dia útil e a regra "manter"', () => {
    expect(ajustarFimDeSemana('2026-10-14', 'adiar')).toBe('2026-10-14')
    expect(ajustarFimDeSemana('2026-10-10', 'manter')).toBe('2026-10-10')
  })
})

describe('gerador de contas fixas', () => {
  it('dia 31 em fevereiro vira o último dia do mês', () => {
    expect(dataNominal(rec({ diaVencimento: 31 }), '2027-02')).toBe('2027-02-28')
  })

  it('gera até o fim do mês seguinte, com o vencimento ajustado', () => {
    expect(limiteGeracao('2026-10-15')).toBe('2026-11-30')
    const { novos, recorrencias } = gerarPrevistos([rec({ seFimDeSemana: 'adiar' })], [], '2026-10-15', novoId)
    expect(novos.map((l) => [l.dataCompetencia, l.dataVencimento, l.situacao, l.recorrenciaId])).toEqual([
      ['2026-10-10', '2026-10-12', 'previsto', 'r'],
      ['2026-11-10', '2026-11-10', 'previsto', 'r'],
    ])
    expect(recorrencias[0].ultimaGeracao).toBe('2026-11-10')
  })

  it('nunca gera duas vezes o mesmo mês, mesmo já pago', () => {
    const primeira = gerarPrevistos([rec()], [], '2026-10-15', novoId)
    const pagos = primeira.novos.map((l) => ({ ...l, situacao: 'realizado' as const }))
    const segunda = gerarPrevistos([{ ...rec(), ultimaGeracao: undefined }], pagos, '2026-10-15', novoId)
    expect(segunda.novos).toHaveLength(0)
  })

  it('para depois da data de fim e ignora recorrência inativa', () => {
    expect(gerarPrevistos([rec({ fim: '2026-10-31' })], [], '2026-10-15', novoId).novos).toHaveLength(1)
    expect(gerarPrevistos([rec({ ativa: false })], [], '2026-10-15', novoId).novos).toHaveLength(0)
  })
})
