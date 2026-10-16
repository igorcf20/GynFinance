// Tema claro ou escuro. Fica guardado no aparelho (cada pessoa escolhe o seu); "sistema" segue o
// celular ou computador. O index.html aplica antes de a página aparecer, para não piscar branco.
export type Tema = 'claro' | 'escuro' | 'sistema'

const CHAVE = 'gynfinance:tema'

export function temaSalvo(): Tema {
  try {
    const t = localStorage.getItem(CHAVE)
    if (t === 'claro' || t === 'escuro' || t === 'sistema') return t
  } catch {
    /* sem armazenamento: claro */
  }
  return 'claro'
}

export function ehEscuro(t: Tema): boolean {
  return t === 'escuro' || (t === 'sistema' && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches)
}

export function aplicarTema(t: Tema, animar = false) {
  const html = document.documentElement
  if (animar) {
    html.classList.add('trocando-tema')
    window.setTimeout(() => html.classList.remove('trocando-tema'), 400)
  }
  const escuro = ehEscuro(t)
  html.classList.toggle('escuro', escuro)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#0B1220' : '#F5F7FA')
}

export function salvarTema(t: Tema) {
  try {
    localStorage.setItem(CHAVE, t)
  } catch {
    /* ignora */
  }
  aplicarTema(t, true)
}

// Botão do topo e Configurações mostram o mesmo tema: quem troca avisa os outros.
const ouvintes = new Set<() => void>()
let atual: Tema = typeof window === 'undefined' ? 'claro' : temaSalvo()

export function trocarTema(t: Tema) {
  atual = t
  salvarTema(t)
  ouvintes.forEach((f) => f())
}

export function assinarTema(f: () => void) {
  ouvintes.add(f)
  // "Igual ao aparelho": acompanha quando o celular muda sozinho de claro para escuro.
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
  const sistema = () => {
    if (atual === 'sistema') {
      aplicarTema('sistema', true)
      f()
    }
  }
  mq?.addEventListener?.('change', sistema)
  return () => {
    ouvintes.delete(f)
    mq?.removeEventListener?.('change', sistema)
  }
}

export const lerTema = () => atual
