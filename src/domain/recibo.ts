// Recibo simples: o comprovante que o cliente pede depois de pagar. Não é nota fiscal (o Gynfinance
// ainda não emite nota); serve para a pessoa guardar ou mandar pelo WhatsApp.
import { brl, dataBR } from '../lib/format'
import type { Empresa, Lancamento } from './types'

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

/** 0 a 999 por extenso. */
function ate999(n: number): string {
  if (n === 100) return 'cem'
  const partes: string[] = []
  const c = Math.floor(n / 100)
  const resto = n % 100
  if (c) partes.push(CENTENAS[c])
  if (resto) {
    if (resto < 20) partes.push(UNIDADES[resto])
    else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d])
    }
  }
  return partes.join(' e ') || 'zero'
}

/** Número inteiro por extenso, até a casa dos bilhões: 1.250 → "mil duzentos e cinquenta". */
export function numeroPorExtenso(n: number): string {
  if (n === 0) return 'zero'
  const grupos: number[] = []
  for (let x = n; x > 0; x = Math.floor(x / 1000)) grupos.push(x % 1000)
  const nomes: [string, string][] = [
    ['', ''],
    ['mil', 'mil'],
    ['milhão', 'milhões'],
    ['bilhão', 'bilhões'],
  ]
  const partes: { texto: string; valor: number }[] = []
  grupos.forEach((g, i) => {
    if (!g) return
    const [um, varios] = nomes[i]
    const texto = i === 1 && g === 1 ? 'mil' : i === 0 ? ate999(g) : `${ate999(g)} ${g === 1 ? um : varios}`
    partes.unshift({ texto, valor: g })
  })
  // "e" antes do último grupo quando ele é menor que cem ou uma centena redonda: "mil e cem", "dois mil e cinco".
  return partes
    .map((p, i) => {
      if (i === 0) return p.texto
      const ultimo = i === partes.length - 1
      return ultimo && (p.valor < 100 || p.valor % 100 === 0) ? `e ${p.texto}` : p.texto
    })
    .join(' ')
}

/** Centavos por extenso: 125050 → "mil duzentos e cinquenta reais e cinquenta centavos". */
export function valorPorExtenso(centavos: number): string {
  const reais = Math.floor(centavos / 100)
  const cents = centavos % 100
  const milhoesRedondos = reais >= 1_000_000 && reais % 1_000_000 === 0
  const parteReais = reais ? `${numeroPorExtenso(reais)}${milhoesRedondos ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}` : ''
  const parteCents = cents ? `${numeroPorExtenso(cents)} ${cents === 1 ? 'centavo' : 'centavos'}` : ''
  if (parteReais && parteCents) return `${parteReais} e ${parteCents}`
  return parteReais || parteCents || 'zero reais'
}

/** Número curto do recibo, estável para o mesmo lançamento. */
export function numeroDoRecibo(l: Lancamento): string {
  let h = 0
  for (const ch of l.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return String(h % 1_000_000).padStart(6, '0')
}

/** Só entradas recebidas viram recibo. */
export function podeTerRecibo(l: Lancamento): boolean {
  return l.natureza === 'entrada' && l.situacao === 'realizado'
}

export function dataDoRecibo(l: Lancamento): string {
  return l.dataPagamento ?? l.dataCompetencia
}

/** Texto do recibo para mandar pelo WhatsApp. */
export function textoRecibo(l: Lancamento, empresa: Empresa): string {
  const de = l.contraparte?.trim()
  const linhas = [
    `*Recibo nº ${numeroDoRecibo(l)}*`,
    '',
    `${empresa.nomeFantasia} recebeu${de ? ` de ${de}` : ''} o valor de ${brl(l.valor, { centavos: true, sempre: true })} (${valorPorExtenso(l.valor)})${l.descricao ? `, referente a ${l.descricao}` : ''}.`,
    '',
    `Data: ${dataBR(dataDoRecibo(l))}`,
  ]
  if (empresa.cnpj) linhas.push(`CNPJ: ${empresa.cnpj}`)
  linhas.push('', 'Obrigado pela preferência!')
  return linhas.join('\n')
}
