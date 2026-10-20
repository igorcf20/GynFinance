// Cores e textos da agenda, iguais em todas as visões.
import type { Evento } from '../../domain/agenda'
import type { DataISO } from '../../domain/types'
import { capitalizar, nomeMes } from '../../lib/format'

export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

export const diaDaSemana = (d: DataISO) => new Date(`${d}T12:00:00`).getDay()

/** "Quinta-feira, 15 de outubro" */
export function dataPorExtenso(d: DataISO, comAno = false): string {
  return `${capitalizar(DIAS[diaDaSemana(d)])}, ${Number(d.slice(8, 10))} de ${nomeMes(d.slice(0, 7))}${comAno ? ` de ${d.slice(0, 4)}` : ''}`
}

/** "11 a 17 de outubro", "28 de setembro a 4 de outubro" */
export function intervalo(de: DataISO, ate: DataISO): string {
  const dia = (d: DataISO) => Number(d.slice(8, 10))
  if (de.slice(0, 7) === ate.slice(0, 7)) return `${dia(de)} a ${dia(ate)} de ${nomeMes(de.slice(0, 7))}`
  return `${dia(de)} de ${nomeMes(de.slice(0, 7))} a ${dia(ate)} de ${nomeMes(ate.slice(0, 7))}`
}

export type Cor = 'azul' | 'verde' | 'laranja' | 'vermelho' | 'cinza'

export function corDoEvento(e: Evento): Cor {
  if (e.tipo === 'atendimento') {
    if (e.atrasada) return 'vermelho'
    const s = e.atendimento?.situacao
    return s === 'cancelado' || s === 'faltou' || s === 'concluido' ? 'cinza' : 'azul'
  }
  if (e.atrasada) return 'vermelho'
  return e.tipo === 'receber' ? 'verde' : 'laranja'
}

/** Classes da etiqueta do evento (fundo suave, barrinha colorida à esquerda). */
export const ETIQUETA: Record<Cor, string> = {
  azul: 'bg-[#eaf2ff] text-[#1d4fb8] border-l-primary hover:bg-[#dde9fd]',
  verde: 'bg-[#e8f7ef] text-[#147a47] border-l-success hover:bg-[#d9f2e5]',
  laranja: 'bg-[#fff2e6] text-[#b44d06] border-l-[#e8640c] hover:bg-[#ffe6d1]',
  vermelho: 'bg-[#fff0f2] text-[#b4232f] border-l-danger hover:bg-[#fde0e5]',
  cinza: 'bg-[#f1f4f8] text-[#5b6f8c] border-l-[#a9b6c8] hover:bg-[#e8edf3]',
}

export const PONTO: Record<Cor, string> = {
  azul: 'bg-primary',
  verde: 'bg-success',
  laranja: 'bg-[#e8640c]',
  vermelho: 'bg-danger',
  cinza: 'bg-[#a9b6c8]',
}

export function rotuloTipo(e: Evento): string {
  if (e.tipo === 'atendimento') return e.atrasada ? 'Atendimento · pagamento atrasado' : 'Atendimento'
  if (e.tipo === 'receber') return e.atrasada ? 'A receber · atrasado' : 'A receber'
  return e.atrasada ? 'A pagar · atrasada' : 'A pagar'
}

/** Link do WhatsApp com o número do cliente (Brasil) e uma mensagem pronta. */
export function linkWhatsapp(telefone: string | undefined, texto: string): string {
  const digitos = (telefone ?? '').replace(/\D/g, '')
  const numero = digitos.length >= 12 ? digitos : digitos.length >= 10 ? `55${digitos}` : /^9\d{8}$/.test(digitos) ? `351${digitos}` : ''
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}
