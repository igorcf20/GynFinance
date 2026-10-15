export function LogoMarca({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#EAF2FF" />
      <rect x="8" y="16" width="4" height="9" rx="2" fill="#9DBEF9" />
      <rect x="14" y="11" width="4" height="14" rx="2" fill="#6A9CF8" />
      <rect x="20" y="6" width="4" height="19" rx="2" fill="#3478F6" />
    </svg>
  )
}

export function Logo({ compacto }: { compacto?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMarca />
      {!compacto && <span className="text-[16px] font-bold tracking-[-0.01em] text-ink">Gynfinance</span>}
    </span>
  )
}
