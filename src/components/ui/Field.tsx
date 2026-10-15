import { ChevronDown } from 'lucide-react'
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

const campo =
  'h-[42px] w-full rounded-[9px] border border-line bg-surface px-3 text-[14px] text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-150 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10'

export function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-medium text-ink-2">
      {children}
    </label>
  )
}

export function Input({ label, erro, icone, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; erro?: string; icone?: ReactNode }) {
  const id = useId()
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {icone && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate">{icone}</span>}
        <input id={id} aria-invalid={!!erro} aria-describedby={erro ? `${id}-erro` : undefined} className={`${campo} ${icone ? 'pl-9' : ''}`} {...rest} />
      </div>
      {erro && (
        <p id={`${id}-erro`} className="mt-1 text-[12px] text-danger">
          {erro}
        </p>
      )}
    </div>
  )
}

export function Select({
  label,
  opcoes,
  icone,
  className = '',
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; opcoes: { valor: string; rotulo: string }[]; icone?: ReactNode }) {
  const id = useId()
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        {icone && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate">{icone}</span>}
        <select id={id} className={`${campo} appearance-none pr-9 ${icone ? 'pl-9' : ''}`} {...rest}>
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate" aria-hidden />
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label, descricao }: { checked: boolean; onChange: (v: boolean) => void; label: string; descricao?: string }) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="font-medium text-ink">
          {label}
        </label>
        {descricao && <p className="text-[12px] text-ink-2">{descricao}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 ${checked ? 'bg-primary' : 'bg-[#d5dde7]'}`}
      >
        <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-150 ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}
