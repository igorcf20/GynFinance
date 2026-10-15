import type { ReactNode } from 'react'

export interface OpcaoAba<T extends string> {
  valor: T
  rotulo: string
  icone?: ReactNode
  contagem?: number
}

/** Controle segmentado (abas e escolhas exclusivas). */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
  grande,
  className = '',
}: {
  opcoes: OpcaoAba<T>[]
  valor: T
  onChange: (v: T) => void
  rotulo: string
  grande?: boolean
  className?: string
}) {
  return (
    <div role="tablist" aria-label={rotulo} className={`inline-flex rounded-[12px] border border-line bg-[#f1f4f8] p-1 ${className}`}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor
        return (
          <button
            key={o.valor}
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(o.valor)}
            className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[9px] font-semibold transition-all duration-150 ${
              grande ? 'h-11 px-3 text-[14px] sm:px-5' : 'h-8 px-4 text-[13px]'
            } ${ativo ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(30,55,90,0.1)]' : 'text-ink-2 hover:text-ink'}`}
          >
            {o.icone}
            {o.rotulo}
            {o.contagem !== undefined && (
              <span className={`num rounded-full px-1.5 text-[11px] ${ativo ? 'bg-primary-soft text-primary' : 'bg-white/70 text-ink-2'}`}>{o.contagem}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Fichas de escolha (categorias). */
export function Chips<T extends string>({ opcoes, valor, onChange, rotulo }: { opcoes: OpcaoAba<T>[]; valor: T; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
      {opcoes.map((o) => {
        const ativo = o.valor === valor
        return (
          <button
            key={o.valor}
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.valor)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150 ${
              ativo ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-ink-2 hover:border-[#d6dee8] hover:text-ink'
            }`}
          >
            {o.icone}
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}
