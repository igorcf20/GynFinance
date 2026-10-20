// Mensagem de cobrança pelo WhatsApp: o texto pronto (com a chave Pix) e o número do cliente,
// quando o sistema sabe qual é (ficha do cliente ou atendimento da agenda).
import { brl, dataBR } from '../lib/format'
import { linkWhatsApp } from './parceiros'
import type { Dados, Lancamento } from './types'

export const MENSAGEM_PADRAO =
  'Olá, {nome}! Aqui é da {negocio}. Passando para lembrar do pagamento de {valor}{descricao}, com vencimento em {vencimento}. Pode ser por Pix: {pix}. Obrigado!'

/** As marcas que o dono pode usar no texto próprio (Configurações > Empresa). */
export const MARCAS_COBRANCA = ['{nome}', '{valor}', '{vencimento}', '{descricao}', '{pix}', '{negocio}']

/** Telefone do cliente da conta: a ficha (Clientes) ou o atendimento que gerou a conta. */
export function telefoneDaConta(l: Lancamento, dados: Pick<Dados, 'parceiros' | 'atendimentos'>): string | undefined {
  const ficha = l.parceiroId ? dados.parceiros?.find((p) => p.id === l.parceiroId) : undefined
  const daFicha = ficha?.telefone || ficha?.contatos?.find((c) => c.telefone)?.telefone
  if (daFicha) return daFicha
  return dados.atendimentos.find((a) => a.lancamentoId === l.id && a.telefone)?.telefone
}

export function textoCobranca(l: Lancamento, empresa: Dados['empresa']): string {
  const pix = empresa.chavePix?.trim()
  let modelo = empresa.mensagemCobranca?.trim() || MENSAGEM_PADRAO
  // Sem chave Pix cadastrada, a frase do Pix sai do texto padrão em vez de ficar pela metade.
  if (!pix && !empresa.mensagemCobranca) modelo = modelo.replace(' Pode ser por Pix: {pix}.', ' Pode ser por Pix.')
  const nome = l.contraparte?.trim().split(' ')[0]
  const trocas: Record<string, string> = {
    '{nome}': nome || 'tudo bem',
    '{negocio}': empresa.nomeFantasia,
    '{valor}': brl(l.valor, { centavos: true, sempre: true }),
    '{vencimento}': l.dataVencimento ? dataBR(l.dataVencimento) : dataBR(l.dataCompetencia),
    '{descricao}': l.descricao ? ` (${l.descricao.toLowerCase()})` : '',
    '{pix}': pix || '(peça a chave Pix)',
  }
  return modelo.replace(/\{(nome|negocio|valor|vencimento|descricao|pix)\}/g, (m) => trocas[m])
}

/** Link que abre o WhatsApp já na conversa do cliente (ou na escolha do contato, sem telefone). */
export function linkCobranca(l: Lancamento, dados: Pick<Dados, 'empresa' | 'parceiros' | 'atendimentos'>): { url: string; comNumero: boolean } {
  const texto = textoCobranca(l, dados.empresa)
  const direto = linkWhatsApp(telefoneDaConta(l, dados), texto)
  return direto ? { url: direto, comNumero: true } : { url: `https://wa.me/?text=${encodeURIComponent(texto)}`, comNumero: false }
}
