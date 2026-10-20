import { describe, expect, it } from 'vitest'
import type { Dados, Lancamento } from './types'
import { faturadoNoMes, previsaoCaixa, progressoMeta, prolaboreSugerido, resumoSemana, usoDosTetos } from './planejamento'
import { alertas } from './calc'
import { CATEGORIAS_PADRAO } from '../data/categorias'

const HOJE = '2026-10-15'
let n = 0
const l = (p: Partial<Lancamento>): Lancamento => ({
  id: `l${++n}`,
  empresaId: 'e',
  natureza: 'saida',
  valor: 10000,
  contaFinanceiraId: 'banco',
  situacao: 'realizado',
  dataCompetencia: HOJE,
  dataPagamento: HOJE,
  formaPagamento: 'pix',
  notaEmitida: 'nao_se_aplica',
  ...p,
})

function dados(lancamentos: Lancamento[], empresa: Partial<Dados['empresa']> = {}): Dados {
  return {
    empresa: { id: 'e', nomeDono: 'Ana', nomeFantasia: 'Doces', ehMei: false, dataAbertura: '2024-01-01', atividade: 'comercio', uf: 'GO', modulosAtivos: [], ...empresa },
    contas: [
      { id: 'banco', empresaId: 'e', nome: 'Banco', tipo: 'banco', saldoInicial: 50000, ativa: true },
      { id: 'reserva', empresaId: 'e', nome: 'Reserva', tipo: 'reserva', saldoInicial: 900000, ativa: true },
    ],
    categorias: CATEGORIAS_PADRAO,
    lancamentos,
    recorrencias: [],
    pagamentosDas: [],
    atendimentos: [],
    preferencias: { lembreteDias: 1, lembreteEmail: false, resumoMensal: false },
  }
}

const prevista = (p: Partial<Lancamento>) => l({ situacao: 'previsto', dataPagamento: undefined, ...p })

describe('previsão do caixa', () => {
  it('soma o que vence e acha o primeiro dia no vermelho (sem contar a reserva)', () => {
    const d = dados([
      prevista({ natureza: 'saida', valor: 80000, dataVencimento: '2026-10-20' }),
      prevista({ natureza: 'entrada', valor: 40000, dataVencimento: '2026-10-25' }),
    ])
    const p = previsaoCaixa(d, HOJE, 30)
    expect(p.hoje).toBe(50000)
    expect(p.primeiroNegativo).toMatchObject({ dia: '2026-10-20', saldo: -30000 })
    expect(p.pontos.at(-1)!.saldo).toBe(10000)
    expect(p.menor.saldo).toBe(-30000)
  })

  it('conta a pagar atrasada sai hoje; a receber atrasada fica de fora', () => {
    const d = dados([
      prevista({ natureza: 'saida', valor: 20000, dataVencimento: '2026-10-01' }),
      prevista({ natureza: 'entrada', valor: 99000, dataVencimento: '2026-10-02' }),
    ])
    const p = previsaoCaixa(d, HOJE, 10)
    expect(p.pontos[0]).toMatchObject({ dia: HOJE, saldo: 30000 })
    expect(p.atrasadoPagar).toBe(20000)
    expect(p.atrasadoReceber).toBe(99000)
    expect(p.primeiroNegativo).toBeUndefined()
  })

  it('vira aviso no painel', () => {
    const d = dados([prevista({ natureza: 'saida', valor: 80000, dataVencimento: '2026-10-20' })])
    const a = alertas(d, HOJE).find((x) => x.id.startsWith('caixa-negativo'))
    expect(a?.texto).toContain('No dia 20/10 o caixa fica R$ 300 no vermelho')
    expect(a?.nivel).toBe('perigo')
  })
})

