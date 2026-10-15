import type { HTMLAttributes, ReactNode } from 'react'

export function Card({ className = '', interativo, children, ...rest }: HTMLAttributes<HTMLDivElement> & { interativo?: boolean }) {
  return (
    <div
      className={`card p-5 md:p-6 ${interativo ? 'hover:shadow-[var(--shadow-card-hover)] hover:border-[#dbe3ee]' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardTitulo({ children, acao, className = '' }: { children: ReactNode; acao?: ReactNode; className?: string }) {
  return (
    <div className={`mb-4 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="text-[16px] font-semibold text-ink">{children}</h2>
      {acao}
    </div>
  )
}

/** Ícone discreto dentro de um quadrado arredondado. */
export function IconeBox({ children, tom = 'neutro', className = '' }: { children: ReactNode; tom?: 'neutro' | 'azul' | 'verde' | 'vermelho' | 'ambar'; className?: string }) {
  const tons = {
    neutro: 'bg-[#f1f4f8] text-slate',
    azul: 'bg-primary-soft text-primary',
    verde: 'bg-success-soft text-success',
    vermelho: 'bg-danger-soft text-danger',
    ambar: 'bg-warning-soft text-warning',
  }
  return <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-[11px] ${tons[tom]} ${className}`}>{children}</span>
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
      <span className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">{icone}</span>
      <p className="font-semibold text-ink">{titulo}</p>
      <p className="mt-1 max-w-sm text-[13px] text-ink-2">{texto}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}
