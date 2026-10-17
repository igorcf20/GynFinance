import { HelpCircle } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Botão "?" ao lado de um número que abre uma explicação curta: o que é, de onde vem a conta
 * (com os valores do mês) e o que fazer com ela. Abre ao passar o mouse, ao tocar e pelo teclado.
 */
export function Explica({ titulo, children, conta, lado = 'esquerda' }: { titulo: string; children: ReactNode; conta?: ReactNode; lado?: 'esquerda' | 'direita' }) {
  const [aberto, setAberto] = useState(false)
  const [fixo, setFixo] = useState(false)
  const [desvio, setDesvio] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const balao = useRef<HTMLSpanElement>(null)
  const id = useId()
  const visivel = aberto || fixo

  // No celular o balão pode passar da borda da tela: empurra para dentro, com 12px de folga.
  useLayoutEffect(() => {
    if (!visivel || !balao.current) return setDesvio(0)
    const r = balao.current.getBoundingClientRect()
    const largura = document.documentElement.clientWidth
    const base = r.left - desvio
    const direita = base + balao.current.offsetWidth
    setDesvio(direita > largura - 12 ? largura - 12 - direita : base < 12 ? 12 - base : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel])

  useEffect(() => {
    if (!fixo) return
    const fora = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setFixo(false)
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setFixo(false)
    document.addEventListener('pointerdown', fora)
    window.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fora)
      window.removeEventListener('keydown', tecla)
    }
  }, [fixo])

  return (
    <span ref={ref} className="relative inline-flex align-middle" onMouseEnter={() => setAberto(true)} onMouseLeave={() => setAberto(false)}>
      <button
        type="button"
        aria-label={`O que é ${titulo.toLowerCase()}?`}
        aria-expanded={visivel}
        aria-describedby={visivel ? id : undefined}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setFixo((v) => !v)
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        className={`inline-flex size-6 items-center justify-center rounded-full transition-all duration-200 ${
          visivel ? 'bg-primary-soft text-primary' : 'text-[#7f94b3] hover:bg-primary-soft hover:text-primary'
        }`}
      >
        <HelpCircle size={16} strokeWidth={2.1} aria-hidden />
      </button>
      {visivel && (
        <span
          id={id}
          ref={balao}
          role="tooltip"
          style={{ marginLeft: desvio, marginRight: -desvio }}
          className={`anim-janela absolute top-full z-40 mt-2 block w-[min(300px,calc(100vw-48px))] rounded-[16px] border border-[#e3e9f1] bg-surface p-4 text-left font-normal shadow-[var(--shadow-pop)] ${
            lado === 'esquerda' ? '-left-3' : '-right-3'
          }`}
        >
          <span className="block text-[14px] font-bold tracking-[-0.01em] text-ink">{titulo}</span>
          <span className="mt-1 block text-[13px] leading-relaxed text-ink-2">{children}</span>
          {conta && <span className="num mt-3 block rounded-[10px] bg-gradient-to-r from-[#f1f6fe] to-[#f8fafd] px-3 py-2 text-[12.5px] leading-relaxed text-[#2f4a72] [&_b]:whitespace-nowrap">{conta}</span>}
        </span>
      )}
    </span>
  )
}
