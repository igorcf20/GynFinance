// Regras de cálculo e alertas do módulo inicial.
// Painel em regime de caixa (data de pagamento); faturamento do MEI pela data da venda.
import { addMeses, brl, diasEntre, mesDe, nomeMes, prazo, capitalizar } from '../lib/format'
import { parametroDoAno } from './parametros'
import { previsaoCaixa, usoDosTetos } from './planejamento'
import type { Categoria, Centavos, ContaFinanceira, Dados, DataISO, Lancamento, MesISO, PagamentoDas } from './types'

const realizadoNoMes = (l: Lancamento, mes: MesISO) =>
  l.situacao === 'realizado' && !!l.dataPagamento && mesDe(l.dataPagamento) === mes

// Valores em centavos inteiros: somas exatas, sem arredondamento.
const soma = (ls: Lancamento[]) => ls.reduce((t, l) => t + l.valor, 0)

export interface ResumoMes {
  mes: MesISO
  entrou: number
  saiu: number
  sobrou: number
  retirei: number
  ficou: number
}

export function resumoMes(lancamentos: Lancamento[], mes: MesISO): ResumoMes {
  const doMes = lancamentos.filter((l) => realizadoNoMes(l, mes))
  const entrou = soma(doMes.filter((l) => l.natureza === 'entrada'))
  const saiu = soma(doMes.filter((l) => l.natureza === 'saida'))
  const retirei = soma(doMes.filter((l) => l.natureza === 'retirada'))
  const sobrou = entrou - saiu
  return { mes, entrou, saiu, sobrou, retirei, ficou: sobrou - retirei }
}

/** Variação do "sobrou" contra o mês anterior, ou null quando não dá para comparar. */
export function variacao(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null
  return (atual - anterior) / anterior
}

/** Metade do que ficou na empresa, arredondada para R$ 50 (5.000 centavos). */
export function reservaSugerida(r: ResumoMes): number {
  if (r.ficou <= 0) return 0
  return Math.round(r.ficou / 2 / 5000) * 5000
}

export function fraseSobrou(r: ResumoMes, maiores: string[]): string {
  if (r.entrou === 0 && r.saiu === 0) return 'Lance as entradas e saídas da semana para ver quanto sobra.'
  if (r.sobrou < 0) {
    const quais = maiores.slice(0, 2).join(' e ')
    return quais ? `Saiu mais do que entrou. As maiores saídas foram ${quais}.` : 'Saiu mais do que entrou neste mês.'
  }
  if (r.ficou >= r.entrou * 0.1) {
    const reserva = reservaSugerida(r)
    return reserva > 0 ? `Bom mês. Dá para guardar ${brl(reserva)} de reserva.` : 'Bom mês. O negócio deu resultado.'
  }
  return 'O negócio deu resultado, mas quase nada ficou no caixa.'
}

export function saldoPorConta(dados: Pick<Dados, 'contas' | 'lancamentos'>, ate?: DataISO): Map<string, number> {
  const saldos = new Map<string, number>(dados.contas.map((c) => [c.id, c.saldoInicial]))
  for (const l of dados.lancamentos) {
    if (l.situacao !== 'realizado' || !l.dataPagamento) continue
    if (ate && l.dataPagamento > ate) continue
    const atual = saldos.get(l.contaFinanceiraId) ?? 0
    if (l.natureza === 'entrada' || l.natureza === 'aporte') saldos.set(l.contaFinanceiraId, atual + l.valor)
    else if (l.natureza === 'saida' || l.natureza === 'retirada') saldos.set(l.contaFinanceiraId, atual - l.valor)
    else if (l.natureza === 'transferencia' && l.contaDestinoId) {
      saldos.set(l.contaFinanceiraId, atual - l.valor)
      saldos.set(l.contaDestinoId, (saldos.get(l.contaDestinoId) ?? 0) + l.valor)
    }
  }
  return saldos
}

/** Saldo do caixa da empresa: caixa e bancos, sem a reserva. */
export function saldoCaixa(dados: Pick<Dados, 'contas' | 'lancamentos'>, ate?: DataISO): number {
  const saldos = saldoPorConta(dados, ate)
  return dados.contas.filter((c: ContaFinanceira) => c.tipo !== 'reserva').reduce((t, c) => t + (saldos.get(c.id) ?? 0), 0)
}

