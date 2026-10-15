import { useId } from 'react'

export function LogoMarca({ size = 28 }: { size?: number }) {
  // Id único: o logo aparece duas vezes (uma escondida) e o degradê de uma cópia escondida não pinta a outra.
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4F8FFB" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="#E6EFFE" />
      <rect x="7" y="15" width="5" height="10" rx="2.5" fill="#86AEF8" />
      <rect x="13.5" y="10.5" width="5" height="14.5" rx="2.5" fill="#558FF7" />
      <rect x="20" y="6" width="5" height="19" rx="2.5" fill={`url(#${id})`} />
    </svg>
  )
}

export function Logo({ compacto }: { compacto?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMarca size={32} />
      {!compacto && <span className="text-[17px] font-bold tracking-[-0.02em] text-ink">Gynfinance</span>}
    </span>
  )
}
