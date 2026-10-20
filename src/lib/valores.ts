// Botão do olho: esconde os valores em todas as telas. Fica guardado no aparelho.
import { useSyncExternalStore } from 'react'
import { definirValoresOcultos } from './format'

const CHAVE = 'gynfinance:ocultar-valores'

function lerSalvo(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1'
  } catch {
    return false
  }
}

let atual = typeof window === 'undefined' ? false : lerSalvo()
const ouvintes = new Set<() => void>()

function aplicar(v: boolean) {
  definirValoresOcultos(v)
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('valores-ocultos', v)
}
aplicar(atual)

export function trocarValoresOcultos(v: boolean) {
  atual = v
  try {
    localStorage.setItem(CHAVE, v ? '1' : '0')
  } catch {
    /* ignora */
  }
  aplicar(v)
  ouvintes.forEach((f) => f())
}

function assinar(f: () => void) {
  ouvintes.add(f)
  return () => ouvintes.delete(f)
}

export function useValoresOcultos(): boolean {
  return useSyncExternalStore(assinar, () => atual, () => false)
}
