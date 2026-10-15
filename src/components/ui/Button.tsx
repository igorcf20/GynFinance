import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

type Variante = 'primario' | 'secundario' | 'contorno' | 'discreto' | 'perigo'
type Tamanho = 'md' | 'sm' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold text-[14px] rounded-[12px] transition-all duration-150 disabled:opacity-60 select-none active:translate-y-px'
const variantes: Record<Variante, string> = {
  primario: 'grad-primario text-white hover:brightness-[1.06]',
  secundario: 'bg-surface text-ink border border-line shadow-[0_1px_2px_rgba(16,32,64,0.04)] hover:border-[#d3dce8] hover:bg-[#fbfcfe]',
  // Botão branco com borda azul ("Paguei", "Marcar como pago").
  contorno: 'bg-surface text-primary border-[1.5px] border-primary-line hover:border-primary hover:bg-primary-soft/60',
  discreto: 'bg-transparent text-ink-2 hover:bg-hover hover:text-ink',
  perigo: 'bg-danger text-white shadow-[0_10px_22px_-10px_rgba(224,50,74,0.7)] hover:brightness-95',
}
const tamanhos: Record<Tamanho, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-5',
  lg: 'h-[52px] px-6 text-[15px]',
}

export function classesBotao(v: Variante = 'primario', t: Tamanho = 'md', extra = '') {
  return `${base} ${variantes[v]} ${tamanhos[t]} ${extra}`
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamanho?: Tamanho
  icone?: ReactNode
  carregando?: boolean
}

export function Button({ variante = 'primario', tamanho = 'md', icone, carregando, className = '', children, disabled, ...rest }: Props) {
  return (
    <button className={classesBotao(variante, tamanho, className)} disabled={disabled || carregando} {...rest}>
      {carregando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icone}
      {children}
    </button>
  )
}

export function ButtonLink({
  to,
  variante = 'primario',
  tamanho = 'md',
  icone,
  className = '',
  children,
}: {
  to: string
  variante?: Variante
  tamanho?: Tamanho
  icone?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={classesBotao(variante, tamanho, className)}>
      {icone}
      {children}
    </Link>
  )
}