export function saldoReserva(dados: Pick<Dados, 'contas' | 'lancamentos'>): number {
  const saldos = saldoPorConta(dados)
  return dados.contas.filter((c) => c.tipo === 'reserva').reduce((t, c) => t + (saldos.get(c.id) ?? 0), 0)
}

export interface GastoCategoria {
  categoriaId: string
  nome: string
  valor: number
}

export function gastosPorCategoria(lancamentos: Lancamento[], categorias: Categoria[], mes: MesISO): GastoCategoria[] {
  const mapa = new Map<string, number>()
  for (const l of lancamentos) {
    if (l.natureza !== 'saida' || !realizadoNoMes(l, mes) || !l.categoriaId) continue
    mapa.set(l.categoriaId, (mapa.get(l.categoriaId) ?? 0) + l.valor)
  }
  return [...mapa.entries()]
    .map(([categoriaId, valor]) => ({
      categoriaId,
      nome: categorias.find((c) => c.id === categoriaId)?.nome ?? 'Sem categoria',
      valor,
    }))
    .sort((a, b) => b.valor - a.valor)
}

export function receitasPorCategoria(lancamentos: Lancamento[], categorias: Categoria[], mes: MesISO): GastoCategoria[] {
  const mapa = new Map<string, number>()
  for (const l of lancamentos) {
    if (l.natureza !== 'entrada' || !realizadoNoMes(l, mes) || !l.categoriaId) continue
    mapa.set(l.categoriaId, (mapa.get(l.categoriaId) ?? 0) + l.valor)
  }
  return [...mapa.entries()]
    .map(([categoriaId, valor]) => ({ categoriaId, nome: categorias.find((c) => c.id === categoriaId)?.nome ?? 'Sem categoria', valor }))
    .sort((a, b) => b.valor - a.valor)
}

export function vendasSemNota(lancamentos: Lancamento[], mes: MesISO): number {
  return lancamentos.filter(
    (l) => l.natureza === 'entrada' && l.situacao !== 'cancelado' && mesDe(l.dataCompetencia) === mes && l.notaEmitida === 'nao',
  ).length
}

export function serieMensal(lancamentos: Lancamento[], ateMes: MesISO, meses: number): ResumoMes[] {
  return Array.from({ length: meses }, (_, i) => resumoMes(lancamentos, addMeses(ateMes, i - meses + 1)))
}

// ---------- Contas a pagar e a receber ----------

export type GrupoPrazo = 'atrasadas' | 'semana' | 'depois'

export function contasAbertas(lancamentos: Lancamento[], tipo: 'pagar' | 'receber'): Lancamento[] {
  const natureza = tipo === 'pagar' ? 'saida' : 'entrada'
  return lancamentos
    .filter((l) => l.situacao === 'previsto' && l.natureza === natureza && l.dataVencimento)
    .sort((a, b) => (a.dataVencimento! < b.dataVencimento! ? -1 : 1))
}

export function grupoPrazo(venc: DataISO, hoje: DataISO): GrupoPrazo {
  const d = diasEntre(hoje, venc)
  if (d < 0) return 'atrasadas'
  if (d <= 7) return 'semana'
  return 'depois'
}

/** Contas atrasadas e as que vencem nos próximos 7 dias, das duas abas. */
export function proximos7Dias(lancamentos: Lancamento[], hoje: DataISO): Lancamento[] {
  return lancamentos
    .filter((l) => l.situacao === 'previsto' && l.dataVencimento && diasEntre(hoje, l.dataVencimento) <= 7)
    .filter((l) => l.natureza === 'saida' || l.natureza === 'entrada')
    .sort((a, b) => (a.dataVencimento! < b.dataVencimento! ? -1 : 1))
}

// ---------- MEI ----------

export function faturadoNoAno(lancamentos: Lancamento[], categorias: Categoria[], ano: number, ate?: DataISO): number {
  const contam = new Set(categorias.filter((c) => c.contaNoFaturamento).map((c) => c.id))
  return soma(
    lancamentos.filter(
      (l) =>
        l.natureza === 'entrada' &&
        l.situacao !== 'cancelado' &&
        !!l.categoriaId &&
        contam.has(l.categoriaId) &&
        l.dataCompetencia.startsWith(String(ano)) &&
        (!ate || l.dataCompetencia <= ate),
    ),
  )
}

