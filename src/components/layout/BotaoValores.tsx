import { Eye, EyeOff } from 'lucide-react'
import { trocarValoresOcultos, useValoresOcultos } from '../../lib/valores'

/** Olho no topo: esconde ou mostra os valores de todas as telas. */
export function BotaoValores() {
  const ocultos = useValoresOcultos()
  return (
    <button
      onClick={() => trocarValoresOcultos(!ocultos)}
      aria-label={ocultos ? 'Mostrar valores' : 'Esconder valores'}
      aria-pressed={ocultos}
      title={ocultos ? 'Mostrar valores' : 'Esconder valores'}
      className="relative inline-flex size-11 items-center justify-center overflow-hidden rounded-full text-navy transition-colors hover:bg-white hover:shadow-[var(--shadow-card)]"
    >
      <Eye size={20} strokeWidth={1.9} aria-hidden className={`absolute transition-all duration-300 ${ocultos ? 'scale-50 opacity-0' : 'scale-100 opacity-100'}`} />
      <EyeOff size={20} strokeWidth={1.9} aria-hidden className={`absolute transition-all duration-300 ${ocultos ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
    </button>
  )
}
