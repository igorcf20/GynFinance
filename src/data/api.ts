// Conversa com o servidor do Gynfinance (server/). Na demonstração publicada não há servidor:
// verificarServidor() responde "sem" e o app segue guardando tudo no navegador.

import type { MinhaAssinatura } from '../domain/planos'
import { registrarErro } from '../lib/erros'
import { dentroDeMoldura } from '../lib/moldura'

export interface Conta {
  usuario: { nome: string; email: string }
  temNegocio: boolean
  /** Entra no painel de superadmin (e-mail em ADMIN_EMAILS no servidor). */
  admin?: boolean
  assinatura?: MinhaAssinatura
  /** Aviso geral e manutenção, definidos no painel de superadmin. */
  sistema?: { aviso: string; manutencao: boolean; iaLigada: boolean }
  /** Chamados de suporte com resposta que a pessoa ainda não leu. */
  suporte?: { naoLidos: number }
}

export class ErroApi extends Error {
  status: number
  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

export async function api<T>(metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', caminho: string, corpo?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(`api/${caminho}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  } catch {
    registrarErro('conexao', `${metodo} ${caminho}: sem conexão`)
    throw new ErroApi(0, 'Sem conexão com a internet. Confira e tente de novo.')
  }
  const json = (await r.json().catch(() => null)) as (T & { erro?: string }) | null
  if (!r.ok) {
    // Erro do servidor (5xx) vai para a lista que acompanha um chamado de suporte.
    if (r.status >= 500) registrarErro('servidor', `${metodo} ${caminho.split('?')[0]}: ${r.status} ${json?.erro ?? ''}`.trim())
    throw new ErroApi(r.status, json?.erro ?? 'Algo deu errado. Tente de novo.')
  }
  return json as T
}

export type Servidor = { tem: false } | { tem: 'fora' } | { tem: true; conta: Conta | null }

// Este aparelho já falou com o servidor: se depois não responder, é falta de internet (ou o
// servidor fora do ar), não a demonstração publicada. Sem isso, o app instalado abriria sem
// internet mostrando os dados de exemplo no lugar do negócio da pessoa.
const CHAVE_SERVIDOR = 'gynfinance:tem-servidor'
const jaTeveServidor = () => {
  try {
    return localStorage.getItem(CHAVE_SERVIDOR) === '1'
  } catch {
    return false
  }
}

/** Há servidor? Se houver, quem está logado? */
export async function verificarServidor(): Promise<Servidor> {
  if (dentroDeMoldura) return { tem: false }
  const semResposta: Servidor = jaTeveServidor() ? { tem: 'fora' } : { tem: false }
  try {
    const r = await fetch('api/conta', { credentials: 'same-origin' })
    const tipo = r.headers.get('content-type') ?? ''
    if (!tipo.includes('application/json')) return semResposta
    const s: Servidor | null = r.status === 401 ? { tem: true, conta: null } : r.ok ? { tem: true, conta: (await r.json()) as Conta } : null
    if (!s) return semResposta
    try {
      localStorage.setItem(CHAVE_SERVIDOR, '1')
    } catch {
      /* sem armazenamento: segue igual */
    }
    return s
  } catch {
    return semResposta
  }
}
