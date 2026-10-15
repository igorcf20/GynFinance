import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

type Variante = 'primario' | 'secundario' | 'discreto' | 'perigo'
type Tamanho = 'md' | 'sm' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold text-[13px] rounded-[10px] transition-colors duration-150 disabled:opacity-60 select-none'
const variantes: Record<Variante, string> = {
  primario: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-hover shadow-[0_1px_2px_rgba(52,120,246,0.25)]',
  secundario: 'bg-surface text-ink-2 border border-line hover:border-[#d6dee8] hover:text-ink hover:bg-[#fbfcfe]',
  discreto: 'bg-transparent text-ink-2 hover:bg-hover hover:text-ink',
  perigo: 'bg-danger text-white hover:brightness-95',
}
const tamanhos: Record<Tamanho, string> = {
  sm: 'h-8 px-3',
  md: 'h-10 px-4',
  lg: 'h-12 px-5 text-[14px]',
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
