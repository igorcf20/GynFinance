import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export function Modal({ aberto, onFechar, titulo, children, rodape }: { aberto: boolean; onFechar: () => void; titulo: string; children: ReactNode; rodape?: ReactNode }) {
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
        className="anim-janela w-full max-w-md rounded-t-[22px] bg-surface p-6 shadow-[var(--shadow-pop)] md:rounded-[20px]"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-[16px] font-semibold">{titulo}</h2>
          <button onClick={onFechar} aria-label="Fechar" className="-m-1 rounded-lg p-1 text-slate hover:bg-hover hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="text-ink-2">{children}</div>
        {rodape && <div className="mt-6 flex justify-end gap-2">{rodape}</div>}
      </div>
    </div>
  )
}

// ---------- Toast ----------

interface Toast {
  id: number
  texto: string
}
const ToastCtx = createContext<(texto: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const mostrar = useCallback((texto: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, texto }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6">
        {toasts.map((t) => (
          <div key={t.id} className="anim-toast pointer-events-auto flex items-center gap-3 rounded-[16px] bg-ink/95 py-3 pr-5 pl-3 text-[14px] font-medium text-white shadow-[var(--shadow-pop)] ring-1 ring-white/10 backdrop-blur">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#1fa463]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path className="anim-check" d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
