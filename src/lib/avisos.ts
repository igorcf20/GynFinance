// Avisos no celular (notificações do navegador). O aparelho se inscreve no serviço de avisos do
// próprio navegador e manda o endereço para o servidor, que envia os lembretes do dia.
import { api } from '../data/api'

export type EstadoAvisos = 'sem-suporte' | 'precisa-instalar' | 'bloqueado' | 'desligado' | 'ligado'

const ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

// O service worker do app instalável (sw.js) já traz os avisos. Só onde ele não existe (sistema
// rodando em desenvolvimento) registra o dos avisos sozinho: dois no mesmo endereço se substituiriam.
async function registro(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register('avisos-sw.js')
}

/** No iPhone, os avisos só funcionam com o Gynfinance adicionado à tela de início. */
export async function estadoAvisos(): Promise<EstadoAvisos> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ehIphone() && !instalado() ? 'precisa-instalar' : 'sem-suporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  const r = await navigator.serviceWorker.getRegistration()
  const inscricao = await r?.pushManager.getSubscription()
  return inscricao && Notification.permission === 'granted' ? 'ligado' : 'desligado'
}

const paraBytes = (base64: string) => {
  const b = atob((base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

export async function ligarAvisos(): Promise<EstadoAvisos> {
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return permissao === 'denied' ? 'bloqueado' : 'desligado'
  const r = await registro()
  await navigator.serviceWorker.ready
  const { chave } = await api<{ chave: string }>('GET', 'avisos/chave')
  const inscricao = (await r.pushManager.getSubscription()) ?? (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(chave) }))
  await api('POST', 'avisos/inscrever', inscricao.toJSON())
  return 'ligado'
}

export async function desligarAvisos(): Promise<EstadoAvisos> {
  const r = await navigator.serviceWorker.getRegistration()
  const inscricao = await r?.pushManager.getSubscription()
  if (inscricao) {
    await api('POST', 'avisos/cancelar', { endpoint: inscricao.endpoint }).catch(() => {})
    await inscricao.unsubscribe()
  }
  return 'desligado'
}
