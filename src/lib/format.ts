import type { DataISO, MesISO } from '../domain/types'

const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 })
const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Recebe centavos. R$ 2.480 para valores redondos, R$ 99,90 quando há centavos. */
export function brl(centavos: number, opts: { centavos?: boolean } = {}): string {
  const temCentavos = centavos % 100 !== 0
  const reais = centavos / 100
  const s = (opts.centavos ?? temCentavos) ? brl2.format(reais) : brl0.format(reais)
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

/** Valor para um campo de edição: 1234 vira "12,34". */
export function centavosParaTexto(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Lê o que a pessoa digitou ("1.234,56", "1234,5", "R$ 50", "1.500") e devolve centavos.
 * Vírgula é sempre decimal. Ponto é decimal só quando é o único separador e tem 1 ou 2 casas depois.
 */
export function lerValor(texto: string): number {
  const limpo = texto.replace(/[^\d,.]/g, '')
  if (!limpo) return 0
  let normalizado: string
  if (limpo.includes(',')) normalizado = limpo.replace(/\./g, '').replace(',', '.')
  else if (/^\d+\.\d{1,2}$/.test(limpo)) normalizado = limpo
  else normalizado = limpo.replace(/\./g, '')
  const n = Number(normalizado)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
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

/** Id novo no formato UUID, o mesmo que o banco do servidor usa. */
export function uid(): string {
  // randomUUID só existe em HTTPS; num endereço http (como pelo IP da VPS) monta o mesmo formato.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * Texto digitado (ou vindo do extrato do banco) que começa com =, +, -, @ viraria fórmula ao abrir a
 * planilha no Excel e poderia abrir links ou rodar comandos no computador de quem abre: o apóstrofo
 * na frente faz o Excel mostrar como texto.
 */
export const textoSeguro = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v)
