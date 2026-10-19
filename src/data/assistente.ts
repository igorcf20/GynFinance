// Conversa do app com o assistente. Com servidor, o pedido vai para /api/assistente (leitura por
// inteligência artificial); na demonstração, uma leitura simples de frases, feita aqui mesmo.
import { interpretarDemo, type ContextoAssistente, type RespostaAssistente } from '../domain/assistente'
import type { Dados, DataISO } from '../domain/types'
import { api } from './api'
import { comprimirFoto } from './comprovante'

/** Foto ou PDF anexado à mensagem. O File fica para virar comprovante depois. */
export interface Anexo {
  id: string
  arquivo: File
  tipo: 'image/jpeg' | 'application/pdf'
  /** Conteúdo em base64 (sem o "data:...;base64,"). */
  dados: string
  /** Endereço para a miniatura na tela. */
  previa: string
  tamanho: number
}

export const LIMITE_ANEXOS = 3
const MAX_PDF = 4 * 1024 * 1024

function lerBase64(b: Blob): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader()
    r.onload = () => ok((r.result as string).split(',')[1] ?? '')
    r.onerror = () => erro(new Error('Não foi possível ler o arquivo.'))
    r.readAsDataURL(b)
  })
}

/** Foto do celular fica com no máximo 1600 px (legível e leve); PDF vai como está. */
export async function prepararAnexo(arquivo: File): Promise<Anexo> {
  const ehPdf = arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name)
  if (ehPdf) {
    if (arquivo.size > MAX_PDF) throw new Error('Esse PDF passa de 4 MB. Mande uma foto da página, que fica mais leve.')
    return { id: crypto.randomUUID(), arquivo, tipo: 'application/pdf', dados: await lerBase64(arquivo), previa: '', tamanho: arquivo.size }
  }
  if (!arquivo.type.startsWith('image/')) throw new Error('Mande uma foto (JPG ou PNG) ou um PDF.')
  const foto = await comprimirFoto(arquivo)
  return { id: crypto.randomUUID(), arquivo, tipo: 'image/jpeg', dados: foto.dados.split(',')[1] ?? '', previa: foto.dados, tamanho: foto.tamanho }
}

export interface MensagemHistorico {
  de: 'cliente' | 'assistente'
  texto: string
}

export async function perguntarAoAssistente(
  modo: 'servidor' | 'demo',
  p: { texto: string; anexos: Anexo[]; historico: MensagemHistorico[]; contexto: ContextoAssistente; dados: Dados; hoje: DataISO },
): Promise<RespostaAssistente> {
  if (modo === 'demo') {
    // Um instante de espera, para a demonstração parecer com o de verdade.
    await new Promise((ok) => setTimeout(ok, 700))
    return interpretarDemo(p.texto, p.dados, p.hoje, p.anexos.length)
  }
  return api<RespostaAssistente>('POST', 'assistente', {
    texto: p.texto,
    anexos: p.anexos.map((a) => ({ tipo: a.tipo, dados: a.dados })),
    historico: p.historico.slice(-10).map((h) => ({ de: h.de, texto: h.texto.slice(0, 1500) })),
    contexto: p.contexto,
  })
}
