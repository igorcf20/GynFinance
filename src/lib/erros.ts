// Erros do app: guarda os últimos (tela que quebrou, falha de script, servidor fora do ar) para
// irem junto num chamado de suporte, e avisa o servidor sozinho dos erros de tela e de script,
// para a equipe ver no painel mesmo que ninguém abra chamado.
import type { ContextoTicket, ErroCapturado, OrigemErro } from '../domain/suporte'
import { dentroDeMoldura } from './moldura'

const CHAVE = 'gynfinance:erros'
const MAXIMO = 10
const VERSAO = (import.meta.env.VITE_VERSAO as string | undefined) ?? 'web'

let pagina = '/'
let recentes: ErroCapturado[] = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE) ?? '[]') as ErroCapturado[]
  } catch {
    return []
  }
})()
const avisados = new Set<string>()
let fila: ErroCapturado[] = []
let relogio: number | undefined

/** Tela atual (rota), atualizada a cada navegação. */
export function definirPagina(rota: string) {
  pagina = rota
  if (rota !== '/suporte') ultimaPaginaAntesDoSuporte = rota
}
export const paginaAtual = () => pagina
/** Onde a pessoa estava antes de abrir a Ajuda: é a página que vai no chamado. */
export let ultimaPaginaAntesDoSuporte = '/'

export const errosRecentes = () => [...recentes]
export function limparErros() {
  recentes = []
  try {
    sessionStorage.removeItem(CHAVE)
  } catch {
    /* sem armazenamento */
  }
}

const primeiraLinha = (s: string) => s.split('\n')[0].slice(0, 500)

/**
 * Registra um erro. "tela", "script" e "promessa" também vão para o painel (uma vez por sessão
 * cada um); falhas de conexão e respostas do servidor ficam só na lista do chamado.
 */
export function registrarErro(origem: OrigemErro, erro: unknown, onde = pagina) {
  const e = erro instanceof Error ? erro : new Error(typeof erro === 'string' ? erro : JSON.stringify(erro) ?? 'Erro desconhecido')
  const item: ErroCapturado = {
    quando: new Date().toISOString(),
    origem,
    mensagem: primeiraLinha(e.message || String(e)) || 'Erro sem mensagem',
    pilha: e.stack?.split('\n').slice(0, 8).join('\n').slice(0, 2000),
    pagina: onde,
  }
  // O mesmo erro em sequência (um render que repete) conta uma vez.
  const ultimo = recentes[recentes.length - 1]
  if (!ultimo || ultimo.mensagem !== item.mensagem || ultimo.pagina !== item.pagina) {
    recentes = [...recentes, item].slice(-MAXIMO)
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(recentes))
    } catch {
      /* sem armazenamento */
    }
  }
  const chave = `${origem}|${item.mensagem}|${onde}`
  if ((origem === 'tela' || origem === 'script' || origem === 'promessa') && !avisados.has(chave)) {
    avisados.add(chave)
    fila.push(item)
    window.clearTimeout(relogio)
    relogio = window.setTimeout(enviarFila, 1500)
  }
  return item
}

function enviarFila() {
  const lote = fila.slice(0, 5)
  fila = fila.slice(5)
  if (!lote.length || dentroDeMoldura) return
  // Sem await: avisar o servidor nunca pode atrapalhar a pessoa (nem gerar outro erro).
  fetch('api/suporte/erros', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ erros: lote, contexto: contextoTecnico() }),
    keepalive: true,
  }).catch(() => {})
  if (fila.length) relogio = window.setTimeout(enviarFila, 1500)
}

/** Plataforma: o app das lojas (Capacitor) avisa se é Android ou iOS; senão, web. */
function plataforma(): string {
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor
  return cap?.getPlatform?.() ?? 'web'
}

function navegador(): string {
  const ua = navigator.userAgent
  const sistema = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Outro'
  const nome = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  const versao = ua.match(/(?:Edg|OPR|SamsungBrowser|Chrome|Firefox|Version)\/(\d+)/)?.[1]
  return `${nome}${versao ? ` ${versao}` : ''} no ${sistema}`
}

export function contextoTecnico(rota = pagina, nome = ''): ContextoTicket {
  return {
    pagina: rota,
    paginaNome: nome,
    navegador: navegador(),
    tela: `${window.innerWidth}x${window.innerHeight}`,
    plataforma: plataforma(),
    versao: VERSAO,
    online: navigator.onLine,
  }
}

/** Liga a captura dos erros que escapam das telas (uma vez, ao abrir o app). */
export function capturarErrosGlobais() {
  window.addEventListener('error', (ev) => {
    // Imagem ou script que não carregou chega aqui sem "error": ignora.
    if (!ev.error && !ev.message) return
    registrarErro('script', ev.error ?? ev.message)
  })
  window.addEventListener('unhandledrejection', (ev) => {
    // Resposta recusada pelo servidor (ErroApi tem status) já foi anotada em api(): não repete.
    if (typeof (ev.reason as { status?: unknown } | undefined)?.status === 'number') return
    registrarErro('promessa', ev.reason ?? 'Promessa recusada')
  })
}