/** Limite do ano; no ano de abertura é proporcional aos meses de atividade. */
export function limiteDoAno(ano: number, dataAbertura: DataISO): number {
  const p = parametroDoAno(ano)
  const anoAbertura = Number(dataAbertura.slice(0, 4))
  if (anoAbertura < ano) return p.limiteAnual
  const mesesAtivos = 12 - Number(dataAbertura.slice(5, 7)) + 1
  return p.limiteMensalProporcional * mesesAtivos
}

export function projecaoAno(faturado: number, hoje: DataISO, dataAbertura: DataISO): number {
  const ano = Number(hoje.slice(0, 4))
  const mesHoje = Number(hoje.slice(5, 7))
  const mesInicio = Number(dataAbertura.slice(0, 4)) === ano ? Number(dataAbertura.slice(5, 7)) : 1
  const decorridos = mesHoje - mesInicio + 1
  const total = 12 - mesInicio + 1
  if (decorridos <= 0) return faturado
  return Math.round((faturado / decorridos) * total)
}

export interface SituacaoMei {
  ano: number
  faturado: number
  limite: number
  usado: number
  restante: number
  projecao: number
}

export function situacaoMei(dados: Dados, hoje: DataISO): SituacaoMei {
  const ano = Number(hoje.slice(0, 4))
  const antes = dados.empresa.faturadoAntes?.ano === ano ? dados.empresa.faturadoAntes.valor : 0
  const faturado = faturadoNoAno(dados.lancamentos, dados.categorias, ano) + antes
  const limite = limiteDoAno(ano, dados.empresa.dataAbertura)
  return {
    ano,
    faturado,
    limite,
    usado: limite > 0 ? faturado / limite : 0,
    restante: Math.max(0, limite - faturado),
    projecao: projecaoAno(faturado, hoje, dados.empresa.dataAbertura),
  }
}

export type EstadoDas = 'pago' | 'pendente' | 'atrasado' | 'futuro'

export function estadoDas(p: PagamentoDas | undefined, competencia: MesISO, hoje: DataISO): EstadoDas {
  if (p?.lancamentoId || p?.pagoForaDoSistema) return 'pago'
  // Como o usuário enxerga: "DAS de outubro" é o que vence no dia 20 de outubro.
  const mesHoje = mesDe(hoje)
  if (competencia > mesHoje) return 'futuro'
  if (competencia < mesHoje) return 'atrasado'
  return Number(hoje.slice(8, 10)) > parametroDoAno(Number(competencia.slice(0, 4))).dasDiaVencimento ? 'atrasado' : 'pendente'
}

export function vencimentoDas(competencia: MesISO): DataISO {
  const p = parametroDoAno(Number(competencia.slice(0, 4)))
  return `${competencia}-${String(p.dasDiaVencimento).padStart(2, '0')}`
}

// ---------- Alertas ----------
// Tabela "Alertas" do planejamento. O id de cada aviso traz o mês ou a conta, para que dispensar
// um aviso não esconda o do mês seguinte.

export type NivelAlerta = 'atencao' | 'perigo' | 'info'

export interface Alerta {
  id: string
  nivel: NivelAlerta
  texto: string
  acao?: { rotulo: string; para: string }
  /** Aparece também no topo do painel; os demais ficam só no sino. */
  painel: boolean
  /** Pode ser dispensado com o X (os que somem sozinhos com a ação, como o DAS, não). */
  dispensavel?: boolean
}

function nomeDaConta(l: Lancamento, categorias: Categoria[]): string {
  const nome = (l.natureza === 'entrada' ? l.contraparte || l.descricao : l.descricao || l.contraparte) || categorias.find((c) => c.id === l.categoriaId)?.nome
  return nome ?? (l.natureza === 'entrada' ? 'Um cliente' : 'Uma conta')
}

