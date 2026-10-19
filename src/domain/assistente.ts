// Assistente: o que o app manda para a leitura (contexto do negócio) e como cada item que volta
// vira um lançamento, uma baixa de conta ou um atendimento. Nada é gravado sem o toque do cliente.
// O servidor (server/src/assistente.ts) devolve itens no mesmo formato de ItemAssistente.
import { addDias, brl, dataBR, diasEntre, mesDe, nomeMes } from '../lib/format'
import { contasAbertas, resumoMes, saldoCaixa } from './calc'
import { categoriaSugerida, formaDoTexto } from './extrato'
import type { NovoAtendimento } from './agenda'
import type { Centavos, Dados, DataISO, FormaPagamento, Lancamento } from './types'

export type TipoItem = 'lancamento' | 'baixa' | 'atendimento'

export interface ItemAssistente {
  tipo: TipoItem
  natureza: 'entrada' | 'saida' | 'retirada' | 'aporte'
  situacao: 'realizado' | 'previsto'
  valorCentavos: Centavos
  data: DataISO
  vencimento: DataISO | null
  categoriaId: string | null
  contaId: string | null
  formaPagamento: FormaPagamento
  descricao: string
  contraparte: string | null
  parceiroId: string | null
  pagoComDinheiroPessoal: boolean
  /** Qual das fotos enviadas vira o comprovante (0, 1, 2), ou null. */
  fotoComprovante: number | null
  /** Na baixa: a conta em aberto que foi paga ou recebida. */
  lancamentoId: string | null
  hora: string | null
  duracaoMin: number | null
  telefone: string | null
}

export interface RespostaAssistente {
  resposta: string
  acoes: ItemAssistente[]
}

export interface ContextoAssistente {
  hoje: DataISO
  empresa: { nome: string; atividade: string; ehMei: boolean }
  categorias: { id: string; nome: string; grupo: string }[]
  contas: { id: string; nome: string; tipo: string }[]
  parceiros: { id: string; nome: string; tipo: string }[]
  abertas: { id: string; natureza: string; descricao: string; valorCentavos: Centavos; vencimento: DataISO }[]
  resumo: string
  agenda: boolean
}

/** Números do mês em frases, para o assistente responder "quanto sobrou?" sem inventar. */
export function resumoParaAssistente(d: Dados, hoje: DataISO): string {
  const mes = mesDe(hoje)
  const r = resumoMes(d.lancamentos, mes)
  const pagar = contasAbertas(d.lancamentos, 'pagar')
  const receber = contasAbertas(d.lancamentos, 'receber')
  const atrasadas = pagar.filter((l) => l.dataVencimento! < hoje)
  const semana = pagar.filter((l) => l.dataVencimento! >= hoje && diasEntre(hoje, l.dataVencimento!) <= 7)
  return [
    `Mês de ${nomeMes(mes)} até hoje: entrou ${brl(r.entrou)}, saiu ${brl(r.saiu)}, sobrou ${brl(r.sobrou)}; o dono retirou ${brl(r.retirei)}; ficou no negócio ${brl(r.ficou)}.`,
    `Saldo de hoje somando todas as contas: ${brl(saldoCaixa(d, hoje))}.`,
    `Contas a pagar em atraso: ${atrasadas.length} (${brl(atrasadas.reduce((s, l) => s + l.valor, 0))}). Vencendo nos próximos 7 dias: ${semana.length} (${brl(semana.reduce((s, l) => s + l.valor, 0))}).`,
    `A receber em aberto: ${receber.length} (${brl(receber.reduce((s, l) => s + l.valor, 0))}).`,
  ].join(' ')
}