describe('quanto posso tirar', () => {
  it('média dos meses anteriores menos o já retirado, limitada pelo caixa', () => {
    const d = dados([
      l({ natureza: 'entrada', valor: 300000, dataPagamento: '2026-09-10', dataCompetencia: '2026-09-10' }),
      l({ natureza: 'saida', valor: 100000, dataPagamento: '2026-09-11', dataCompetencia: '2026-09-11' }),
      l({ natureza: 'entrada', valor: 200000, dataPagamento: '2026-08-10', dataCompetencia: '2026-08-10' }),
      l({ natureza: 'retirada', valor: 50000 }),
    ])
    const p = prolaboreSugerido(d, HOJE)
    // Setembro sobrou 200.000 e agosto 200.000: gera 200.000 por mês.
    expect(p.mesesUsados).toBe(2)
    expect(p.geraPorMes).toBe(200000)
    expect(p.retirado).toBe(50000)
    // Caixa: 50.000 + 300.000 - 100.000 + 200.000 - 50.000 = 400.000; sem contas abertas.
    expect(p.sugerido).toBe(150000)
    expect(p.limite).toBe('gera')
  })

  it('caixa apertado limita a sugestão e nunca fica negativo', () => {
    const d = dados([
      l({ natureza: 'entrada', valor: 300000, dataPagamento: '2026-09-10', dataCompetencia: '2026-09-10' }),
      l({ natureza: 'saida', valor: 290000, dataPagamento: '2026-10-01' }),
      prevista({ natureza: 'saida', valor: 55555, dataVencimento: '2026-10-30' }),
    ])
    const p = prolaboreSugerido(d, HOJE)
    expect(p.folga).toBe(50000 + 300000 - 290000 - 55555)
    expect(p.sugerido).toBe(4000)
    expect(p.limite).toBe('caixa')
  })
})

describe('tetos e meta', () => {
  it('teto por categoria e aviso a partir de 80%', () => {
    const d = dados([l({ categoriaId: 'embalagem', valor: 45000 }), l({ categoriaId: 'embalagem', valor: 5000, dataPagamento: '2026-09-01' })], { limitesCategoria: { embalagem: 50000, aluguel: 0 } })
    expect(usoDosTetos(d, '2026-10')).toEqual([{ categoriaId: 'embalagem', nome: 'Embalagem', limite: 50000, gasto: 45000, uso: 0.9 }])
    expect(alertas(d, HOJE).find((a) => a.id.startsWith('teto'))?.texto).toBe('Embalagem já usou 90% do teto do mês. Restam R$ 50.')
  })

  it('meta do mês: quanto falta e por dia', () => {
    const d = dados(
      [
        l({ natureza: 'entrada', categoriaId: 'vendas', valor: 300000, situacao: 'previsto', dataPagamento: undefined }),
        l({ natureza: 'entrada', categoriaId: 'outras-entradas', valor: 999999 }),
        l({ natureza: 'entrada', categoriaId: 'vendas', valor: 1000, situacao: 'cancelado' }),
      ],
      { metaFaturamento: 800000 },
    )
    expect(faturadoNoMes(d, '2026-10')).toBe(300000)
    const m = progressoMeta(d, '2026-10', HOJE)!
    expect(m).toMatchObject({ vendido: 300000, falta: 500000, diasRestantes: 17 })
    expect(m.porDia).toBe(Math.ceil(500000 / 17))
    expect(progressoMeta(d, '2026-09', HOJE)!.diasRestantes).toBe(0)
    expect(progressoMeta(dados([]), '2026-10', HOJE)).toBeNull()
  })
})

describe('resumo da semana', () => {
  it('últimos 7 dias e próximos 7', () => {
    const d = dados([
      l({ natureza: 'entrada', valor: 1000, dataPagamento: '2026-10-09' }),
      l({ natureza: 'entrada', valor: 2000, dataPagamento: '2026-10-07' }),
      l({ natureza: 'saida', valor: 500, dataPagamento: '2026-10-14' }),
      prevista({ natureza: 'saida', valor: 700, dataVencimento: '2026-10-22' }),
      prevista({ natureza: 'entrada', valor: 900, dataVencimento: '2026-10-23' }),
    ])
    const r = resumoSemana(d, '2026-10-15')
    expect(r.segunda).toBe('2026-10-12')
    expect(r).toMatchObject({ entrou: 1000, saiu: 500, aPagar: { total: 700, quantidade: 1 }, aReceber: { total: 0, quantidade: 0 } })
    expect(r.dica.length).toBeGreaterThan(10)
  })
})
