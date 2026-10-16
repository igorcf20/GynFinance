// Baixa de uma conta a pagar ou a receber: total, parcial (o resto fica para depois) ou parcelada.
// Funções puras: o store chama e o servidor recebe o resultado como lançamentos comuns.
import { addMeses } from '../lib/format'
import type { Centavos, Comprovante, Dados, DataISO, FormaPagamento, Lancamento } from './types'

export type ModoPagamento = 'total' | 'parcial' | 'parcelado'

export interface DetalhesPagamento {
  modo: ModoPagamento
  /** Total: o valor que de fato saiu ou entrou. Parcial: a parte paga agora. Parcelado: ignorado (as parcelas dividem o valor da conta). */
  valorPago: Centavos
  dataPagamento: DataISO
  /** Por onde o dinheiro saiu (ou entrou): conta da empresa, caixa ou reserva. */
  contaFinanceiraId: string
  formaPagamento: FormaPagamento
  comprovante?: Comprovante
  observacao?: string
  /** Parcial: quando vence o que ficou faltando. */
  restanteVence?: DataISO
  /** Parcelado: em quantas parcelas, se a 1ª foi paga agora e quando vence a próxima a pagar. */
  parcelas?: number
  primeiraPagaAgora?: boolean
  proximaVence?: DataISO
}

/** Divide em parcelas de centavos inteiros; os centavos que sobram vão nas primeiras. */
export function dividirEmParcelas(total: Centavos, n: number): Centavos[] {
  const base = Math.floor(total / n)
  const resto = total - base * n
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0))
}

/** Último dia válido: 31/01 + 1 mês vira 28/02 ou 29/02, não março. */
function mesesDepois(data: DataISO, n: number): DataISO {
  const mes = addMeses(data.slice(0, 7), n)
  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  const dia = Math.min(Number(data.slice(8, 10)), ultimo)
  return `${mes}-${String(dia).padStart(2, '0')}`
}

export function aplicarPagamento(d: Dados, id: string, det: DetalhesPagamento, novoId: () => string): Dados {
  const conta = d.lancamentos.find((l) => l.id === id)
  if (!conta || conta.situacao !== 'previsto') return d
  const pago: Partial<Lancamento> = {
    situacao: 'realizado',
    dataPagamento: det.dataPagamento,
    contaFinanceiraId: det.contaFinanceiraId,
    formaPagamento: det.formaPagamento,
    comprovante: det.comprovante,
    observacao: det.observacao?.trim() || undefined,
  }
  // O que fica para depois não leva a conta fixa: o gerador só cria um previsto por mês.
  const resto = (valor: Centavos, vence: DataISO, extra: Partial<Lancamento> = {}): Lancamento => ({
    ...conta,
    id: novoId(),
    valor,
    situacao: 'previsto',
    dataVencimento: vence,
    dataPagamento: undefined,
    recorrenciaId: undefined,
    comprovante: undefined,
    observacao: undefined,
    parcelaDe: conta.id,
    ...extra,
  })

  let alterada: Lancamento
  const novos: Lancamento[] = []
  if (det.modo === 'total') {
    alterada = { ...conta, ...pago, valor: det.valorPago > 0 ? det.valorPago : conta.valor }
  } else if (det.modo === 'parcial') {
    const parte = Math.min(Math.max(det.valorPago, 1), conta.valor - 1)
    alterada = { ...conta, ...pago, valor: parte }
    novos.push(resto(conta.valor - parte, det.restanteVence ?? conta.dataVencimento!))
  } else {
    const n = Math.max(2, Math.min(det.parcelas ?? 2, 60))
    const valores = dividirEmParcelas(conta.valor, n)
    const agora = det.primeiraPagaAgora !== false
    const proxima = det.proximaVence ?? mesesDepois(conta.dataVencimento!, 1)
    if (agora) {
      alterada = { ...conta, ...pago, valor: valores[0], parcela: { numero: 1, total: n } }
    } else {
      // Nada pago agora: a própria conta vira a 1ª parcela, com o novo vencimento.
      alterada = { ...conta, valor: valores[0], dataVencimento: proxima, observacao: det.observacao?.trim() || conta.observacao, parcela: { numero: 1, total: n } }
    }
    for (let i = 1; i < n; i++) {
      novos.push(resto(valores[i], mesesDepois(proxima, agora ? i - 1 : i), { parcela: { numero: i + 1, total: n } }))
    }
  }
  const lancamentos = d.lancamentos.flatMap((l) => (l.id === id ? [alterada, ...novos] : [l]))
  return { ...d, lancamentos }
}

/**
 * Desfaz uma ação: tira o que ela criou, volta o que ela mudou e repõe o que ela apagou, sem
 * mexer no que aconteceu depois em outros registros.
 */
export function reverter<T>(atual: T[], antes: T[], depois: T[], chave: (x: T) => string): T[] {
  const a = new Map(antes.map((x) => [chave(x), x]))
  const dep = new Map(depois.map((x) => [chave(x), x]))
  const r = atual
    .filter((x) => a.has(chave(x)) || !dep.has(chave(x)))
    .map((x) => {
      const k = chave(x)
      const velho = a.get(k)
      return velho && dep.get(k) !== velho ? velho : x
    })
  const presentes = new Set(r.map(chave))
  for (const [k, velho] of a) if (!dep.has(k) && !presentes.has(k)) r.push(velho)
  return r
}

export function reverterDados(atual: Dados, antes: Dados, depois: Dados): Dados {
  return {
    ...atual,
    lancamentos: reverter(atual.lancamentos, antes.lancamentos, depois.lancamentos, (l) => l.id),
    pagamentosDas: reverter(atual.pagamentosDas, antes.pagamentosDas, depois.pagamentosDas, (p) => p.competencia),
    recorrencias: reverter(atual.recorrencias, antes.recorrencias, depois.recorrencias, (r) => r.id),
    atendimentos: reverter(atual.atendimentos, antes.atendimentos, depois.atendimentos, (a) => a.id),
  }
}
