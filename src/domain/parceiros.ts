// Clientes e fornecedores (módulo do plano Plus): a ficha de cada um e quanto o negócio ganhou
// e gastou com ele. Lançamentos, contas fixas e atendimentos apontam para a ficha por parceiroId;
// o nome continua em contraparte, para as outras telas e o CSV não mudarem.
import { addMeses, diasEntre, mesDe } from '../lib/format'
import type { Atendimento, Centavos, Dados, DataISO, Lancamento, MesISO, Parceiro, TipoParceiro } from './types'

export const TIPOS_PARCEIRO: { valor: TipoParceiro; rotulo: string }[] = [
  { valor: 'cliente', rotulo: 'Cliente' },
  { valor: 'fornecedor', rotulo: 'Fornecedor' },
  { valor: 'ambos', rotulo: 'Cliente e fornecedor' },
]

export const ehCliente = (p: Pick<Parceiro, 'tipo'>) => p.tipo !== 'fornecedor'
export const ehFornecedor = (p: Pick<Parceiro, 'tipo'>) => p.tipo !== 'cliente'

/** Compara nomes sem acento, maiúsculas nem espaços sobrando ("João  Silva" = "joao silva"). */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Ficha com este nome (a ativa primeiro). */
export function parceiroPeloNome(parceiros: Parceiro[] | undefined, nome: string, tipo?: 'cliente' | 'fornecedor'): Parceiro | undefined {
  const alvo = normalizarNome(nome)
  if (!alvo) return undefined
  const servem = (parceiros ?? []).filter((p) => normalizarNome(p.nome) === alvo && (!tipo || (tipo === 'cliente' ? ehCliente(p) : ehFornecedor(p))))
  return servem.find((p) => p.ativo) ?? servem[0]
}

/** O lançamento conta para o relatório do parceiro: entrada ou saída de verdade (sem o aporte espelho). */
const conta = (l: Lancamento) => (l.natureza === 'entrada' || l.natureza === 'saida') && !l.espelhoDe && l.situacao !== 'cancelado'

export interface Periodo {
  /** Primeiro dia (inclusive). Vazio = desde o começo. */
  de?: DataISO
  /** Último dia (inclusive). Vazio = até hoje. */
  ate?: DataISO
}

const noPeriodo = (d: DataISO | undefined, p: Periodo) => !!d && (!p.de || d >= p.de) && (!p.ate || d <= p.ate)

export interface ResumoParceiro {
  /** Recebido dele no período (regime de caixa, pela data do pagamento). */
  recebido: Centavos
  /** Pago a ele no período. */
  pago: Centavos
  /** Recebido menos pago. */
  saldo: Centavos
  /** Contas a receber dele ainda em aberto (todas, de qualquer data). */
  aReceber: Centavos
  aPagar: Centavos
  /** Parte do aReceber/aPagar que já venceu. */
  atrasadoReceber: Centavos
  atrasadoPagar: Centavos
  /** Quantos recebimentos e pagamentos no período. */
  vendas: number
  compras: number
  /** Média por venda recebida no período. */
  ticketMedio: Centavos
  /** Último recebimento ou pagamento (qualquer período). */
  ultimoMovimento?: DataISO
  /** Dias, em média, entre o vencimento e o pagamento das contas a receber dele (negativo = paga adiantado). */
  atrasoMedioDias?: number
}

export function lancamentosDo(lancamentos: Lancamento[], parceiroId: string): Lancamento[] {
  return lancamentos.filter((l) => l.parceiroId === parceiroId && conta(l))
}

