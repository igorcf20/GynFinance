import { describe, expect, it } from 'vitest'
import { categoriasDoNegocio } from '../data/categorias'
import { dadosDemo, DEMO_HOJE } from '../data/demo'
import { dadosIniciais, type ConfigInicial } from '../data/store'
import { alertas, estadoDas, saldoCaixa, situacaoMei } from './calc'
import type { Lancamento } from './types'

const config: ConfigInicial = {
  nomeDono: 'Carla Mendes',
  nomeFantasia: 'Studio Carla',
  uf: 'GO',
  ehMei: true,
  mesAbertura: '2025-03',
  atividade: 'servico',
  saldoBanco: 325000,
  saldoCaixa: 18000,
  faturadoAntes: 3840000,
  dasEmDia: true,
}

describe('configuração inicial', () => {
  it('monta um negócio novo com saldo, MEI e DAS do ano', () => {
    const d = dadosIniciais(config, '2026-10-16')
    expect(d.lancamentos).toEqual([])
    expect(saldoCaixa(d)).toBe(343000)
    const s = situacaoMei(d, '2026-10-16')
    expect(s.faturado).toBe(3840000)
    expect(s.limite).toBe(8100000)
    // Janeiro a setembro pagos antes do sistema; outubro ainda pendente.
    expect(d.pagamentosDas.map((p) => p.competencia)).toHaveLength(9)
    expect(estadoDas(d.pagamentosDas[8], '2026-09', '2026-10-16')).toBe('pago')
    expect(estadoDas(undefined, '2026-10', '2026-10-16')).toBe('pendente')
    expect(alertas(d, '2026-10-16').map((a) => a.id)).toEqual(['das:2026-10'])
  })

  it('aberta neste ano: DAS só desde o mês de abertura', () => {
    const d = dadosIniciais({ ...config, mesAbertura: '2026-07' }, '2026-10-16')
    expect(d.pagamentosDas.map((p) => p.competencia)).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('categorias conforme o tipo de negócio', () => {
    const ativas = (a: Parameters<typeof categoriasDoNegocio>[0]) => categoriasDoNegocio(a).filter((c) => c.ativa).map((c) => c.id)
    expect(ativas('servico')).not.toContain('mercadoria')
    expect(ativas('servico')).toContain('servicos')
    expect(ativas('comercio')).not.toContain('servicos')
    expect(ativas('misto')).toHaveLength(16)
  })
})

describe('avisos da tabela do plano', () => {
  const conta = (p: Partial<Lancamento>): Lancamento => ({
    id: 'x',
    empresaId: 'e',
    natureza: 'saida',
    valor: 120000,
    contaFinanceiraId: 'conta-pj',
    situacao: 'previsto',
    dataCompetencia: '2026-10-17',
    dataVencimento: '2026-10-17',
    formaPagamento: 'boleto',
    notaEmitida: 'nao_se_aplica',
    descricao: 'Aluguel',
    ...p,
  })

  it('demonstração: DAS e a internet atrasada no painel, aluguel de amanhã só no sino', () => {
    const lista = alertas(dadosDemo(), DEMO_HOJE)
    expect(lista.filter((a) => a.painel).map((a) => a.texto)).toEqual(['O DAS de outubro vence dia 20.', 'A conta "Internet" venceu há 3 dias.'])
    expect(lista.find((a) => !a.painel && a.texto.startsWith('Amanhã vence Aluguel'))).toBeTruthy()
  })

  it('conta vencendo respeita a antecedência escolhida', () => {
    const d = { ...dadosIniciais({ ...config, ehMei: false }, '2026-10-14'), lancamentos: [conta({})] }
    expect(alertas(d, '2026-10-14')).toEqual([])
    d.preferencias = { ...d.preferencias, lembreteDias: 3 }
    expect(alertas(d, '2026-10-14').map((a) => a.texto)).toEqual(['Em 3 dias vence Aluguel: R$ 1.200.'])
    expect(alertas(d, '2026-10-17').map((a) => a.texto)).toEqual(['Hoje vence Aluguel: R$ 1.200.'])
  })

  it('cliente devendo e várias contas atrasadas', () => {
    const d = {
      ...dadosIniciais({ ...config, ehMei: false }, '2026-10-20'),
      lancamentos: [
        conta({ id: 'a', dataVencimento: '2026-10-10' }),
        conta({ id: 'b', valor: 9990, descricao: 'Internet', dataVencimento: '2026-10-12' }),
        conta({ id: 'c', natureza: 'entrada', valor: 35000, contraparte: 'João Silva', dataVencimento: '2026-10-02', notaEmitida: 'nao' }),
      ],
    }
    const textos = alertas(d, '2026-10-20').map((a) => a.texto)
    expect(textos).toContain('2 contas estão atrasadas, somando R$ 1.299,90.')
    expect(textos).toContain('João Silva deve R$ 350 desde 02/10. Cobrar pelo WhatsApp?')
  })

  it('fechamento e vendas sem nota na primeira semana; dispensar esconde só aquele mês', () => {
    const venda = conta({ id: 'v', natureza: 'entrada', situacao: 'realizado', valor: 50000, dataCompetencia: '2026-09-10', dataPagamento: '2026-09-10', dataVencimento: undefined, notaEmitida: 'nao' })
    const d = { ...dadosIniciais({ ...config, ehMei: false }, '2026-10-02'), lancamentos: [venda] }
    const lista = alertas(d, '2026-10-02')
    expect(lista.map((a) => a.texto)).toEqual(['Setembro fechou: sobrou R$ 500.', '1 venda de setembro está sem nota.'])
    expect(alertas({ ...d, avisosDispensados: ['fechamento:2026-09'] }, '2026-10-02').map((a) => a.id)).toEqual(['sem-nota:2026-09'])
    expect(alertas(d, '2026-10-09')).toEqual([])
  })

  it('declaração anual em abril e maio, com o faturamento do ano anterior', () => {
    const d = dadosIniciais({ ...config, dasEmDia: true, faturadoAntes: undefined }, '2027-04-02')
    const venda = conta({ id: 'v', natureza: 'entrada', categoriaId: 'servicos', situacao: 'realizado', valor: 4200000, dataCompetencia: '2026-11-10', dataPagamento: '2026-11-10', dataVencimento: undefined, notaEmitida: 'sim' })
    d.lancamentos = [venda]
    expect(alertas(d, '2027-04-02').map((a) => a.texto)).toContain('A declaração anual do MEI (DASN-SIMEI) vence em 31/05. Seu faturamento de 2026 foi R$ 42.000.')
  })
})
