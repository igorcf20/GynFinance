import { CircleCheck } from 'lucide-react'
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
  estilo = 'claro',
  className = '',
}: {
  opcoes: OpcaoAba<T>[]
  valor: T
  onChange: (v: T) => void
  rotulo: string
  grande?: boolean
  /** claro: selecionado branco; azul e navy: selecionado preenchido, como na imagem. */
  estilo?: 'claro' | 'azul' | 'navy'
  className?: string
}) {
  const selecionado = { claro: 'bg-surface text-ink shadow-[0_1px_3px_rgba(16,32,64,0.12)]', azul: 'grad-primario text-white', navy: 'grad-navy text-white' }[estilo]
  return (
    <div role="tablist" aria-label={rotulo} className={`inline-flex gap-1 rounded-[14px] bg-[#e9eef5] p-1 ${className}`}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor
        return (
          <button
            key={o.valor}
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(o.valor)}
            className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[11px] font-semibold transition-all duration-200 ${
              grande ? 'h-12 px-4 text-[14px] sm:px-7' : 'h-9 px-4 text-[13px]'
            } ${ativo ? selecionado : 'text-[#3d5170] hover:bg-white/60 hover:text-ink'}`}
          >
            {o.icone}
            {o.rotulo}
            {o.contagem !== undefined && (
              <span className={`num rounded-full px-1.5 text-[11px] ${ativo ? (estilo === 'claro' ? 'bg-primary-soft text-primary' : 'bg-white/20 text-white') : 'bg-white/80 text-ink-2'}`}>{o.contagem}</span>
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
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-all duration-150 ${
              ativo ? 'grad-primario text-white' : 'border border-line bg-surface text-ink shadow-[0_1px_2px_rgba(16,32,64,0.04)] hover:border-primary-line hover:text-primary'
            }`}
          >
            {ativo ? <CircleCheck size={16} fill="white" className="text-primary" aria-hidden /> : o.icone}
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}