export function montarContexto(d: Dados, hoje: DataISO, comAgenda: boolean): ContextoAssistente {
  const abertas = d.lancamentos
    .filter((l) => l.situacao === 'previsto' && l.dataVencimento && (l.natureza === 'saida' || l.natureza === 'entrada'))
    .sort((a, b) => Math.abs(diasEntre(hoje, a.dataVencimento!)) - Math.abs(diasEntre(hoje, b.dataVencimento!)))
    .slice(0, 80)
  return {
    hoje,
    empresa: { nome: d.empresa.nomeFantasia, atividade: d.empresa.atividade, ehMei: d.empresa.ehMei },
    categorias: d.categorias.filter((c) => c.ativa).map((c) => ({ id: c.id, nome: c.nome, grupo: c.grupo })),
    contas: d.contas.filter((c) => c.ativa).map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo })),
    parceiros: (d.parceiros ?? []).filter((p) => p.ativo).slice(0, 400).map((p) => ({ id: p.id, nome: p.nome, tipo: p.tipo })),
    abertas: abertas.map((l) => ({
      id: l.id,
      natureza: l.natureza,
      descricao: [l.descricao, l.contraparte].filter(Boolean).join(' · ').slice(0, 200) || 'Conta',
      valorCentavos: l.valor,
      vencimento: l.dataVencimento!,
    })),
    resumo: resumoParaAssistente(d, hoje),
    agenda: comAgenda,
  }
}

/** Conta padrão: dinheiro vai para o caixa; o resto, para o banco. */
export function contaPadrao(d: Pick<Dados, 'contas'>, forma: FormaPagamento): string {
  const ativas = d.contas.filter((c) => c.ativa)
  const tipo = forma === 'dinheiro' ? 'caixa' : 'banco'
  return (ativas.find((c) => c.tipo === tipo) ?? ativas.find((c) => c.tipo !== 'reserva') ?? ativas[0] ?? d.contas[0]).id
}

/** Item do assistente pronto para salvarLancamento. Categoria e conta que faltam vêm do jeito de sempre. */
export function itemParaLancamento(item: ItemAssistente, d: Dados): Omit<Lancamento, 'id' | 'empresaId'> {
  const previsto = item.situacao === 'previsto' && !!item.vencimento
  const natureza = item.natureza
  const categoriaId =
    natureza === 'aporte'
      ? undefined
      : natureza === 'retirada'
        ? (item.categoriaId ?? 'prolabore')
        : (item.categoriaId ?? categoriaSugerida(d, natureza, item.contraparte || item.descricao))
  return {
    natureza,
    valor: item.valorCentavos,
    categoriaId,
    contaFinanceiraId: item.contaId && d.contas.some((c) => c.id === item.contaId) ? item.contaId : contaPadrao(d, item.formaPagamento),
    situacao: previsto ? 'previsto' : 'realizado',
    dataCompetencia: item.data,
    dataVencimento: previsto ? item.vencimento! : undefined,
    dataPagamento: previsto ? undefined : item.data,
    formaPagamento: item.formaPagamento,
    descricao: item.descricao || undefined,
    contraparte: item.contraparte || undefined,
    parceiroId: item.parceiroId ?? undefined,
    notaEmitida: natureza === 'entrada' ? 'nao' : 'nao_se_aplica',
    pagoComDinheiroPessoal: natureza === 'saida' && item.pagoComDinheiroPessoal ? true : undefined,
  }
}

export function itemParaAtendimento(item: ItemAssistente): NovoAtendimento {
  return {
    cliente: item.contraparte || 'Cliente',
    telefone: item.telefone ?? undefined,
    servico: item.descricao || undefined,
    data: item.data,
    inicio: item.hora ?? '09:00',
    duracaoMin: item.duracaoMin ?? 60,
    valor: item.valorCentavos > 0 ? item.valorCentavos : undefined,
    situacao: 'agendado',
    parceiroId: item.parceiroId ?? undefined,
  }
}

const NOME_NATUREZA: Record<ItemAssistente['natureza'], string> = { entrada: 'Entrada', saida: 'Saída', retirada: 'Retirada para você', aporte: 'Dinheiro seu no negócio' }

/** Título curto do item: "Saída de R$ 45,00", "Conta a pagar de R$ 300,00", "Atendimento às 14:00". */
export function tituloDoItem(item: ItemAssistente): string {
  if (item.tipo === 'atendimento') return `Atendimento ${item.hora ? `às ${item.hora}` : ''}`.trim()
  if (item.tipo === 'baixa') return `${item.natureza === 'entrada' ? 'Recebimento' : 'Pagamento'} de ${brl(item.valorCentavos, { centavos: true })}`
  const valor = brl(item.valorCentavos, { centavos: true })
  if (item.situacao === 'previsto') return `${item.natureza === 'entrada' ? 'Conta a receber' : 'Conta a pagar'} de ${valor}`
  return `${NOME_NATUREZA[item.natureza]} de ${valor}`
}

