import { Moon, Sun } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { assinarTema, ehEscuro, lerTema, trocarTema } from '../../lib/tema'

export function useTema() {
  const tema = useSyncExternalStore(assinarTema, lerTema, () => 'claro' as const)
  return { tema, escuro: ehEscuro(tema), trocar: trocarTema }
}

/** Lua e sol no topo: troca entre claro e escuro com um giro suave. */
export function BotaoTema() {
  const { escuro, trocar } = useTema()
  return (
    <button
      onClick={() => trocar(escuro ? 'claro' : 'escuro')}
      aria-label={escuro ? 'Usar modo claro' : 'Usar modo escuro'}
      title={escuro ? 'Modo claro' : 'Modo escuro'}
      className="relative inline-flex size-11 items-center justify-center overflow-hidden rounded-full text-navy transition-colors hover:bg-white hover:shadow-[var(--shadow-card)]"
    >
      <Sun size={20} strokeWidth={1.9} aria-hidden className={`absolute transition-all duration-500 ${escuro ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-50 opacity-0'}`} />
      <Moon size={20} strokeWidth={1.9} aria-hidden className={`absolute transition-all duration-500 ${escuro ? '-rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
    </button>
  )
}