export function resumoParceiro(lancamentos: Lancamento[], parceiroId: string, periodo: Periodo, hoje: DataISO): ResumoParceiro {
  const r: ResumoParceiro = { recebido: 0, pago: 0, saldo: 0, aReceber: 0, aPagar: 0, atrasadoReceber: 0, atrasadoPagar: 0, vendas: 0, compras: 0, ticketMedio: 0 }
  let atrasos = 0
  let comVencimento = 0
  for (const l of lancamentosDo(lancamentos, parceiroId)) {
    const entrada = l.natureza === 'entrada'
    if (l.situacao === 'realizado') {
      if (l.dataPagamento && (!r.ultimoMovimento || l.dataPagamento > r.ultimoMovimento)) r.ultimoMovimento = l.dataPagamento
      if (entrada && l.dataVencimento && l.dataPagamento) {
        atrasos += diasEntre(l.dataVencimento, l.dataPagamento)
        comVencimento++
      }
      if (!noPeriodo(l.dataPagamento, periodo)) continue
      if (entrada) {
        r.recebido += l.valor
        r.vendas++
      } else {
        r.pago += l.valor
        r.compras++
      }
    } else if (l.situacao === 'previsto') {
      const atrasada = !!l.dataVencimento && l.dataVencimento < hoje
      if (entrada) {
        r.aReceber += l.valor
        if (atrasada) r.atrasadoReceber += l.valor
      } else {
        r.aPagar += l.valor
        if (atrasada) r.atrasadoPagar += l.valor
      }
    }
  }
  r.saldo = r.recebido - r.pago
  r.ticketMedio = r.vendas ? Math.round(r.recebido / r.vendas) : 0
  if (comVencimento) r.atrasoMedioDias = Math.round(atrasos / comVencimento)
  return r
}

export interface PontoParceiro {
  mes: MesISO
  recebido: Centavos
  pago: Centavos
}

/** Recebido e pago mês a mês, terminando em ateMes. */
export function serieParceiro(lancamentos: Lancamento[], parceiroId: string, ateMes: MesISO, meses: number): PontoParceiro[] {
  const serie = Array.from({ length: meses }, (_, i) => ({ mes: addMeses(ateMes, i - meses + 1), recebido: 0, pago: 0 }))
  const pos = new Map(serie.map((p, i) => [p.mes, i]))
  for (const l of lancamentosDo(lancamentos, parceiroId)) {
    if (l.situacao !== 'realizado' || !l.dataPagamento) continue
    const i = pos.get(mesDe(l.dataPagamento))
    if (i === undefined) continue
    if (l.natureza === 'entrada') serie[i].recebido += l.valor
    else serie[i].pago += l.valor
  }
  return serie
}

/** Para onde foi (ou de onde veio) o dinheiro com este parceiro, por categoria. */
export function categoriasDoParceiro(dados: Pick<Dados, 'lancamentos' | 'categorias'>, parceiroId: string, periodo: Periodo): { nome: string; valor: Centavos; natureza: 'entrada' | 'saida' }[] {
  const somas = new Map<string, { nome: string; valor: Centavos; natureza: 'entrada' | 'saida' }>()
  for (const l of lancamentosDo(dados.lancamentos, parceiroId)) {
    if (l.situacao !== 'realizado' || !noPeriodo(l.dataPagamento, periodo)) continue
    const natureza = l.natureza as 'entrada' | 'saida'
    const chave = `${natureza}|${l.categoriaId ?? ''}`
    const nome = dados.categorias.find((c) => c.id === l.categoriaId)?.nome ?? 'Sem categoria'
    const atual = somas.get(chave) ?? { nome, valor: 0, natureza }
    atual.valor += l.valor
    somas.set(chave, atual)
  }
  return [...somas.values()].sort((a, b) => b.valor - a.valor)
}

export interface LinhaRanking {
  parceiro: Parceiro
  resumo: ResumoParceiro
}

/** Todos os parceiros com o resumo do período (para a lista e o ranking). */
export function resumoDeTodos(dados: Pick<Dados, 'lancamentos' | 'parceiros'>, periodo: Periodo, hoje: DataISO): LinhaRanking[] {
  return (dados.parceiros ?? []).map((parceiro) => ({ parceiro, resumo: resumoParceiro(dados.lancamentos, parceiro.id, periodo, hoje) }))
}

export interface NomeSugerido {
  nome: string
  tipo: TipoParceiro
  /** Em quantos lançamentos e atendimentos o nome aparece. */
  vezes: number
  telefone?: string
}

/**
 * Nomes já usados em lançamentos e na agenda que ainda não têm ficha: viram sugestões de
 * cadastro, para ninguém precisar digitar de novo os clientes e fornecedores de sempre.
 */
