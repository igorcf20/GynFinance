import type { ReactNode } from 'react'

export type TomBadge = 'verde' | 'vermelho' | 'ambar' | 'neutro' | 'azul'

const tons: Record<TomBadge, string> = {
  verde: 'bg-success-soft text-success ring-[#c6ebd7]',
  vermelho: 'bg-danger-soft text-danger ring-[#f9cdd5]',
  ambar: 'bg-warning-soft text-warning ring-[#fdd9b5]',
  neutro: 'bg-[#eef2f7] text-[#3d5170] ring-[#dfe6ef]',
  azul: 'bg-primary-soft text-primary ring-[#cfdffc]',
}

export function Badge({ tom = 'neutro', children, icone }: { tom?: TomBadge; children: ReactNode; icone?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold ring-1 ring-inset ${tons[tom]}`}>
      {icone}
      {children}
    </span>
  )
}
