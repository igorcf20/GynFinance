// Agenda: atendimentos marcados com clientes e as contas a pagar e a receber, por dia.
// As contas entram sozinhas pela data de vencimento: lançou uma despesa ou um recebimento
// futuro, ele já aparece no dia certo.
import { addDias, diasEntre } from '../lib/format'
import type { Atendimento, Centavos, Dados, DataISO, Lancamento, MesISO, SituacaoAtendimento } from './types'

export type TipoEvento = 'atendimento' | 'pagar' | 'receber'

export interface Evento {
  /** Id do atendimento ou do lançamento. */
  id: string
  tipo: TipoEvento
  data: DataISO
  /** Só atendimentos têm hora; contas ficam como "o dia todo". */
  inicio?: string
  fim?: string
  titulo: string
  detalhe?: string
  valor?: Centavos
  atrasada?: boolean
  atendimento?: Atendimento
  conta?: Lancamento
}

export const SITUACOES: { valor: SituacaoAtendimento; rotulo: string }[] = [
  { valor: 'agendado', rotulo: 'Agendado' },
  { valor: 'confirmado', rotulo: 'Confirmado' },
  { valor: 'concluido', rotulo: 'Concluído' },
  { valor: 'faltou', rotulo: 'Cliente faltou' },
  { valor: 'cancelado', rotulo: 'Cancelado' },
]