export function alertas(dados: Dados, hoje: DataISO): Alerta[] {
  const lista: Alerta[] = []
  const mes = mesDe(hoje)
  const dia = Number(hoje.slice(8, 10))
  const nMes = Number(hoje.slice(5, 7))
  const ano = Number(hoje.slice(0, 4))
  const mesPassado = addMeses(mes, -1)

  if (dados.empresa.ehMei) {
    const das = dados.pagamentosDas.find((p) => p.competencia === mes)
    const estado = estadoDas(das, mes, hoje)
    if (estado === 'pendente' && dia >= 15) {
      lista.push({ id: `das:${mes}`, nivel: 'atencao', painel: true, texto: `O DAS de ${nomeMes(mes)} vence dia 20.`, acao: { rotulo: 'Ver', para: '/mei' } })
    }
    if (estado === 'atrasado') {
      lista.push({ id: `das-atrasado:${mes}`, nivel: 'perigo', painel: true, texto: 'O DAS venceu. Pague logo para a multa não crescer.', acao: { rotulo: 'Ver', para: '/mei' } })
    }
    const s = situacaoMei(dados, hoje)
    const ver = { rotulo: 'Ver', para: '/mei' }
    if (s.usado > 1.2) {
      lista.push({ id: `mei-120:${ano}`, nivel: 'perigo', painel: true, texto: 'Você passou mais de 20% do limite do MEI. O desenquadramento vale desde janeiro. Procure um contador agora.', acao: ver })
    } else if (s.usado > 1) {
      lista.push({ id: `mei-100:${ano}`, nivel: 'perigo', painel: true, texto: 'Você passou o limite do MEI. Fale com um contador: no ano que vem a empresa deixa de ser MEI.', acao: ver })
    } else if (s.usado >= 0.9) {
      lista.push({ id: `mei-90:${ano}`, nivel: 'atencao', painel: true, dispensavel: true, texto: 'Atenção: falta pouco para o limite do MEI.', acao: ver })
    } else if (s.usado >= 0.7) {
      lista.push({ id: `mei-70:${ano}`, nivel: 'atencao', painel: true, dispensavel: true, texto: `Você já usou 70% do limite do ano. Ainda pode faturar ${brl(s.restante)}.`, acao: ver })
    } else if (nMes >= 3 && s.projecao > s.limite) {
      lista.push({ id: `mei-proj:${mes}`, nivel: 'atencao', painel: true, dispensavel: true, texto: 'No ritmo atual, você passa do limite do MEI este ano.', acao: ver })
    }
    // Declaração anual: de 1º de abril a 31 de maio, com o faturamento do ano anterior.
    if (nMes === 4 || nMes === 5) {
      const fat = faturadoNoAno(dados.lancamentos, dados.categorias, ano - 1) + (dados.empresa.faturadoAntes?.ano === ano - 1 ? dados.empresa.faturadoAntes.valor : 0)
      lista.push({
        id: `dasn:${ano}`,
        nivel: nMes === 5 && dia >= 15 ? 'atencao' : 'info',
        painel: true,
        dispensavel: true,
        texto: `A declaração anual do MEI (DASN-SIMEI) vence em 31/05. Seu faturamento de ${ano - 1} foi ${brl(fat)}.`,
        acao: ver,
      })
    }
  }

  // Contas a pagar atrasadas: no painel.
  const pagar = contasAbertas(dados.lancamentos, 'pagar')
  const atrasadas = pagar.filter((l) => diasEntre(hoje, l.dataVencimento!) < 0)
  if (atrasadas.length === 1) {
    const l = atrasadas[0]
    const d = -diasEntre(hoje, l.dataVencimento!)
    lista.push({ id: `atrasada:${l.id}`, nivel: 'perigo', painel: true, texto: `A conta "${nomeDaConta(l, dados.categorias)}" venceu há ${d} ${d === 1 ? 'dia' : 'dias'}.`, acao: { rotulo: 'Ver', para: '/contas' } })
  } else if (atrasadas.length > 1) {
    lista.push({ id: `atrasadas:${atrasadas.map((l) => l.id).join(',')}`, nivel: 'perigo', painel: true, texto: `${atrasadas.length} contas estão atrasadas, somando ${brl(soma(atrasadas))}.`, acao: { rotulo: 'Ver', para: '/contas' } })
  }

  // Contas vencendo: no dia e até X dias antes (Configurações, Notificações). Só no sino; o painel já mostra os próximos 7 dias.
  // Cada conta pode ter o próprio lembrete (Novo lançamento); sem ele, vale o padrão.
  for (const l of pagar.filter((l) => { const d = diasEntre(hoje, l.dataVencimento!); return d >= 0 && d <= (l.lembreteDias ?? dados.preferencias.lembreteDias) })) {
    const d = diasEntre(hoje, l.dataVencimento!)
    const quando = d === 0 ? 'Hoje vence' : d === 1 ? 'Amanhã vence' : `Em ${d} dias vence`
    lista.push({ id: `vence:${l.id}`, nivel: 'info', painel: false, texto: `${quando} ${nomeDaConta(l, dados.categorias)}: ${brl(l.valor)}.`, acao: { rotulo: 'Ver', para: '/contas' } })
  }

  // A receber atrasado: só no sino, com o atalho para cobrar.
  for (const l of contasAbertas(dados.lancamentos, 'receber').filter((l) => diasEntre(hoje, l.dataVencimento!) < 0)) {
    const [, m, d] = l.dataVencimento!.split('-')
    lista.push({
      id: `receber:${l.id}`,
      nivel: 'atencao',
      painel: false,
      texto: `${nomeDaConta(l, dados.categorias)} deve ${brl(l.valor)} desde ${d}/${m}. Cobrar pelo WhatsApp?`,
      acao: { rotulo: 'Cobrar', para: '/contas?aba=receber' },
    })
  }

  const r = resumoMes(dados.lancamentos, mes)
  if (r.retirei > r.sobrou && r.sobrou >= 0 && r.retirei > 0) {
    lista.push({ id: `retirada:${mes}`, nivel: 'atencao', painel: true, dispensavel: true, texto: `Você tirou ${brl(r.retirei - r.sobrou)} a mais do que o negócio gerou este mês.` })
  }

  // Vai faltar dinheiro nos próximos 30 dias, se nada mudar (Fluxo de caixa mostra a previsão inteira).
  const neg = previsaoCaixa(dados, hoje, 30).primeiroNegativo
  if (neg) {
    const quando = neg.dia === hoje ? 'Hoje' : `No dia ${neg.dia.slice(8, 10)}/${neg.dia.slice(5, 7)}`
    lista.push({
      id: `caixa-negativo:${neg.dia}`,
      nivel: diasEntre(hoje, neg.dia) <= 7 ? 'perigo' : 'atencao',
      painel: true,
      dispensavel: true,
      texto: `${quando} o caixa fica ${brl(-neg.saldo)} no vermelho, se nada mudar. Cobre quem deve ou adie uma conta.`,
      acao: { rotulo: 'Ver previsão', para: '/fluxo' },
    })
  }

  // Teto de gasto por categoria (Configurações > Metas e tetos).
  for (const t of usoDosTetos(dados, mes)) {
    if (t.uso >= 1) {
      lista.push({ id: `teto-100:${t.categoriaId}:${mes}`, nivel: 'perigo', painel: true, dispensavel: true, texto: `${t.nome} passou do teto do mês: ${brl(t.gasto)} de ${brl(t.limite)}.`, acao: { rotulo: 'Ver', para: '/relatorios' } })
    } else if (t.uso >= 0.8) {
      lista.push({ id: `teto-80:${t.categoriaId}:${mes}`, nivel: 'atencao', painel: true, dispensavel: true, texto: `${t.nome} já usou ${Math.round(t.uso * 100)}% do teto do mês. Restam ${brl(t.limite - t.gasto)}.`, acao: { rotulo: 'Ver', para: '/relatorios' } })
    }
  }

  const aportes = dados.lancamentos.filter((l) => l.natureza === 'aporte' && l.espelhoDe && l.dataPagamento && mesDe(l.dataPagamento) === mes)
  if (aportes.length >= 3) {
    lista.push({ id: `mistura:${mes}`, nivel: 'info', painel: true, dispensavel: true, texto: `Você usou dinheiro pessoal ${aportes.length} vezes este mês. Que tal manter um valor fixo no caixa da empresa?` })
  }

  // Primeira semana do mês: fechamento do mês que terminou e vendas que ficaram sem nota.
  if (dia <= 7 && dados.lancamentos.some((l) => l.dataPagamento && mesDe(l.dataPagamento) === mesPassado)) {
    const rp = resumoMes(dados.lancamentos, mesPassado)
    const fechou = rp.sobrou >= 0 ? `sobrou ${brl(rp.sobrou)}` : `faltou ${brl(-rp.sobrou)}`
    lista.push({
      id: `fechamento:${mesPassado}`,
      nivel: 'info',
      painel: true,
      dispensavel: true,
      texto: `${capitalizar(nomeMes(mesPassado))} fechou: ${fechou}.`,
      acao: { rotulo: 'Ver resumo', para: '/fechamento' },
    })
    const semNota = vendasSemNota(dados.lancamentos, mesPassado)
    if (semNota > 0) {
      lista.push({
        id: `sem-nota:${mesPassado}`,
        nivel: 'atencao',
        painel: false,
        dispensavel: true,
        texto: `${semNota} ${semNota === 1 ? 'venda' : 'vendas'} de ${nomeMes(mesPassado)} ${semNota === 1 ? 'está' : 'estão'} sem nota.`,
        acao: { rotulo: 'Ver', para: `/lancamentos?situacao=semnota&mes=${mesPassado}` },
      })
    }
  }

  const dispensados = new Set(dados.avisosDispensados ?? [])
  return lista.filter((a) => !dispensados.has(a.id))
}

