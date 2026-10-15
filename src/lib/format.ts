import type { DataISO, MesISO } from '../domain/types'

const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 })
const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** R$ 2.480 para valores inteiros, R$ 99,90 quando há centavos. */
export function brl(valor: number, opts: { centavos?: boolean } = {}): string {
  const temCentavos = Math.round(valor * 100) % 100 !== 0
  const s = (opts.centavos ?? temCentavos) ? brl2.format(valor) : brl0.format(valor)
  return s.replace(/ /g, ' ')
}

export function pct(valor: number): string {
  return `${Math.round(valor * 100)}%`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function nomeMes(mes: MesISO): string {
  return MESES[Number(mes.slice(5, 7)) - 1]
}
export function nomeMesCurto(mes: MesISO): string {
  return MESES_CURTOS[Number(mes.slice(5, 7)) - 1]
}
export function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
/** "Outubro 2026" */
export function mesAno(mes: MesISO): string {
  return `${capitalizar(nomeMes(mes))} ${mes.slice(0, 4)}`
}

/** 24/10/2026 */
export function dataBR(d: DataISO): string {
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}
/** 24/10 */
export function diaMes(d: DataISO): string {
  return dataBR(d).slice(0, 5)
}

export function mesDe(d: DataISO): MesISO {
  return d.slice(0, 7)
}

export function addDias(d: DataISO, dias: number): DataISO {
  const dt = new Date(`${d}T12:00:00`)
  dt.setDate(dt.getDate() + dias)
  return dt.toISOString().slice(0, 10)
}

export function diasEntre(de: DataISO, ate: DataISO): number {
  const a = new Date(`${de}T12:00:00`).getTime()
  const b = new Date(`${ate}T12:00:00`).getTime()
  return Math.round((b - a) / 86400000)
}

export function addMeses(mes: MesISO, n: number): MesISO {
  const ano = Number(mes.slice(0, 4))
  const m = Number(mes.slice(5, 7)) - 1 + n
  const a2 = ano + Math.floor(m / 12)
  const m2 = ((m % 12) + 12) % 12
  return `${a2}-${String(m2 + 1).padStart(2, '0')}`
}

export function hojeReal(): DataISO {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Lê "1.234,56", "1234,5" ou "1234.56" e devolve número. */
export function lerValor(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, '')
  if (!limpo) return 0
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : 0
}

/** Prazo em linguagem simples: "vence amanhã", "atrasada há 3 dias". */
export function prazo(venc: DataISO, hoje: DataISO, feminino = true): string {
  const d = diasEntre(hoje, venc)
  if (d === 0) return 'vence hoje'
  if (d === 1) return 'vence amanhã'
  if (d > 1) return `vence ${diaMes(venc)}`
  const atrasad = feminino ? 'atrasada' : 'atrasado'
  return d === -1 ? `${atrasad} há 1 dia` : `${atrasad} há ${-d} dias`
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
