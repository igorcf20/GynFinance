// Comprovantes de pagamento: foto (comprimida no próprio celular) ou PDF.
import type { Comprovante } from '../domain/types'
import { uid } from '../lib/format'

export const ACEITOS = 'image/jpeg,image/png,image/webp,application/pdf'
/** Limite depois de comprimir (o servidor confere o mesmo). */
export const TAMANHO_MAXIMO = 5 * 1024 * 1024

function lerComoDataUrl(b: Blob): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader()
    r.onload = () => ok(r.result as string)
    r.onerror = () => erro(new Error('Não foi possível ler o arquivo.'))
    r.readAsDataURL(b)
  })
}

/** Foto de celular tem vários MB: reduz para no máximo 1600 px e JPEG, que fica legível e leve. */
export async function comprimirFoto(arquivo: File): Promise<{ dados: string; tipo: string; tamanho: number }> {
  const img = await createImageBitmap(arquivo).catch(() => {
    throw new Error('Esta imagem não abriu. Envie uma foto JPG ou PNG, ou um PDF.')
  })
  const escala = Math.min(1, 1600 / Math.max(img.width, img.height))
  const tela = document.createElement('canvas')
  tela.width = Math.round(img.width * escala)
  tela.height = Math.round(img.height * escala)
  const ctx = tela.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, tela.width, tela.height)
  ctx.drawImage(img, 0, 0, tela.width, tela.height)
  img.close()
  const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', 0.82))
  if (!blob) throw new Error('Não foi possível preparar a foto.')
  return { dados: await lerComoDataUrl(blob), tipo: 'image/jpeg', tamanho: blob.size }
}

export async function lerComprovante(arquivo: File): Promise<Comprovante> {
  const ehPdf = arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name)
  const ehFoto = arquivo.type.startsWith('image/')
  if (!ehPdf && !ehFoto) throw new Error('Envie uma foto (JPG, PNG) ou um PDF.')
  const pronto = ehPdf ? { dados: await lerComoDataUrl(arquivo), tipo: 'application/pdf', tamanho: arquivo.size } : await comprimirFoto(arquivo)
  if (pronto.tamanho > TAMANHO_MAXIMO) throw new Error('O arquivo passa de 5 MB. Envie um PDF menor ou uma foto.')
  const nome = ehPdf ? arquivo.name : arquivo.name.replace(/\.[^.]+$/, '') + '.jpg'
  return { id: uid(), nome: nome.slice(0, 200), ...pronto }
}

/** Endereço para abrir o comprovante: o próprio conteúdo ou o servidor. */
export function enderecoDoComprovante(c: Comprovante): string {
  return c.dados ?? `api/comprovantes/${c.id}`
}

export function tamanhoLegivel(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