export function descricaoConta(l: Lancamento, hoje: DataISO): string {
  if (!l.dataVencimento) return ''
  if (l.natureza === 'entrada') {
    const d = diasEntre(hoje, l.dataVencimento)
    if (d < 0) return `A receber · Atrasado desde ${l.dataVencimento.slice(8, 10)}/${l.dataVencimento.slice(5, 7)}`
    return `A receber · ${prazo(l.dataVencimento, hoje, false).replace(/^v/, 'V')}`
  }
  return capitalizar(prazo(l.dataVencimento, hoje, true))
}

/** Quanto já foi separado para a reserva por conta do resultado do mês (pela competência). */
export function separadoNoMes(lancamentos: Lancamento[], mes: MesISO): number {
  return soma(lancamentos.filter((l) => l.natureza === 'transferencia' && l.situacao === 'realizado' && mesDe(l.dataCompetencia) === mes))
}

/** Sugestão de reserva que ainda falta separar no mês. */
export function reservaPendente(lancamentos: Lancamento[], mes: MesISO): number {
  return Math.max(0, reservaSugerida(resumoMes(lancamentos, mes)) - separadoNoMes(lancamentos, mes))
}

// ---------- Painel: o que vai entrar e o que está atrasado ----------

export interface Totalizador {
  total: Centavos
  quantidade: number
}