/** "09:30" + 45 minutos = "10:15". Passou da meia-noite, fica em 23:59. */
export function somarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number)
  const total = Math.min(h * 60 + m + minutos, 23 * 60 + 59)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function minutosDoDia(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/** Domingo da semana da data (a semana no Brasil começa no domingo). */
export function inicioDaSemana(data: DataISO): DataISO {
  const dia = new Date(`${data}T12:00:00`).getDay()
  return addDias(data, -dia)
}

export function diasDaSemana(data: DataISO): DataISO[] {
  const dom = inicioDaSemana(data)
  return Array.from({ length: 7 }, (_, i) => addDias(dom, i))
}

/** As 6 semanas que a grade do mês mostra, começando no domingo antes do dia 1. */
export function gradeDoMes(mes: MesISO): DataISO[] {
  const primeiro = inicioDaSemana(`${mes}-01`)
  return Array.from({ length: 42 }, (_, i) => addDias(primeiro, i))
}

/** Atendimento que ainda ocupa o horário (cancelado e falta liberam). */
const ocupa = (a: Atendimento) => a.situacao !== 'cancelado' && a.situacao !== 'faltou'

/** Outros atendimentos no mesmo horário, para avisar antes de marcar dois clientes juntos. */
export function conflitos(atendimentos: Atendimento[], a: Pick<Atendimento, 'id' | 'data' | 'inicio' | 'duracaoMin'>): Atendimento[] {
  const ini = minutosDoDia(a.inicio)
  const fim = ini + a.duracaoMin
  return atendimentos.filter((x) => {
    if (x.id === a.id || x.data !== a.data || !ocupa(x)) return false
    const xi = minutosDoDia(x.inicio)
    return xi < fim && ini < xi + x.duracaoMin
  })
}

export interface FiltroAgenda {
  atendimentos: boolean
  pagar: boolean
  receber: boolean
}

/** Tudo o que cai entre duas datas (inclusive), em ordem de dia e hora. */
export function eventosDoPeriodo(dados: Pick<Dados, 'atendimentos' | 'lancamentos'>, de: DataISO, ate: DataISO, hoje: DataISO, filtro: FiltroAgenda): Evento[] {
  const lista: Evento[] = []
  // A conta a receber criada por um atendimento já aparece no próprio atendimento.
  const doAtendimento = new Set(dados.atendimentos.map((a) => a.lancamentoId).filter(Boolean))
  if (filtro.atendimentos) {
    const contas = new Map(dados.lancamentos.map((l) => [l.id, l]))
    for (const a of dados.atendimentos) {
      if (a.data < de || a.data > ate) continue
      const conta = a.lancamentoId ? contas.get(a.lancamentoId) : undefined
      lista.push({
        id: a.id,
        tipo: 'atendimento',
        data: a.data,
        inicio: a.inicio,
        fim: somarMinutos(a.inicio, a.duracaoMin),
        titulo: a.cliente,
        detalhe: a.servico,
        valor: a.valor,
        // Atendido e ainda não pago depois do vencimento: aparece em vermelho para cobrar.
        atrasada: conta?.situacao === 'previsto' && !!conta.dataVencimento && diasEntre(hoje, conta.dataVencimento) < 0,
        atendimento: a,
        conta,
      })
    }
  }
  for (const l of dados.lancamentos) {
    if (l.situacao !== 'previsto' || !l.dataVencimento || doAtendimento.has(l.id)) continue
    const tipo = l.natureza === 'entrada' ? 'receber' : l.natureza === 'saida' ? 'pagar' : null
    if (!tipo || !filtro[tipo]) continue
    if (l.dataVencimento < de || l.dataVencimento > ate) continue
    lista.push({
      id: l.id,
      tipo,
      data: l.dataVencimento,
      titulo: (tipo === 'receber' ? l.contraparte || l.descricao : l.descricao || l.contraparte) || (tipo === 'receber' ? 'A receber' : 'A pagar'),
      detalhe: tipo === 'receber' ? l.descricao : l.contraparte,
      valor: l.valor,
      atrasada: diasEntre(hoje, l.dataVencimento) < 0,
      conta: l,
    })
  }
  // Contas (dia todo) antes dos horários; depois, pela hora.
  return lista.sort((a, b) => (a.data !== b.data ? (a.data < b.data ? -1 : 1) : (a.inicio ?? '') < (b.inicio ?? '') ? -1 : (a.inicio ?? '') > (b.inicio ?? '') ? 1 : 0))
}

/** Totais do dia ou do período: quanto entra e quanto sai pelas contas e pelos atendimentos. */
export function totaisDoPeriodo(eventos: Evento[]): { atendimentos: number; aReceber: Centavos; aPagar: Centavos } {
  let atendimentos = 0
  let aReceber = 0
  let aPagar = 0
  for (const e of eventos) {
    if (e.tipo === 'atendimento') {
      if (e.atendimento && ocupa(e.atendimento)) {
        atendimentos++
        aReceber += e.valor ?? 0
      }
    } else if (e.tipo === 'receber') aReceber += e.valor ?? 0
    else aPagar += e.valor ?? 0
  }
  return { atendimentos, aReceber, aPagar }
}

export type NovoAtendimento = Omit<Atendimento, 'id' | 'empresaId' | 'lancamentoId'>

/**
 * Grava o atendimento e cuida da conta a receber ligada a ele: cria quando tem valor, acompanha
 * as mudanças enquanto não foi recebida e sai quando o atendimento é cancelado ou o cliente falta.
 * Conta já recebida nunca é mexida.
 */
export function salvarAtendimento(d: Dados, a: NovoAtendimento, id: string, gerarConta: boolean, novoId: () => string): Dados {
  const anterior = d.atendimentos.find((x) => x.id === id)
  const ligada = anterior?.lancamentoId ? d.lancamentos.find((l) => l.id === anterior.lancamentoId) : undefined
  const quer = gerarConta && !!a.valor && a.valor > 0 && ocupa({ ...a, id, empresaId: d.empresa.id })
  let lancamentos = d.lancamentos
  let lancamentoId = ligada?.id

  if (ligada && ligada.situacao === 'previsto') {
    if (quer) {
      const atualizada: Lancamento = {
        ...ligada,
        valor: a.valor!,
        dataCompetencia: a.data,
        dataVencimento: a.data,
        contraparte: a.cliente,
        descricao: a.servico || 'Atendimento',
      }
      lancamentos = lancamentos.map((l) => (l.id === ligada.id ? atualizada : l))
    } else {
      lancamentos = lancamentos.filter((l) => l.id !== ligada.id)
      lancamentoId = undefined
    }
  } else if (!ligada && quer) {
    const receita = d.categorias.find((c) => c.id === 'servicos' && c.ativa) ?? d.categorias.find((c) => c.id === 'vendas')
    const conta: Lancamento = {
      id: novoId(),
      empresaId: d.empresa.id,
      natureza: 'entrada',
      valor: a.valor!,
      categoriaId: receita?.id,
      contaFinanceiraId: d.contas.find((c) => c.tipo === 'banco')?.id ?? d.contas[0].id,
      situacao: 'previsto',
      dataCompetencia: a.data,
      dataVencimento: a.data,
      formaPagamento: 'pix',
      descricao: a.servico || 'Atendimento',
      contraparte: a.cliente,
      notaEmitida: 'nao',
    }
    lancamentos = [...lancamentos, conta]
    lancamentoId = conta.id
  }

  const registro: Atendimento = { ...a, id, empresaId: d.empresa.id, lancamentoId }
  const atendimentos = anterior ? d.atendimentos.map((x) => (x.id === id ? registro : x)) : [...d.atendimentos, registro]
  return { ...d, atendimentos, lancamentos }
}

/** Apaga o atendimento e a conta a receber dele, se ainda não foi recebida. */
export function excluirAtendimento(d: Dados, id: string): Dados {
  const a = d.atendimentos.find((x) => x.id === id)
  if (!a) return d
  return {
    ...d,
    atendimentos: d.atendimentos.filter((x) => x.id !== id),
    lancamentos: d.lancamentos.filter((l) => !(l.id === a.lancamentoId && l.situacao === 'previsto')),
  }
}
