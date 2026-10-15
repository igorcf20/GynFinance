import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'

export function Modal({ aberto, onFechar, titulo, children, rodape }: { aberto: boolean; onFechar: () => void; titulo: string; children: ReactNode; rodape?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const anterior = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button, [href], input, select')?.focus()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener('keydown', tecla)
      anterior?.focus()
    }
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div className="anim-aparecer fixed inset-0 z-50 flex items-end justify-center bg-[#172b4d]/30 p-0 backdrop-blur-[2px] md:items-center md:p-6" onMouseDown={onFechar}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(e) => e.stopPropagation()}
        className="anim-subir w-full max-w-md rounded-t-[20px] bg-surface p-6 shadow-[var(--shadow-pop)] md:rounded-[16px]"
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
          <div key={t.id} className="anim-subir pointer-events-auto flex items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-[13px] font-medium text-white shadow-[var(--shadow-pop)]">
            <CheckCircle2 size={18} className="text-[#7ee0ad]" aria-hidden />
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