/** Linha de detalhes: "Combustível · Caixa · hoje". */
export function detalhesDoItem(item: ItemAssistente, d: Dados, hoje: DataISO): string[] {
  const quando = (x: DataISO) => (x === hoje ? 'hoje' : diasEntre(x, hoje) === 1 ? 'ontem' : diasEntre(hoje, x) === 1 ? 'amanhã' : dataBR(x))
  if (item.tipo === 'atendimento') return [item.contraparte ?? 'Cliente', item.descricao, quando(item.data), item.valorCentavos > 0 ? brl(item.valorCentavos) : ''].filter(Boolean) as string[]
  if (item.tipo === 'baixa') {
    const conta = d.lancamentos.find((l) => l.id === item.lancamentoId)
    return [conta?.descricao || conta?.contraparte || 'Conta em aberto', conta?.dataVencimento ? `vencia ${quando(conta.dataVencimento)}` : '', 'marca como paga hoje'].filter(Boolean)
  }
  const l = itemParaLancamento(item, d)
  const categoria = d.categorias.find((c) => c.id === l.categoriaId)?.nome
  const conta = d.contas.find((c) => c.id === l.contaFinanceiraId)?.nome
  return [
    item.descricao,
    categoria,
    item.contraparte && item.contraparte !== item.descricao ? item.contraparte : '',
    conta,
    l.situacao === 'previsto' ? `vence ${quando(l.dataVencimento!)}` : quando(item.data),
    l.pagoComDinheiroPessoal ? 'pago com dinheiro pessoal' : '',
  ].filter(Boolean) as string[]
}

// ---------- Demonstração (sem servidor): entende frases simples, sem inteligência artificial ----------

const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * "45", "45,90", "R$ 1.200", "1200 reais" → centavos. Com mais de um número ("3 bolos por 120"),
 * vale o que vem depois de "por" ou "R$"; senão, o maior. "Dia 25" não é valor.
 */
