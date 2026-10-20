// Olhar para a frente: previsão do caixa, quanto dá para tirar, metas, tetos e o resumo da semana.
// Tudo em centavos inteiros e regime de caixa, como o resto do painel (ver calc.ts).
import { addDias, addMeses, diasEntre, mesDe } from '../lib/format'
import { resumoMes, saldoCaixa } from './calc'
import type { Centavos, Dados, DataISO, Lancamento, MesISO } from './types'

const soma = (ls: Lancamento[]) => ls.reduce((t, l) => t + l.valor, 0)
const aberta = (l: Lancamento) => l.situacao === 'previsto' && !!l.dataVencimento

// ---------- Vai faltar dinheiro? ----------

export interface PontoPrevisao {
  dia: DataISO
  saldo: Centavos
  entra: Centavos
  sai: Centavos
}

export interface Previsao {
  pontos: PontoPrevisao[]
  hoje: Centavos
  /** Primeiro dia em que o caixa fica abaixo de zero, se ficar. */
  primeiroNegativo?: PontoPrevisao
  /** O dia de menor saldo no período. */
  menor: PontoPrevisao
  /** Contas a pagar já vencidas: entram como se fossem pagas hoje. */
  atrasadoPagar: Centavos
  /** Contas a receber já vencidas: ficam de fora, porque ninguém sabe quando o cliente paga. */
  atrasadoReceber: Centavos
}

/**
 * Saldo do caixa (sem a reserva) dia a dia, somando o que vence: a receber entra no vencimento,
 * a pagar sai no vencimento. O que já atrasou a pagar sai hoje; o que atrasou a receber não conta.
 */
export function previsaoCaixa(dados: Pick<Dados, 'contas' | 'lancamentos'>, hoje: DataISO, dias = 60): Previsao {
  const inicial = saldoCaixa(dados)
  const ate = addDias(hoje, dias)
  const porDia = new Map<DataISO, { entra: number; sai: number }>()
  const marcar = (dia: DataISO, entra: number, sai: number) => {
    const x = porDia.get(dia) ?? { entra: 0, sai: 0 }
    porDia.set(dia, { entra: x.entra + entra, sai: x.sai + sai })
  }
  let atrasadoPagar = 0
  let atrasadoReceber = 0
  for (const l of dados.lancamentos) {
    if (!aberta(l) || l.dataVencimento! > ate) continue
    const atrasada = l.dataVencimento! < hoje
    if (l.natureza === 'entrada') {
      if (atrasada) atrasadoReceber += l.valor
      else marcar(l.dataVencimento!, l.valor, 0)
    } else if (l.natureza === 'saida' || l.natureza === 'retirada') {
      if (atrasada) atrasadoPagar += l.valor
      marcar(atrasada ? hoje : l.dataVencimento!, 0, l.valor)
    }
  }
  const pontos: PontoPrevisao[] = []
  let saldo = inicial
  for (let i = 0; i <= dias; i++) {
    const dia = addDias(hoje, i)
    const m = porDia.get(dia) ?? { entra: 0, sai: 0 }
    saldo += m.entra - m.sai
    pontos.push({ dia, saldo, entra: m.entra, sai: m.sai })
  }
  return {
    pontos,
    hoje: inicial,
    primeiroNegativo: pontos.find((p) => p.saldo < 0),
    menor: pontos.reduce((a, b) => (b.saldo < a.saldo ? b : a)),
    atrasadoPagar,
    atrasadoReceber,
  }
}

// ---------- Quanto posso tirar para mim ----------

export interface Prolabore {
  /** O valor sugerido para tirar ainda este mês (arredondado para baixo, de R$ 10 em R$ 10). */
  sugerido: Centavos
  /** Quanto o negócio costuma gerar por mês (média dos últimos meses fechados, ou o mês atual). */
  geraPorMes: Centavos
  mesesUsados: number
  retirado: Centavos
  /** Caixa de hoje menos as contas dos próximos 30 dias, mais o que entra em dia. */
  folga: Centavos
  saldo: Centavos
  aPagar30: Centavos
  aReceber30: Centavos
  /** O que limitou a sugestão: o que o negócio gera ou o dinheiro em caixa. */
  limite: 'gera' | 'caixa'
}

