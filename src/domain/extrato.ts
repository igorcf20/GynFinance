// Importação de extrato bancário (OFX ou CSV). Lê as transações, separa as que já existem no
// sistema, liga cada uma a uma conta a pagar ou a receber em aberto quando o valor bate, e
// sugere a categoria pelo histórico da própria empresa.
import Papa from 'papaparse'
import { diasEntre } from '../lib/format'
import type { Categoria, Centavos, Dados, DataISO, FormaPagamento, Lancamento } from './types'

export interface MovimentoExtrato {
  /** Código da transação no banco (FITID) ou um código montado com data, valor e descrição. */
  ref: string
  data: DataISO
  /** Positivo entrou, negativo saiu. */
  valor: Centavos
  descricao: string
}

export class ErroExtrato extends Error {}

// ---------- Leitura ----------

/** Texto do arquivo: UTF-8 quando é válido; senão o Latin-1 que os bancos ainda usam no OFX. */
export function decodificar(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** "-1.234,56", "1234.56", "R$ 50,00", "(12,30)" em centavos com sinal. */
export function valorComSinal(texto: string): Centavos | null {
  let t = texto.trim().replace(/\s|R\$/g, '')
  let negativo = false
  if (/^\(.*\)$/.test(t)) {
    negativo = true
    t = t.slice(1, -1)
  }
  if (t.endsWith('-')) {
    negativo = true
    t = t.slice(0, -1)
  }
  if (t.startsWith('-')) {
    negativo = !negativo
    t = t.slice(1)
  } else if (t.startsWith('+')) t = t.slice(1)
  if (!/^[\d.,]+$/.test(t)) return null
  // A última vírgula ou ponto com 1 ou 2 casas depois é o separador decimal.
  const m = t.match(/^(.*?)[.,](\d{1,2})$/)
  const inteiro = (m ? m[1] : t).replace(/[.,]/g, '')
  const centavos = m ? m[2].padEnd(2, '0') : '00'
  const n = Number(inteiro || '0') * 100 + Number(centavos)
  if (!Number.isFinite(n)) return null
  return negativo ? -n : n
}

/** 31/12/2026, 31/12/26, 2026-12-31 ou 20261231. */
export function lerData(texto: string): DataISO | null {
  const t = texto.trim()
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  m = t.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

/** Código para quem não manda FITID: o mesmo movimento gera sempre o mesmo código. */
function refDe(data: DataISO, valor: Centavos, descricao: string, ocorrencia: number): string {
  const base = `${data}|${valor}|${descricao.toLowerCase().replace(/\s+/g, ' ').trim()}|${ocorrencia}`
  let h = 5381
  for (let i = 0; i < base.length; i++) h = ((h << 5) + h + base.charCodeAt(i)) >>> 0
  return `gyn-${data}-${h.toString(36)}`
}

function comRefs(movs: Omit<MovimentoExtrato, 'ref'>[], refs: (string | undefined)[]): MovimentoExtrato[] {
  const vistos = new Map<string, number>()
  return movs.map((m, i) => {
    const chave = `${m.data}|${m.valor}|${m.descricao}`
    const n = (vistos.get(chave) ?? 0) + 1
    vistos.set(chave, n)
    return { ...m, ref: refs[i] || refDe(m.data, m.valor, m.descricao, n) }
  })
}

/** OFX (o formato que quase todo banco oferece em "exportar extrato"). Aceita SGML e XML. */
export function lerOfx(texto: string): MovimentoExtrato[] {
  const blocos = texto.split(/<STMTTRN>/i).slice(1)
  if (!blocos.length) throw new ErroExtrato('Não encontramos transações neste arquivo OFX.')
  const campo = (bloco: string, tag: string) => bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim()
  const movs: Omit<MovimentoExtrato, 'ref'>[] = []
  const refs: (string | undefined)[] = []
  for (const b of blocos) {
    const corpo = b.split(/<\/STMTTRN>/i)[0]
    const data = lerData(campo(corpo, 'DTPOSTED') ?? '')
    const valor = valorComSinal(campo(corpo, 'TRNAMT') ?? '')
    if (!data || valor === null || valor === 0) continue
    const memo = campo(corpo, 'MEMO')
    const nome = campo(corpo, 'NAME')
    const descricao = [nome, memo].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ') || 'Movimento do extrato'
    movs.push({ data, valor, descricao: limparTexto(descricao) })
    const fitid = campo(corpo, 'FITID')
    refs.push(fitid ? `ofx-${fitid}` : undefined)
  }
  return comRefs(movs, refs)
}

function limparTexto(t: string): string {
  return t
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

const normal = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

/**
 * CSV de banco. Acha sozinho a linha de títulos e as colunas de data, descrição e valor
 * (ou crédito e débito separados), com ; ou , e números no jeito brasileiro ou americano.
 */
export function lerCsv(texto: string): MovimentoExtrato[] {
  const { data: linhas } = Papa.parse<string[]>(texto.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
  const acha = (titulos: string[], ...nomes: RegExp[]) => titulos.findIndex((t) => nomes.some((n) => n.test(t)))
  for (let i = 0; i < Math.min(linhas.length, 20); i++) {
    const titulos = linhas[i].map(normal)
    const cData = acha(titulos, /^data/, /^date$/, /^dt\b/)
    const cValor = acha(titulos, /^valor/, /^amount$/, /^quantia/, /^montante/)
    const cCredito = acha(titulos, /^credito/, /^entrada/)
    const cDebito = acha(titulos, /^debito/, /^saida/)
    const cDesc = acha(titulos, /descri/, /historico/, /^title$/, /^memo$/, /^lancamento$/, /^detalhe/)
    const cId = acha(titulos, /^identificador/, /^id$/, /^codigo/, /^fitid$/)
    if (cData < 0 || (cValor < 0 && (cCredito < 0 || cDebito < 0))) continue
    const movs: Omit<MovimentoExtrato, 'ref'>[] = []
    const refs: (string | undefined)[] = []
    for (const l of linhas.slice(i + 1)) {
      const data = lerData(l[cData] ?? '')
      if (!data) continue
      let valor: number | null
      if (cValor >= 0) valor = valorComSinal(l[cValor] ?? '')
      else {
        const c = valorComSinal(l[cCredito] ?? '') ?? 0
        const d = valorComSinal(l[cDebito] ?? '') ?? 0
        valor = Math.abs(c) - Math.abs(d)
      }
      if (valor === null || valor === 0) continue
      const descricao = cDesc >= 0 ? limparTexto(l[cDesc] ?? '') : ''
      // "Saldo do dia" e parecidos não são movimentos.
      if (/^saldo\b/i.test(descricao)) continue
      movs.push({ data, valor, descricao: descricao || 'Movimento do extrato' })
      refs.push(cId >= 0 && l[cId]?.trim() ? `csv-${l[cId].trim()}` : undefined)
    }
    if (!movs.length) throw new ErroExtrato('O arquivo tem as colunas certas, mas nenhuma transação com data e valor.')
    return comRefs(movs, refs)
  }
  throw new ErroExtrato('Não achamos as colunas de data e valor. Exporte o extrato em OFX ou num CSV com data, descrição e valor.')
}

export function lerExtrato(nomeArquivo: string, texto: string): MovimentoExtrato[] {
  const ehOfx = /\.(ofx|qfx)$/i.test(nomeArquivo) || /<OFX>|OFXHEADER/i.test(texto.slice(0, 2000))
  const movs = ehOfx ? lerOfx(texto) : lerCsv(texto)
  return movs.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
}

// ---------- Preparação ----------

export type AcaoLinha = 'novo' | 'baixar' | 'repetido'

export interface LinhaImportacao {
  mov: MovimentoExtrato
  natureza: 'entrada' | 'saida'
  acao: AcaoLinha
  incluir: boolean
  categoriaId?: string
  /** Quando acao = baixar: a conta em aberto que este movimento paga ou recebe. */
  contaPrevista?: Lancamento
  /** Quando acao = repetido: o lançamento que já existe. */
  existente?: Lancamento
}

/** Forma de pagamento pelo texto do banco. */
export function formaDoTexto(descricao: string): FormaPagamento {
  const t = normal(descricao)
  if (/\bpix\b/.test(t)) return 'pix'
  if (/boleto|pagto titulo|pagamento de titulo|cobranca/.test(t)) return 'boleto'
  if (/saque|deposito em dinheiro/.test(t)) return 'dinheiro'
  if (/credito|cartao de credito/.test(t) && !/\bted\b|\bdoc\b|transf/.test(t)) return 'credito'
  if (/debito|compra|elo |visa|mastercard|maestro/.test(t)) return 'debito'
  return 'outro'
}

/** Palavras do extrato que já dizem a categoria (quando o histórico da empresa ainda não sabe). */
const PISTAS: { categoria: string; regra: RegExp }[] = [
  { categoria: 'maquininha', regra: /stone|cielo|getnet|pagseguro|sumup|rede card|maquininha|antecipacao/i },
  { categoria: 'tarifas', regra: /tarifa|cesta de servicos|pacote de servicos|mensalidade conta|manutencao de conta|\biof\b|juros/i },
  { categoria: 'das', regra: /\bdas\b|simples nacional|receita federal|darf/i },
  { categoria: 'luz', regra: /energia|equatorial|enel|cemig|light |copel|celesc|saneago|sabesp|agua/i },
  { categoria: 'internet', regra: /internet|telefon|vivo|claro|\btim\b|\boi\b|net /i },
  { categoria: 'transporte', regra: /posto|combust|uber|99 ?app|99pop|estacionamento/i },
  { categoria: 'marketing', regra: /facebook|meta ads|instagram|google ads|anuncio/i },
  { categoria: 'aluguel', regra: /aluguel|imobiliaria/i },
  { categoria: 'contador', regra: /contabil|contador/i },
]

/** Categoria da última vez que esse texto apareceu; senão, pelas pistas; senão, a padrão. */
export function categoriaSugerida(dados: Pick<Dados, 'lancamentos' | 'categorias' | 'empresa'>, natureza: 'entrada' | 'saida', descricao: string): string {
  const ativas = new Set(dados.categorias.filter((c) => c.ativa).map((c) => c.id))
  const alvo = normal(descricao)
  let melhor: Lancamento | undefined
  for (const l of dados.lancamentos) {
    if (l.natureza !== natureza || !l.categoriaId || l.espelhoDe) continue
    if (normal(l.descricao ?? '') !== alvo && normal(l.contraparte ?? '') !== alvo) continue
    if (!melhor || l.dataCompetencia > melhor.dataCompetencia) melhor = l
  }
  if (melhor?.categoriaId && ativas.has(melhor.categoriaId)) return melhor.categoriaId
  if (natureza === 'saida') return PISTAS.find((p) => p.regra.test(normal(descricao)) && ativas.has(p.categoria))?.categoria ?? 'outras-saidas'
  // Entrada: venda ou serviço conforme o negócio. A pessoa troca se for outra coisa.
  return dados.empresa.atividade === 'servico' && ativas.has('servicos') ? 'servicos' : ativas.has('vendas') ? 'vendas' : 'outras-entradas'
}

const dataDo = (l: Lancamento) => l.dataPagamento ?? l.dataCompetencia

/**
 * Para cada movimento: já existe (mesmo código, ou mesma conta, dia, valor e tipo), paga uma
 * conta em aberto (mesmo valor, vencimento até 7 dias de distância) ou é novo.
 */
export function prepararImportacao(dados: Pick<Dados, 'lancamentos' | 'categorias' | 'empresa'>, contaId: string, movs: MovimentoExtrato[]): LinhaImportacao[] {
  const porRef = new Map(dados.lancamentos.filter((l) => l.refExtrato).map((l) => [l.refExtrato!, l]))
  const usados = new Set<string>()
  const previstasUsadas = new Set<string>()
  return movs.map((mov) => {
    const natureza = mov.valor > 0 ? 'entrada' : 'saida'
    const valor = Math.abs(mov.valor)
    const mesmoRef = porRef.get(mov.ref)
    const igual =
      mesmoRef ??
      dados.lancamentos.find(
        (l) =>
          !usados.has(l.id) &&
          l.situacao === 'realizado' &&
          !l.refExtrato &&
          l.contaFinanceiraId === contaId &&
          l.valor === valor &&
          dataDo(l) === mov.data &&
          (l.natureza === natureza || (natureza === 'saida' && (l.natureza === 'retirada' || l.natureza === 'transferencia')) || (natureza === 'entrada' && l.natureza === 'aporte')),
      )
    if (igual) {
      usados.add(igual.id)
      return { mov, natureza, acao: 'repetido', incluir: false, existente: igual, categoriaId: igual.categoriaId }
    }
    const prevista = dados.lancamentos
      .filter((l) => l.situacao === 'previsto' && l.natureza === natureza && l.valor === valor && l.dataVencimento && !previstasUsadas.has(l.id))
      .map((l) => ({ l, dist: Math.abs(diasEntre(l.dataVencimento!, mov.data)) }))
      .filter((x) => x.dist <= 7)
      .sort((a, b) => a.dist - b.dist)[0]?.l
    if (prevista) {
      previstasUsadas.add(prevista.id)
      return { mov, natureza, acao: 'baixar', incluir: true, contaPrevista: prevista, categoriaId: prevista.categoriaId }
    }
    return { mov, natureza, acao: 'novo', incluir: true, categoriaId: categoriaSugerida(dados, natureza, mov.descricao) }
  })
}

/** Grava as linhas marcadas: lançamentos novos já realizados e baixa das contas encontradas. */
export function aplicarImportacao(d: Dados, contaId: string, linhas: LinhaImportacao[], novoId: () => string): Dados {
  const baixas = new Map<string, LinhaImportacao>()
  const novos: Lancamento[] = []
  for (const ln of linhas) {
    if (!ln.incluir || ln.acao === 'repetido') continue
    if (ln.acao === 'baixar' && ln.contaPrevista) {
      baixas.set(ln.contaPrevista.id, ln)
      continue
    }
    // Pró-labore escolhido numa saída é retirada do dono, não despesa do negócio.
    const retirada = ln.natureza === 'saida' && d.categorias.find((c) => c.id === ln.categoriaId)?.grupo === 'retirada'
    novos.push({
      id: novoId(),
      empresaId: d.empresa.id,
      natureza: retirada ? 'retirada' : ln.natureza,
      valor: Math.abs(ln.mov.valor),
      categoriaId: ln.categoriaId,
      contaFinanceiraId: contaId,
      situacao: 'realizado',
      dataCompetencia: ln.mov.data,
      dataPagamento: ln.mov.data,
      formaPagamento: formaDoTexto(ln.mov.descricao),
      descricao: ln.mov.descricao,
      notaEmitida: ln.natureza === 'entrada' ? 'nao' : 'nao_se_aplica',
      refExtrato: ln.mov.ref,
    })
  }
  const lancamentos = d.lancamentos.map((l) => {
    const ln = baixas.get(l.id)
    if (!ln) return l
    return {
      ...l,
      situacao: 'realizado' as const,
      dataPagamento: ln.mov.data,
      contaFinanceiraId: contaId,
      formaPagamento: l.formaPagamento === 'boleto' || l.formaPagamento === 'pix' ? l.formaPagamento : formaDoTexto(ln.mov.descricao),
      categoriaId: ln.categoriaId ?? l.categoriaId,
      refExtrato: ln.mov.ref,
    }
  })
  return { ...d, lancamentos: [...lancamentos, ...novos] }
}

export function nomeCategoria(categorias: Categoria[], id?: string): string {
  return categorias.find((c) => c.id === id)?.nome ?? 'Sem categoria'
}
