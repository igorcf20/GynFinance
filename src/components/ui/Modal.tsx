import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export function Modal({
  aberto,
  onFechar,
  titulo,
  children,
  rodape,
  larga,
}: {
  aberto: boolean
  onFechar: () => void
  titulo: string
  children: ReactNode
  rodape?: ReactNode
  /** Janela mais larga (fichas com muitos campos). */
  larga?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Guarda o onFechar num ref para o foco não voltar ao primeiro botão a cada renderização.
  const fechar = useRef(onFechar)
  fechar.current = onFechar
  useEffect(() => {
    if (!aberto) return
    const anterior = document.activeElement as HTMLElement | null
    const caixa = ref.current
    ;(caixa?.querySelector<HTMLElement>('input, select') ?? caixa?.querySelector<HTMLElement>('button, [href]'))?.focus()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && fechar.current()
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener('keydown', tecla)
      anterior?.focus()
    }
  }, [aberto])
  if (!aberto) return null
  return (
    <div className="anim-aparecer fixed inset-0 z-50 flex items-end justify-center bg-[#13213d]/35 p-0 backdrop-blur-[6px] md:items-center md:p-6" onMouseDown={onFechar}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(e) => e.stopPropagation()}
        className={`anim-janela max-h-[92dvh] w-full ${larga ? 'max-w-2xl' : 'max-w-md'} overflow-y-auto overscroll-contain rounded-t-[22px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-pop)] md:rounded-[20px] md:p-6`}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-[16px] font-semibold">{titulo}</h2>
          <button onClick={onFechar} aria-label="Fechar" className="-m-1 rounded-lg p-1 text-slate hover:bg-hover hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="text-ink-2">{children}</div>
        {/* Rodapé fixo embaixo: em janela longa, os botões ficam sempre à mão. */}
        {rodape && <div className="sticky -bottom-[calc(1.25rem+env(safe-area-inset-bottom))] -mx-5 -mb-[calc(1.25rem+env(safe-area-inset-bottom))] mt-2 flex flex-wrap justify-end gap-2 bg-surface/95 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] backdrop-blur md:-bottom-6 md:-mx-6 md:-mb-6 md:px-6 md:pb-6">{rodape}</div>}
      </div>
    </div>
  )
}

// ---------- Toast ----------

export interface OpcoesToast {
  /** Mostra o botão Desfazer com contagem regressiva; ao tocar, chama esta função. */
  desfazer?: () => void
  /** Quanto tempo o aviso fica (e o Desfazer vale). Padrão: 8 s com desfazer, 3,2 s sem. */
  segundos?: number
}
interface Toast extends OpcoesToast {
  id: number
  texto: string
  segundos: number
}
type Mostrar = (texto: string, opcoes?: OpcoesToast) => void
const ToastCtx = createContext<Mostrar>(() => {})

function ItemToast({ t, fechar }: { t: Toast; fechar: (id: number) => void }) {
  const [resta, setResta] = useState(Math.ceil(t.segundos))
  const [desfeito, setDesfeito] = useState(false)
  useEffect(() => {
    const fim = Date.now() + t.segundos * 1000
    const relogio = window.setInterval(() => {
      const s = Math.ceil((fim - Date.now()) / 1000)
      if (s <= 0) fechar(t.id)
      else setResta(s)
    }, 250)
    return () => window.clearInterval(relogio)
  }, [t, fechar])
  return (
    <div className="anim-toast pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-[16px] bg-ink/95 py-3 pr-3 pl-3 text-[14px] font-medium text-white shadow-[var(--shadow-pop)] ring-1 ring-white/10 backdrop-blur">
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1fa463]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path className="anim-check" d={desfeito ? 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11' : 'M5 12.5l4.5 4.5L19 7.5'} />
        </svg>
      </span>
      <span className={t.desfazer ? '' : 'pr-2'}>{desfeito ? 'Desfeito.' : t.texto}</span>
      {t.desfazer && !desfeito && (
        <button
          type="button"
          onClick={() => {
            t.desfazer?.()
            setDesfeito(true)
            window.setTimeout(() => fechar(t.id), 1400)
          }}
          className="ml-1 inline-flex h-9 shrink-0 items-center gap-2 rounded-[11px] bg-white/12 px-3 text-[13px] font-semibold text-[#9cc2ff] transition-colors hover:bg-white/20"
        >
          Desfazer
          <span className="num inline-flex size-6 items-center justify-center rounded-full bg-white/15 text-[12px] text-white" aria-label={`${resta} segundos`}>
            {resta}
          </span>
        </button>
      )}
      {t.desfazer && !desfeito && (
        <span aria-hidden className="absolute bottom-0 left-0 h-[3px] w-full origin-left bg-[#9cc2ff]/70" style={{ animation: `encolher ${t.segundos}s linear forwards` }} />
      )}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const fechar = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const mostrar = useCallback<Mostrar>((texto, opcoes) => {
    const id = Date.now() + Math.random()
    const segundos = opcoes?.segundos ?? (opcoes?.desfazer ? 8 : 3.2)
    // Um aviso com Desfazer por vez: o anterior já vale como confirmado.
    setToasts((t) => [...(opcoes?.desfazer ? t.filter((x) => !x.desfazer) : t), { id, texto, segundos, ...opcoes }])
  }, [])
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6">
        {toasts.map((t) => (
          <ItemToast key={t.id} t={t} fechar={fechar} />
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
