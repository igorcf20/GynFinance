/**
 * A demonstração publicada roda dentro de uma moldura (iframe) que controla o endereço da página:
 * lá, mudar o "#/..." da URL não é confiável e pode deixar a tela em branco. Dentro de moldura, a
 * navegação fica só na memória e o servidor nem é procurado (a demonstração não tem um).
 */
export const dentroDeMoldura: boolean = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

/** Um link "#lancamentos" da demonstração abre direto nessa tela. */
export function rotaInicial(): string {
  const ancora = window.location.hash.replace(/^#\/?/, '')
  return /^[a-z-]+$/.test(ancora) ? `/${ancora}` : '/'
}
