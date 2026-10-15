import { CircleCheck } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

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
  const fundo = { claro: 'bg-surface shadow-[0_1px_3px_rgba(16,32,64,0.12)]', azul: 'grad-primario', navy: 'grad-navy' }[estilo]
  const corAtiva = estilo === 'claro' ? 'text-ink' : 'text-white'
  // Uma pílula só desliza até a opção escolhida, em vez de cada botão acender sozinho.
  const caixa = useRef<HTMLDivElement>(null)
  const [pilula, setPilula] = useState<{ left: number; width: number } | null>(null)
  useLayoutEffect(() => {
    const medir = () => {
      const el = caixa.current?.querySelector<HTMLElement>('[aria-selected="true"]')
      if (el) setPilula({ left: el.offsetLeft, width: el.offsetWidth })
    }
    medir()
    const obs = new ResizeObserver(medir)
    if (caixa.current) obs.observe(caixa.current)
    return () => obs.disconnect()
  }, [valor, opcoes.length])
  return (
    <div ref={caixa} role="tablist" aria-label={rotulo} className={`relative inline-flex gap-1 rounded-[14px] bg-[#e9eef5] p-1 ${className}`}>
      {pilula && (
        <span
          aria-hidden
          className={`absolute top-1 bottom-1 rounded-[11px] transition-[left,width] duration-[420ms] ease-[cubic-bezier(0.34,1.25,0.64,1)] ${fundo}`}
          style={{ left: pilula.left, width: pilula.width }}
        />
      )}
      {opcoes.map((o) => {
        const ativo = o.valor === valor
        return (
          <button
            key={o.valor}
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(o.valor)}
            className={`relative z-10 inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[11px] font-semibold transition-colors duration-300 active:scale-[0.97] ${
              grande ? 'h-12 px-4 text-[14px] sm:px-7' : 'h-9 px-4 text-[13px]'
            } ${ativo ? `${corAtiva} ${pilula ? '' : fundo}` : 'text-[#3d5170] hover:text-ink'}`}
          >
            {o.icone}
            {o.rotulo}
            {o.contagem !== undefined && (
              <span className={`num rounded-full px-1.5 text-[11px] transition-colors duration-300 ${ativo ? (estilo === 'claro' ? 'bg-primary-soft text-primary' : 'bg-white/20 text-white') : 'bg-white/80 text-ink-2'}`}>{o.contagem}</span>
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
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-all duration-200 active:scale-95 ${
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