function valorDoTexto(t: string): Centavos | null {
  const limpo = t.replace(/\bdia \d{1,2}\b/g, ' ')
  const achados = [...limpo.matchAll(/(por |r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/g)].map((m) => ({
    marcado: !!m[1],
    v: Number(m[2].replace(/\./g, '')) * 100 + (m[3] ? Number(m[3].padEnd(2, '0')) : 0),
  }))
  const valido = achados.filter((a) => a.v > 0)
  if (!valido.length) return null
  return (valido.find((a) => a.marcado) ?? valido.reduce((a, b) => (b.v > a.v ? b : a))).v
}

const PALAVRAS_SOLTAS =
  /\b(gastei|paguei|comprei|vendi|recebi|entrou|ganhei|cobrei|retirei|tirei|coloquei|de|do|da|dos|das|no|na|nos|nas|em|com|por|pra|para|hoje|ontem|anteontem|pix|dinheiro|cartao|credito|debito|boleto|reais|real|r\$|o|a|os|as|um|uma|e|vence|dia|mim|meu|minha)\b/g

function dataDoTexto(t: string, hoje: DataISO): DataISO {
  if (/\bontem\b/.test(t)) return addDias(hoje, -1)
  if (/\banteontem\b/.test(t)) return addDias(hoje, -2)
  return hoje
}

/** "dia 25" → próximo dia 25 (este mês ou o seguinte). */
function vencimentoDoTexto(t: string, hoje: DataISO): DataISO | null {
  const m = t.match(/\bdia (\d{1,2})\b/)
  if (!m) return /amanha/.test(t) ? addDias(hoje, 1) : null
  const dia = Math.min(28, Math.max(1, Number(m[1])))
  const [a, me, d] = hoje.split('-').map(Number)
  const mesmoMes = dia >= d
  const ano = mesmoMes || me < 12 ? a : a + 1
  const mes = mesmoMes ? me : (me % 12) + 1
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function interpretarDemo(texto: string, d: Dados, hoje: DataISO, fotos: number): RespostaAssistente {
  const t = normal(texto)
  if (!t.trim() && fotos)
    return { resposta: 'Na demonstração eu ainda não leio fotos. No sistema de verdade, é só mandar a foto do recibo ou do boleto que eu preencho tudo. Experimente escrever, por exemplo: "gastei 45 de gasolina".', acoes: [] }
  if (/quanto|sobrou|saldo|vence|vencendo/.test(t) && !valorDoTexto(t)) {
    const r = resumoMes(d.lancamentos, mesDe(hoje))
    return { resposta: `Neste mês entrou ${brl(r.entrou)}, saiu ${brl(r.saiu)} e sobrou ${brl(r.sobrou)}.`, acoes: [] }
  }
  const valor = valorDoTexto(t)
  const pagueiConta = /\b(paguei|recebi)\b/.test(t)
    ? contasAbertas(d.lancamentos, /recebi/.test(t) ? 'receber' : 'pagar').find((l) => {
        const nome = normal(`${l.descricao ?? ''} ${l.contraparte ?? ''}`)
        return nome.split(/\s+/).some((p) => p.length > 3 && t.includes(p)) && (!valor || valor === l.valor)
      })
    : undefined
  const base = { vencimento: null, categoriaId: null, contaId: null, contraparte: null, parceiroId: null, pagoComDinheiroPessoal: false, fotoComprovante: null, lancamentoId: null, hora: null, duracaoMin: null, telefone: null }
  if (pagueiConta)
    return {
      resposta: 'Achei essa conta em aberto. Confira e confirme que eu marco como paga.',
      acoes: [{ ...base, tipo: 'baixa', natureza: pagueiConta.natureza as 'entrada' | 'saida', situacao: 'realizado', valorCentavos: valor ?? pagueiConta.valor, data: hoje, formaPagamento: pagueiConta.formaPagamento, descricao: pagueiConta.descricao ?? '', lancamentoId: pagueiConta.id }],
    }
  if (!valor) return { resposta: 'Não achei o valor. Pode me dizer quanto foi? Por exemplo: "vendi 2 bolos por 120" ou "gastei 45 de gasolina".', acoes: [] }
  const natureza: ItemAssistente['natureza'] = /\b(vendi|recebi|entrou|ganhei|faturei|cobrei)\b/.test(t)
    ? 'entrada'
    : /\b(retirei|tirei|pro.?labore|pra mim|para mim)\b/.test(t)
      ? 'retirada'
      : /\b(coloquei|aportei|investi do meu)\b/.test(t)
        ? 'aporte'
        : 'saida'
  const venc = /vence|vencimento|boleto|a pagar|vou pagar|a receber|fiado/.test(t) ? vencimentoDoTexto(t, hoje) : null
  const forma: FormaPagamento = /dinheiro|especie/.test(t) ? 'dinheiro' : /cartao|credito/.test(t) ? 'credito' : /boleto/.test(t) ? 'boleto' : formaDoTexto(t) === 'outro' ? 'pix' : formaDoTexto(t)
  // O que sobra sem verbos, números e palavras soltas: "gasolina", "bolos", "aluguel".
  const sobre = t.replace(/[\d.,$]+/g, ' ').replace(PALAVRAS_SOLTAS, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
  const descricao = sobre ? sobre.charAt(0).toUpperCase() + sobre.slice(1) : natureza === 'entrada' ? 'Venda' : natureza === 'retirada' ? 'Retirada' : natureza === 'aporte' ? 'Aporte' : 'Gasto'
  const item: ItemAssistente = { ...base, tipo: 'lancamento', natureza, situacao: venc ? 'previsto' : 'realizado', vencimento: venc, valorCentavos: valor, data: dataDoTexto(t, hoje), formaPagamento: forma, descricao, pagoComDinheiroPessoal: natureza === 'saida' && /pessoal|meu cartao|do meu bolso/.test(t) }
  return { resposta: 'Preparei isto. Confira e toque em Confirmar.', acoes: [item] }
}
