import type { ReactNode } from 'react'

export type TomBadge = 'verde' | 'vermelho' | 'ambar' | 'neutro' | 'azul'

const tons: Record<TomBadge, string> = {
  verde: 'bg-success-soft text-success',
  vermelho: 'bg-danger-soft text-danger',
  ambar: 'bg-warning-soft text-warning',
  neutro: 'bg-[#eef2f6] text-ink-2',
  azul: 'bg-primary-soft text-primary',
}

export function Badge({ tom = 'neutro', children, icone }: { tom?: TomBadge; children: ReactNode; icone?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ${tons[tom]}`}>
      {icone}
      {children}
    </span>
  )
}
