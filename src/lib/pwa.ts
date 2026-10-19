// App instalável: o pedido de instalação do navegador e em que aparelho o sistema está rodando.
import { useSyncExternalStore } from 'react'

interface PedidoInstalacao extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let pedido: PedidoInstalacao | null = null
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

// O Chrome manda o pedido logo ao abrir, antes do React montar: guarda para usar no botão Instalar.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    pedido = e as PedidoInstalacao
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    pedido = null
    avisar()
  })
}

/** Dentro do app das lojas (Android ou iPhone), montado com o Capacitor. */
export const noAppDaLoja = (): boolean =>
  typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

/** Já aberto como app (instalado na tela inicial ou app da loja). */
export const abertoComoApp = (): boolean =>
  noAppDaLoja() ||
  (typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true))

/** iPhone ou iPad no Safari: lá não há botão de instalar, só "Adicionar à Tela de Início". */
export const ehIOS = (): boolean =>
  typeof navigator !== 'undefined' && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export type FormaInstalar = 'botao' | 'ios' | null

/** Como oferecer a instalação aqui: botão do navegador, instruções do iPhone ou nada (já é app). */
export function useInstalar(): { forma: FormaInstalar; instalar: () => Promise<boolean> } {
  const temPedido = useSyncExternalStore(
    (f) => {
      ouvintes.add(f)
      return () => ouvintes.delete(f)
    },
    () => pedido !== null,
    () => false,
  )
  const forma: FormaInstalar = abertoComoApp() ? null : temPedido ? 'botao' : ehIOS() ? 'ios' : null
  const instalar = async () => {
    if (!pedido) return false
    await pedido.prompt()
    const { outcome } = await pedido.userChoice
    pedido = null
    avisar()
    return outcome === 'accepted'
  }
  return { forma, instalar }
}