export function nomesSemCadastro(dados: Pick<Dados, 'lancamentos' | 'atendimentos' | 'parceiros'>): NomeSugerido[] {
  const cadastrados = new Set((dados.parceiros ?? []).map((p) => normalizarNome(p.nome)))
  const achados = new Map<string, { nome: string; cliente: boolean; fornecedor: boolean; vezes: number; telefone?: string }>()
  const anotar = (nome: string | undefined, cliente: boolean, telefone?: string) => {
    const chave = normalizarNome(nome ?? '')
    if (!chave || cadastrados.has(chave)) return
    const a = achados.get(chave) ?? { nome: nome!.trim(), cliente: false, fornecedor: false, vezes: 0 }
    if (cliente) a.cliente = true
    else a.fornecedor = true
    a.vezes++
    if (telefone && !a.telefone) a.telefone = telefone
    achados.set(chave, a)
  }
  for (const l of dados.lancamentos) if (conta(l) && !l.parceiroId) anotar(l.contraparte, l.natureza === 'entrada')
  for (const a of dados.atendimentos) if (!a.parceiroId) anotar(a.cliente, true, a.telefone)
  return [...achados.values()]
    .map((a) => ({ nome: a.nome, tipo: (a.cliente && a.fornecedor ? 'ambos' : a.cliente ? 'cliente' : 'fornecedor') as TipoParceiro, vezes: a.vezes, telefone: a.telefone }))
    .sort((a, b) => b.vezes - a.vezes || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Liga à ficha tudo o que ainda não tem ficha e usa o mesmo nome. */
function ligarPeloNome(d: Dados, p: Parceiro): Dados {
  const alvo = normalizarNome(p.nome)
  const mesmo = (nome?: string) => !!nome && normalizarNome(nome) === alvo
  const lancamentos = d.lancamentos.map((l) =>
    !l.parceiroId && conta(l) && mesmo(l.contraparte) && (l.natureza === 'entrada' ? ehCliente(p) : ehFornecedor(p)) ? { ...l, parceiroId: p.id } : l,
  )
  const recorrencias = d.recorrencias.map((r) =>
    !r.modelo.parceiroId && mesmo(r.modelo.contraparte) && (r.modelo.natureza === 'entrada' ? ehCliente(p) : ehFornecedor(p)) ? { ...r, modelo: { ...r.modelo, parceiroId: p.id } } : r,
  )
  const atendimentos = ehCliente(p) ? d.atendimentos.map((a) => (!a.parceiroId && mesmo(a.cliente) ? { ...a, parceiroId: p.id } : a)) : d.atendimentos
  return { ...d, lancamentos: troca(d.lancamentos, lancamentos), recorrencias: troca(d.recorrencias, recorrencias), atendimentos: troca(d.atendimentos, atendimentos) }
}

/** Mantém a lista antiga quando nada mudou (a sincronização compara referências). */
function troca<T>(antes: T[], depois: T[]): T[] {
  return depois.every((x, i) => x === antes[i]) ? antes : depois
}

export type NovoParceiro = Omit<Parceiro, 'id' | 'empresaId' | 'criadoEm'>

/**
 * Cadastra ou altera uma ficha. Ao cadastrar, o que já foi lançado com o mesmo nome entra na
 * ficha (ligarPeloNome). Ao trocar o nome, os lançamentos e atendimentos ligados passam a mostrar o nome novo.
 */
export function salvarParceiro(d: Dados, p: NovoParceiro, id: string, hoje: DataISO, ligarHistorico = true): Dados {
  const lista = d.parceiros ?? []
  const anterior = lista.find((x) => x.id === id)
  const registro: Parceiro = { ...p, nome: p.nome.trim(), id, empresaId: d.empresa.id, criadoEm: anterior?.criadoEm ?? hoje }
  let novo: Dados = { ...d, parceiros: anterior ? lista.map((x) => (x.id === id ? registro : x)) : [...lista, registro] }
  if (anterior && anterior.nome !== registro.nome) {
    const nome = registro.nome
    novo = {
      ...novo,
      lancamentos: troca(novo.lancamentos, novo.lancamentos.map((l) => (l.parceiroId === id && l.contraparte !== nome ? { ...l, contraparte: nome } : l))),
      recorrencias: troca(novo.recorrencias, novo.recorrencias.map((r) => (r.modelo.parceiroId === id && r.modelo.contraparte !== nome ? { ...r, modelo: { ...r.modelo, contraparte: nome } } : r))),
      atendimentos: troca(novo.atendimentos, novo.atendimentos.map((a) => (a.parceiroId === id && a.cliente !== nome ? { ...a, cliente: nome } : a))),
    }
  }
  return !anterior && ligarHistorico ? ligarPeloNome(novo, registro) : novo
}

/** Cadastra de uma vez os nomes sugeridos, já ligando o histórico de cada um. */
export function cadastrarSugeridos(d: Dados, nomes: NomeSugerido[], hoje: DataISO, novoId: () => string): Dados {
  return nomes.reduce((acc, n) => salvarParceiro(acc, { tipo: n.tipo, nome: n.nome, telefone: n.telefone, ativo: true }, novoId(), hoje), d)
}

/** Apaga a ficha. Os lançamentos ficam, só deixam de apontar para ela (o nome continua). */
export function excluirParceiro(d: Dados, id: string): Dados {
  const solta = <T extends { parceiroId?: string }>(x: T): T => {
    const { parceiroId: _, ...resto } = x
    return resto as T
  }
  return {
    ...d,
    parceiros: (d.parceiros ?? []).filter((p) => p.id !== id),
    lancamentos: troca(d.lancamentos, d.lancamentos.map((l) => (l.parceiroId === id ? solta(l) : l))),
    recorrencias: troca(d.recorrencias, d.recorrencias.map((r) => (r.modelo.parceiroId === id ? { ...r, modelo: solta(r.modelo) } : r))),
    atendimentos: troca(d.atendimentos, d.atendimentos.map((a) => (a.parceiroId === id ? solta(a) : a))),
  }
}

/**
 * Atribui lançamentos à ficha (ou tira, com parceiroId vazio). O nome da ficha vai para a
 * contraparte; a conta fixa de um previsto acompanha, para os próximos meses já nascerem ligados.
 */
export function vincularLancamentos(d: Dados, ids: string[], parceiroId: string | undefined): Dados {
  const p = parceiroId ? (d.parceiros ?? []).find((x) => x.id === parceiroId) : undefined
  if (parceiroId && !p) return d
  const alvo = new Set(ids)
  const recorrencias = new Set<string>()
  const lancamentos = d.lancamentos.map((l) => {
    if (!alvo.has(l.id)) return l
    if (l.recorrenciaId) recorrencias.add(l.recorrenciaId)
    if (!p) {
      const { parceiroId: _, ...resto } = l
      return resto
    }
    return { ...l, parceiroId: p.id, contraparte: p.nome }
  })
  return {
    ...d,
    lancamentos,
    recorrencias: troca(
      d.recorrencias,
      d.recorrencias.map((r) => {
        if (!recorrencias.has(r.id)) return r
        if (!p) {
          const { parceiroId: _, ...modelo } = r.modelo
          return { ...r, modelo }
        }
        return { ...r, modelo: { ...r.modelo, parceiroId: p.id, contraparte: p.nome } }
      }),
    ),
  }
}

/** Lançamentos que podem ir para a ficha: entradas (cliente) ou saídas (fornecedor) sem ficha ou de outra ficha. */
export function candidatosAVincular(lancamentos: Lancamento[], p: Parceiro): Lancamento[] {
  return lancamentos
    .filter((l) => conta(l) && l.parceiroId !== p.id && (l.natureza === 'entrada' ? ehCliente(p) : ehFornecedor(p)))
    .sort((a, b) => {
      // Mesmo nome primeiro; depois os mais recentes.
      const na = normalizarNome(a.contraparte ?? '') === normalizarNome(p.nome) ? 0 : 1
      const nb = normalizarNome(b.contraparte ?? '') === normalizarNome(p.nome) ? 0 : 1
      return na - nb || b.dataCompetencia.localeCompare(a.dataCompetencia)
    })
}

export function atendimentosDo(atendimentos: Atendimento[], p: Parceiro): Atendimento[] {
  return atendimentos.filter((a) => a.parceiroId === p.id).sort((a, b) => (b.data + b.inicio).localeCompare(a.data + a.inicio))
}

/** Iniciais para o avatar ("Padaria Central" = "PC"). */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p))
  const letras = (partes.length ? partes : nome.trim().split(/\s+/)).map((p) => p[0]).filter(Boolean)
  return (letras.length > 1 ? letras[0] + letras[letras.length - 1] : (letras[0] ?? '?')).toUpperCase()
}

/** Telefone só com dígitos, com o 55 do Brasil, para o link do WhatsApp. */
export function linkWhatsApp(telefone: string | undefined, texto?: string): string | undefined {
  const d = (telefone ?? '').replace(/\D/g, '')
  if (d.length < 10) return undefined
  const numero = d.length <= 11 ? `55${d}` : d
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}