export function prolaboreSugerido(dados: Pick<Dados, 'contas' | 'lancamentos'>, hoje: DataISO): Prolabore {
  const mes = mesDe(hoje)
  // Média do que sobrou nos 3 meses anteriores que tiveram movimento; sem histórico, o mês atual.
  const anteriores = [1, 2, 3].map((i) => resumoMes(dados.lancamentos, addMeses(mes, -i))).filter((r) => r.entrou || r.saiu)
  const atual = resumoMes(dados.lancamentos, mes)
  const geraPorMes = anteriores.length ? Math.round(anteriores.reduce((t, r) => t + r.sobrou, 0) / anteriores.length) : atual.sobrou
  const saldo = saldoCaixa(dados)
  const em30 = addDias(hoje, 30)
  const abertas = dados.lancamentos.filter((l) => aberta(l) && l.dataVencimento! <= em30)
  const aPagar30 = soma(abertas.filter((l) => l.natureza === 'saida'))
  const aReceber30 = soma(abertas.filter((l) => l.natureza === 'entrada' && l.dataVencimento! >= hoje))
  const folga = saldo - aPagar30 + aReceber30
  const pelaGeracao = geraPorMes - atual.retirei
  const bruto = Math.max(0, Math.min(pelaGeracao, folga))
  return {
    sugerido: Math.floor(bruto / 1000) * 1000,
    geraPorMes,
    mesesUsados: anteriores.length,
    retirado: atual.retirei,
    folga,
    saldo,
    aPagar30,
    aReceber30,
    limite: folga < pelaGeracao ? 'caixa' : 'gera',
  }
}

// ---------- Teto de gasto por categoria ----------

export interface UsoTeto {
  categoriaId: string
  nome: string
  limite: Centavos
  gasto: Centavos
  /** 1 = gastou o teto todo. */
  uso: number
}

/** Gasto do mês (pago no mês) em cada categoria que tem teto, do mais apertado para o mais folgado. */
export function usoDosTetos(dados: Pick<Dados, 'empresa' | 'categorias' | 'lancamentos'>, mes: MesISO): UsoTeto[] {
  const limites = dados.empresa.limitesCategoria ?? {}
  return Object.entries(limites)
    .filter(([, v]) => v > 0)
    .map(([categoriaId, limite]) => {
      const gasto = soma(
        dados.lancamentos.filter(
          (l) => l.natureza === 'saida' && l.categoriaId === categoriaId && l.situacao === 'realizado' && !!l.dataPagamento && mesDe(l.dataPagamento) === mes,
        ),
      )
      return { categoriaId, nome: dados.categorias.find((c) => c.id === categoriaId)?.nome ?? 'Categoria', limite, gasto, uso: gasto / limite }
    })
    .sort((a, b) => b.uso - a.uso)
}

// ---------- Meta de faturamento ----------

export interface ProgressoMeta {
  meta: Centavos
  /** Vendas do mês pela data da venda (as categorias que contam no faturamento). */
  vendido: Centavos
  falta: Centavos
  /** Dias que faltam no mês, contando hoje. */
  diasRestantes: number
  /** Quanto precisa vender por dia, a partir de hoje, para bater a meta. */
  porDia: Centavos
  uso: number
}

export function faturadoNoMes(dados: Pick<Dados, 'categorias' | 'lancamentos'>, mes: MesISO): Centavos {
  const contam = new Set(dados.categorias.filter((c) => c.contaNoFaturamento).map((c) => c.id))
  return soma(dados.lancamentos.filter((l) => l.natureza === 'entrada' && l.situacao !== 'cancelado' && !!l.categoriaId && contam.has(l.categoriaId) && mesDe(l.dataCompetencia) === mes))
}

