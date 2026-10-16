// Conversa com o servidor do Gynfinance (server/). Na demonstração publicada não há servidor:
// verificarServidor() responde "sem" e o app segue guardando tudo no navegador.

export interface Conta {
  usuario: { nome: string; email: string }
  temNegocio: boolean
}

export class ErroApi extends Error {
  status: number
  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

export async function api<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(`api/${caminho}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  } catch {
    throw new ErroApi(0, 'Sem conexão com a internet. Confira e tente de novo.')
  }
  const json = (await r.json().catch(() => null)) as (T & { erro?: string }) | null
  if (!r.ok) throw new ErroApi(r.status, json?.erro ?? 'Algo deu errado. Tente de novo.')
  return json as T
}

export type Servidor = { tem: false } | { tem: true; conta: Conta | null }

/** Há servidor? Se houver, quem está logado? */
export async function verificarServidor(): Promise<Servidor> {
  try {
    const r = await fetch('api/conta', { credentials: 'same-origin' })
    const tipo = r.headers.get('content-type') ?? ''
    if (!tipo.includes('application/json')) return { tem: false }
    if (r.status === 401) return { tem: true, conta: null }
    if (r.ok) return { tem: true, conta: (await r.json()) as Conta }
    return { tem: false }
  } catch {
    return { tem: false }
  }
}
