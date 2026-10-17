import type { HTMLAttributes, ReactNode } from 'react'

export function Card({ className = '', interativo, children, ...rest }: HTMLAttributes<HTMLDivElement> & { interativo?: boolean }) {
  return (
    <div
      className={`card p-5 has-[[role=tooltip]]:relative has-[[role=tooltip]]:z-30 md:p-6 ${interativo ? 'group hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardTitulo({ children, acao, explica, className = '' }: { children: ReactNode; acao?: ReactNode; explica?: ReactNode; className?: string }) {
  return (
    <div className={`mb-4 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="flex items-center gap-1 text-[17px] font-bold tracking-[-0.01em] text-ink">
        {children}
        {explica}
      </h2>
      {acao}
    </div>
  )
}

export type TomIcone = 'neutro' | 'azul' | 'verde' | 'vermelho' | 'ambar' | 'laranja' | 'solido'

const TONS_ICONE: Record<TomIcone, string> = {
  neutro: 'bg-gradient-to-b from-[#f3f6fa] to-[#e8eef5] text-[#4a6385]',
  azul: 'bg-gradient-to-b from-[#eef4ff] to-[#dde9fd] text-primary',
  verde: 'bg-gradient-to-b from-[#ecf9f2] to-[#d9f2e5] text-success',
  vermelho: 'bg-gradient-to-b from-[#fff1f3] to-[#fde0e5] text-danger',
  ambar: 'bg-gradient-to-b from-[#fff6ec] to-[#ffe8d1] text-warning',
  laranja: 'bg-gradient-to-b from-[#fff4ea] to-[#ffe3cc] text-[#e8640c]',
  solido: 'grad-primario text-white',
}

/** Ícone em círculo com fundo em degradê suave, como na imagem de referência. */
export function IconeBox({
  children,
  tom = 'neutro',
  tamanho = 'md',
  className = '',
}: {
  children: ReactNode
  tom?: TomIcone
  tamanho?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const t = { sm: 'size-9', md: 'size-11', lg: 'size-14' }[tamanho]
  return (
    <span className={`inline-flex ${t} shrink-0 items-center justify-center rounded-full ring-1 ring-white/70 ${TONS_ICONE[tom]} ${className}`}>{children}</span>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`rounded-lg ${className}`}
      style={{
        background: 'linear-gradient(90deg,#eef2f6 0px,#f6f8fb 80px,#eef2f6 160px)',
        backgroundSize: '400px 100%',
        animation: 'brilho 1.2s linear infinite',
      }}
    />
  )
}

export function EstadoVazio({ icone, titulo, texto, acao }: { icone: ReactNode; titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-3 inline-flex size-14 items-center justify-center rounded-full bg-gradient-to-b from-[#eef4ff] to-[#dde9fd] text-primary">{icone}</span>
      <p className="font-semibold text-ink">{titulo}</p>
      <p className="mt-1 max-w-sm text-[13px] text-ink-2">{texto}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}