const totalizar = (ls: Lancamento[]): Totalizador => ({ total: soma(ls), quantidade: ls.length })

/** Contas a receber que ainda não venceram: o total e quanto chega nos próximos 30 dias. */
export function aReceberFuturo(lancamentos: Lancamento[], hoje: DataISO): Totalizador & { em30Dias: Centavos; proxima?: Lancamento } {
  const futuras = lancamentos
    .filter((l) => l.situacao === 'previsto' && l.natureza === 'entrada' && l.dataVencimento && l.dataVencimento >= hoje)
    .sort((a, b) => (a.dataVencimento! < b.dataVencimento! ? -1 : 1))
  return { ...totalizar(futuras), em30Dias: soma(futuras.filter((l) => diasEntre(hoje, l.dataVencimento!) <= 30)), proxima: futuras[0] }
}

/** Contas vencidas e não pagas, dos dois lados. */
export function emAtraso(lancamentos: Lancamento[], hoje: DataISO): { receber: Totalizador; pagar: Totalizador } {
  const vencidas = lancamentos.filter((l) => l.situacao === 'previsto' && l.dataVencimento && l.dataVencimento < hoje)
  return { receber: totalizar(vencidas.filter((l) => l.natureza === 'entrada')), pagar: totalizar(vencidas.filter((l) => l.natureza === 'saida')) }
}