export function progressoMeta(dados: Pick<Dados, 'empresa' | 'categorias' | 'lancamentos'>, mes: MesISO, hoje: DataISO): ProgressoMeta | null {
  const meta = dados.empresa.metaFaturamento
  if (!meta) return null
  const vendido = faturadoNoMes(dados, mes)
  const falta = Math.max(0, meta - vendido)
  const ultimoDia = addDias(`${addMeses(mes, 1)}-01`, -1)
  // Mês que já passou: não há mais dias; mês futuro: o mês inteiro.
  const desde = mes === mesDe(hoje) ? hoje : mes > mesDe(hoje) ? `${mes}-01` : addDias(ultimoDia, 1)
  const diasRestantes = Math.max(0, diasEntre(desde, ultimoDia) + 1)
  return { meta, vendido, falta, diasRestantes, porDia: diasRestantes ? Math.ceil(falta / diasRestantes) : 0, uso: vendido / meta }
}

// ---------- Resumo da semana ----------

export interface ResumoSemana {
  /** Segunda-feira desta semana (o id do cartão, para dispensar). */
  segunda: DataISO
  entrou: Centavos
  saiu: Centavos
  aPagar: { total: Centavos; quantidade: number }
  aReceber: { total: Centavos; quantidade: number }
  dica: string
}

const DICAS = [
  'Separe o dinheiro da empresa do seu: pague-se um pró-labore fixo e não tire do caixa no meio do mês.',
  'Pequenos gastos somam. Taxa de maquininha, tarifa do banco e frete chegam a 5% do faturamento sem você perceber.',
  'Cobre no dia do vencimento. Quanto mais tempo passa, mais difícil fica receber.',
  'Guarde uma reserva de pelo menos um mês de contas fixas. É ela que segura um mês fraco.',
  'Lance as vendas no mesmo dia. Uma semana sem lançar já esconde para onde foi o dinheiro.',
  'Revise o preço pelo menos uma vez por ano. Se o custo subiu e o preço não, você está pagando para trabalhar.',
  'Confira o limite do MEI todo mês. Passar dele sem perceber custa caro.',
  'Negocie prazo com fornecedor e encurte o prazo do cliente. O caixa agradece.',
]

/** Últimos 7 dias (até ontem) e próximos 7 dias, mais uma dica que muda a cada semana. */
export function resumoSemana(dados: Pick<Dados, 'lancamentos'>, hoje: DataISO): ResumoSemana {
  const diaSemana = (new Date(`${hoje}T12:00:00Z`).getUTCDay() + 6) % 7 // segunda = 0
  const segunda = addDias(hoje, -diaSemana)
  const de = addDias(hoje, -7)
  const passados = dados.lancamentos.filter((l) => l.situacao === 'realizado' && !!l.dataPagamento && l.dataPagamento >= de && l.dataPagamento < hoje)
  const ate = addDias(hoje, 7)
  const vindo = dados.lancamentos.filter((l) => aberta(l) && l.dataVencimento! >= hoje && l.dataVencimento! <= ate)
  const pagar = vindo.filter((l) => l.natureza === 'saida')
  const receber = vindo.filter((l) => l.natureza === 'entrada')
  const semanaDoAno = Math.floor(diasEntre('2026-01-05', segunda) / 7)
  return {
    segunda,
    entrou: soma(passados.filter((l) => l.natureza === 'entrada')),
    saiu: soma(passados.filter((l) => l.natureza === 'saida')),
    aPagar: { total: soma(pagar), quantidade: pagar.length },
    aReceber: { total: soma(receber), quantidade: receber.length },
    dica: DICAS[((semanaDoAno % DICAS.length) + DICAS.length) % DICAS.length],
  }
}
