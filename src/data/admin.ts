// Dados do painel de superadmin. Com servidor, tudo vem de /api/admin. Na demonstração publicada
// não há servidor: uma cópia na memória, com assinantes de exemplo, deixa conhecer o painel
// (e some ao recarregar, como o resto da demonstração).
import type { IdModulo, Plano, SituacaoAssinatura } from '../domain/planos'
import { MODULOS } from '../domain/planos'
import type { Centavos, DataISO, MesISO } from '../domain/types'
import { addDias, hojeReal, uid } from '../lib/format'
import { api } from './api'

export interface Assinante {
  id: string
  nome: string
  email: string
  telefone?: string
  criadoEm: string
  ultimoAcesso?: string
  negocio?: { nome: string; cnpj?: string; ehMei: boolean; uf: string; municipio?: string; atividade: string }
  planoId: string
  planoNome: string
  situacao: SituacaoAssinatura
  /** Preço combinado só com este cliente (vazio = preço do plano). */
  valorCentavos?: Centavos
  precoPlanoCentavos: Centavos
  proximoVencimento?: DataISO
  observacao: string
  ultimoPagamento?: DataISO
  /** Quem indicou (link "Indique e ganhe"): a recompensa é dada à mão, nas duas assinaturas. */
  indicadoPor?: { nome: string; email: string }
  /** Quantas pessoas se cadastraram pelo link desta conta. */
  indicacoes?: number
}

export type FormaMensalidade = 'pix' | 'boleto' | 'cartao' | 'dinheiro' | 'transferencia' | 'outro'

export interface PagamentoMensalidade {
  id: string
  valorCentavos: Centavos
  pagoEm: DataISO
  referente: MesISO
  forma: FormaMensalidade
  observacao: string
}

export type PlanoAdmin = Plano & { assinantes: number }
export type DadosPlano = Omit<Plano, 'id'>

export interface ConfigSistema {
  cadastroAberto: boolean
  diasTeste: number
  planoPadrao: string
  iaLigada: boolean
  aviso: string
  manutencao: boolean
}

/** Assistente (inteligência artificial): chave, modelo, limite e quanto está custando. */
export interface ConfigIa {
  /** De onde vem a chave: salva no painel, do servidor (.env) ou nenhuma. */
  origemChave: 'painel' | 'servidor' | 'nenhuma'
  /** Últimos 4 caracteres da chave, para conferir qual está salva. */
  finalChave: string
  modelo: string
  limiteDia: number
  modelos: { id: string; nome: string }[]
  uso: Record<'hoje' | 'mes', { pedidos: number; fotos: number; clientes: number; custoMicro: number }>
}

export interface MudancaIa {
  /** Vazio mantém a chave salva; null apaga. */
  chave?: string | null
  modelo: string
  limiteDia: number
}

export interface ImagemSite {
  id: string
  nome: string
  tipo: string
  tamanho: number
  /** Endereço para usar no site. */
  url: string
}

export interface RegistroAdmin {
  quando: string
  admin: string
  acao: string
  detalhe: string
}

export type MudancaAssinante = Partial<Pick<Assinante, 'planoId' | 'situacao' | 'observacao'>> & {
  valorCentavos?: Centavos | null
  proximoVencimento?: DataISO | null
  telefone?: string | null
}

export interface NovoPagamento {
  valorCentavos: Centavos
  pagoEm: DataISO
  referente: MesISO
  forma: FormaMensalidade
  observacao: string
  avancarVencimento: boolean
}

export interface FonteAdmin {
  demonstracao: boolean
  assinantes(): Promise<Assinante[]>
  alterarAssinante(id: string, m: MudancaAssinante): Promise<void>
  pagamentos(id: string): Promise<PagamentoMensalidade[]>
  registrarPagamento(id: string, p: NovoPagamento): Promise<{ proximoVencimento?: DataISO }>
  apagarPagamento(id: string): Promise<void>
  planos(): Promise<PlanoAdmin[]>
  criarPlano(p: DadosPlano): Promise<string>
  salvarPlano(id: string, p: DadosPlano): Promise<void>
  apagarPlano(id: string): Promise<void>
  site(): Promise<{ conteudo: Record<string, string>; imagens: ImagemSite[] }>
  salvarSite(conteudo: Record<string, string>): Promise<void>
  enviarImagem(arquivo: File): Promise<ImagemSite>
  apagarImagem(id: string): Promise<void>
  config(): Promise<ConfigSistema>
  salvarConfig(c: ConfigSistema): Promise<void>
  registro(): Promise<RegistroAdmin[]>
  ia(): Promise<ConfigIa>
  salvarIa(m: MudancaIa): Promise<void>
  /** Faz um pedido pequeno com a chave salva. */
  testarIa(): Promise<string>
  /** Mensalidades recebidas no mês de hoje. */
  recebidoNoMes(hoje: DataISO): Promise<Centavos>
}

export const FORMAS_MENSALIDADE: { valor: FormaMensalidade; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'outro', rotulo: 'Outro' },
]

/** Quanto o cliente paga por mês: o preço combinado ou o do plano. */
export const mensalidadeDe = (a: Assinante) => a.valorCentavos ?? a.precoPlanoCentavos

/** Em teste ou ativa, mas com o vencimento já passado. */
export const vencida = (a: Assinante, hoje: DataISO) =>
  !!a.proximoVencimento && a.proximoVencimento < hoje && (a.situacao === 'teste' || a.situacao === 'ativa' || a.situacao === 'atrasada')

/** Mesmo dia no mês seguinte (31 de janeiro vira 28 ou 29 de fevereiro). Igual ao servidor. */
export function maisUmMes(iso: DataISO): DataISO {
  const [a, m, d] = iso.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate()
  return new Date(Date.UTC(a, m, Math.min(d, ultimo))).toISOString().slice(0, 10)
}

export interface Resumo {
  receitaMensal: Centavos
  recebidoNoMes: Centavos
  pagantes: number
  emTeste: number
  atrasados: number
  bloqueados: number
  novos30Dias: number
  total: number
}

/** Números do topo do painel, calculados da lista de assinantes e das mensalidades do mês. */
export function resumir(assinantes: Assinante[], hoje: DataISO, recebidoNoMes: Centavos): Resumo {
  const pagantes = assinantes.filter((a) => a.situacao === 'ativa' || a.situacao === 'atrasada')
  const limite = addDias(hoje, -30)
  return {
    receitaMensal: pagantes.reduce((s, a) => s + mensalidadeDe(a), 0),
    recebidoNoMes,
    pagantes: pagantes.length,
    emTeste: assinantes.filter((a) => a.situacao === 'teste').length,
    atrasados: assinantes.filter((a) => a.situacao === 'atrasada' || vencida(a, hoje)).length,
    bloqueados: assinantes.filter((a) => a.situacao === 'suspensa' || a.situacao === 'cancelada').length,
    novos30Dias: assinantes.filter((a) => a.criadoEm.slice(0, 10) >= limite).length,
    total: assinantes.length,
  }
}

async function base64(arquivo: File): Promise<string> {
  const buf = new Uint8Array(await arquivo.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

// ---------- Servidor ----------
export const fonteServidor: FonteAdmin = {
  demonstracao: false,
  assinantes: async () => (await api<{ assinantes: Assinante[] }>('GET', 'admin/assinantes')).assinantes,
  alterarAssinante: async (id, m) => void (await api('PATCH', `admin/assinantes/${id}`, m)),
  pagamentos: async (id) => (await api<{ pagamentos: PagamentoMensalidade[] }>('GET', `admin/assinantes/${id}/pagamentos`)).pagamentos,
  registrarPagamento: (id, p) => api('POST', `admin/assinantes/${id}/pagamentos`, p),
  apagarPagamento: async (id) => void (await api('DELETE', `admin/pagamentos/${id}`)),
  planos: async () => (await api<{ planos: PlanoAdmin[] }>('GET', 'admin/planos')).planos,
  criarPlano: async (p) => (await api<{ id: string }>('POST', 'admin/planos', p)).id,
  salvarPlano: async (id, p) => void (await api('PUT', `admin/planos/${id}`, p)),
  apagarPlano: async (id) => void (await api('DELETE', `admin/planos/${id}`)),
  site: async () => {
    const r = await api<{ conteudo: Record<string, string>; imagens: Omit<ImagemSite, 'url'>[] }>('GET', 'admin/site')
    return { conteudo: r.conteudo, imagens: r.imagens.map((i) => ({ ...i, url: `/api/publico/imagens/${i.id}` })) }
  },
  salvarSite: async (conteudo) => void (await api('PUT', 'admin/site', { conteudo })),
  enviarImagem: async (arquivo) => {
    const id = uid()
    const r = await api<{ url: string }>('POST', 'admin/imagens', { id, nome: arquivo.name, tipo: arquivo.type, dados: await base64(arquivo) })
    return { id, nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size, url: r.url }
  },
  apagarImagem: async (id) => void (await api('DELETE', `admin/imagens/${id}`)),
  config: async () => (await api<{ config: ConfigSistema }>('GET', 'admin/config')).config,
  salvarConfig: async (c) => void (await api('PUT', 'admin/config', c)),
  registro: async () => (await api<{ registro: RegistroAdmin[] }>('GET', 'admin/registro')).registro,
  ia: async () => (await api<{ ia: ConfigIa }>('GET', 'admin/ia')).ia,
  salvarIa: async (m) => void (await api('PUT', 'admin/ia', m)),
  testarIa: async () => (await api<{ resposta: string }>('POST', 'admin/ia/testar')).resposta,
  recebidoNoMes: async () => (await api<{ recebidoNoMesCentavos: Centavos }>('GET', 'admin/resumo')).recebidoNoMesCentavos,
}

// ---------- Demonstração (na memória) ----------
const PRONTOS = MODULOS.filter((m) => m.pronto).map((m) => m.id) as IdModulo[]

export function criarFonteDemo(hoje: DataISO = hojeReal()): FonteAdmin {
  const dia = (n: number) => addDias(hoje, n)
  const quando = (n: number) => `${dia(n)}T${String(9 + (Math.abs(n) % 9)).padStart(2, '0')}:15:00.000Z`
  let planos: Plano[] = [
    { id: 'essencial', nome: 'Essencial', descricao: 'Tudo para organizar o dinheiro do negócio e o MEI.', precoCentavos: 2500, modulos: PRONTOS.filter((m) => m !== 'clientes'), temIa: false, destaque: true, ativo: true, ordem: 1 },
    { id: 'plus', nome: 'Plus', descricao: 'O Essencial com clientes e fornecedores: ficha de cada um e quanto você ganha e gasta com eles.', precoCentavos: 3900, modulos: PRONTOS, temIa: false, destaque: false, ativo: false, ordem: 2 },
    {
      id: 'completo',
      nome: 'Completo',
      descricao: 'O Essencial com o assistente de inteligência artificial (quando lançar).',
      precoCentavos: 3900,
      modulos: PRONTOS,
      temIa: true,
      destaque: false,
      ativo: false,
      ordem: 3,
    },
  ]
  const neg = (nome: string, municipio: string, ehMei = true, atividade = 'servico') => ({ nome, ehMei, uf: 'GO', municipio, atividade })
  let assinantes: Omit<Assinante, 'planoNome' | 'precoPlanoCentavos'>[] = [
    { id: uid(), nome: 'Ana Paula Ribeiro', email: 'ana@docesdaana.com.br', telefone: '62991234567', criadoEm: quando(-120), ultimoAcesso: quando(0), negocio: neg('Doces da Ana', 'Goiânia', true, 'comercio'), planoId: 'essencial', situacao: 'ativa', proximoVencimento: dia(12), observacao: 'Paga sempre por Pix no dia.', ultimoPagamento: dia(-18) },
    { id: uid(), nome: 'Carlos Mendes', email: 'carlos.mendes@gmail.com', telefone: '62998887766', criadoEm: quando(-95), ultimoAcesso: quando(-1), negocio: neg('Mendes Refrigeração', 'Aparecida de Goiânia'), planoId: 'essencial', situacao: 'ativa', proximoVencimento: dia(3), observacao: '', ultimoPagamento: dia(-27) },
    { id: uid(), nome: 'Juliana Costa', email: 'ju.costa.estetica@gmail.com', telefone: '62981112233', criadoEm: quando(-70), ultimoAcesso: quando(-6), negocio: neg('Studio Ju Estética', 'Goiânia'), planoId: 'essencial', situacao: 'atrasada', proximoVencimento: dia(-9), observacao: 'Pediu para pagar no dia 15.', ultimoPagamento: dia(-39) },
    { id: uid(), nome: 'Roberto Alves', email: 'roberto@alvesmateriais.com.br', telefone: '64992223344', criadoEm: quando(-200), ultimoAcesso: quando(-2), negocio: { ...neg('Alves Materiais de Construção', 'Rio Verde', false, 'comercio'), cnpj: '12.345.678/0001-90' }, planoId: 'essencial', situacao: 'ativa', valorCentavos: 2000, proximoVencimento: dia(20), observacao: 'Desconto de fundador: R$ 20 por mês.', ultimoPagamento: dia(-10) },
    { id: uid(), nome: 'Fernanda Lima', email: 'fe.lima.bolos@hotmail.com', telefone: '62985556677', criadoEm: quando(-4), ultimoAcesso: quando(0), negocio: neg('Fê Bolos e Festas', 'Goiânia', true, 'comercio'), planoId: 'essencial', situacao: 'teste', proximoVencimento: dia(3), observacao: '' },
    { id: uid(), nome: 'Marcos Vinícius Souza', email: 'marcos.vs@outlook.com', criadoEm: quando(-2), ultimoAcesso: quando(-2), planoId: 'essencial', situacao: 'teste', proximoVencimento: dia(5), observacao: 'Criou a conta e não terminou a configuração.' },
    { id: uid(), nome: 'Patrícia Gomes', email: 'patricia@petshopamigo.com.br', telefone: '62987654321', criadoEm: quando(-150), ultimoAcesso: quando(-40), negocio: neg('Pet Shop Amigo Fiel', 'Anápolis', true, 'misto'), planoId: 'essencial', situacao: 'suspensa', proximoVencimento: dia(-34), observacao: 'Sem resposta no WhatsApp desde o mês passado.', ultimoPagamento: dia(-64) },
    { id: uid(), nome: 'Diego Martins', email: 'diego.barbearia@gmail.com', telefone: '62993334455', criadoEm: quando(-60), ultimoAcesso: quando(-30), negocio: neg('Barbearia do Diego', 'Trindade'), planoId: 'essencial', situacao: 'cancelada', observacao: 'Fechou a barbearia.', ultimoPagamento: dia(-35) },
  ]
  const pagamentos = new Map<string, PagamentoMensalidade[]>()
  for (const a of assinantes) {
    if (!a.ultimoPagamento) continue
    const lista: PagamentoMensalidade[] = []
    for (let i = 0; i < 3; i++) {
      const pagoEm = addDias(a.ultimoPagamento, -30 * i)
      lista.push({ id: uid(), valorCentavos: a.valorCentavos ?? 2500, pagoEm, referente: pagoEm.slice(0, 7), forma: i === 1 ? 'boleto' : 'pix', observacao: '' })
    }
    pagamentos.set(a.id, lista)
  }
  let config: ConfigSistema = { cadastroAberto: true, diasTeste: 7, planoPadrao: 'essencial', iaLigada: false, aviso: '', manutencao: false }
  const MODELOS = [
    { id: 'claude-opus-5-5', nome: 'Opus 5.5 (mais preciso)' },
    { id: 'claude-sonnet-5-5', nome: 'Sonnet 5.5 (equilibrado)' },
    { id: 'claude-haiku-5-5', nome: 'Haiku 5.5 (mais barato)' },
  ]
  let ia: ConfigIa = {
    origemChave: 'nenhuma',
    finalChave: '',
    modelo: MODELOS[0].id,
    limiteDia: 40,
    modelos: MODELOS,
    uso: { hoje: { pedidos: 0, fotos: 0, clientes: 0, custoMicro: 0 }, mes: { pedidos: 0, fotos: 0, clientes: 0, custoMicro: 0 } },
  }
  let conteudo: Record<string, string> = {}
  const imagens: ImagemSite[] = []
  const registro: RegistroAdmin[] = [{ quando: quando(-1), admin: 'voce@exemplo.com', acao: 'mensalidade recebida', detalhe: 'Mendes Refrigeração: R$ 25,00' }]
  const anotar = (acao: string, detalhe = '') => registro.unshift({ quando: new Date().toISOString(), admin: 'voce@exemplo.com', acao, detalhe })
  const espera = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120))
  const completo = (a: (typeof assinantes)[number]): Assinante => {
    const p = planos.find((x) => x.id === a.planoId)
    return { ...a, planoNome: p?.nome ?? a.planoId, precoPlanoCentavos: p?.precoCentavos ?? 0 }
  }
  const nomeDe = (id: string) => assinantes.find((a) => a.id === id)?.negocio?.nome ?? assinantes.find((a) => a.id === id)?.nome ?? id
  const slug = (nome: string) =>
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'plano'

  return {
    demonstracao: true,
    assinantes: () => espera(assinantes.map(completo)),
    alterarAssinante: async (id, m) => {
      assinantes = assinantes.map((a) =>
        a.id !== id
          ? a
          : {
              ...a,
              ...(m.planoId !== undefined && { planoId: m.planoId }),
              ...(m.situacao !== undefined && { situacao: m.situacao }),
              ...(m.observacao !== undefined && { observacao: m.observacao }),
              ...(m.valorCentavos !== undefined && { valorCentavos: m.valorCentavos ?? undefined }),
              ...(m.proximoVencimento !== undefined && { proximoVencimento: m.proximoVencimento ?? undefined }),
              ...(m.telefone !== undefined && { telefone: m.telefone || undefined }),
            },
      )
      anotar('assinante alterado', nomeDe(id))
      await espera(null)
    },
    pagamentos: (id) => espera(pagamentos.get(id) ?? []),
    registrarPagamento: async (id, p) => {
      const lista = pagamentos.get(id) ?? []
      lista.unshift({ id: uid(), valorCentavos: p.valorCentavos, pagoEm: p.pagoEm, referente: p.referente, forma: p.forma, observacao: p.observacao })
      lista.sort((a, b) => b.pagoEm.localeCompare(a.pagoEm))
      pagamentos.set(id, lista)
      let proximoVencimento: DataISO | undefined
      assinantes = assinantes.map((a) => {
        if (a.id !== id) return a
        proximoVencimento = p.avancarVencimento ? maisUmMes(a.proximoVencimento ?? p.pagoEm) : a.proximoVencimento
        const ultimoPagamento = !a.ultimoPagamento || p.pagoEm > a.ultimoPagamento ? p.pagoEm : a.ultimoPagamento
        return p.avancarVencimento ? { ...a, situacao: 'ativa' as const, proximoVencimento, ultimoPagamento } : { ...a, ultimoPagamento }
      })
      anotar('mensalidade recebida', nomeDe(id))
      return espera({ proximoVencimento })
    },
    apagarPagamento: async (id) => {
      for (const [k, lista] of pagamentos) pagamentos.set(k, lista.filter((p) => p.id !== id))
      anotar('mensalidade apagada')
      await espera(null)
    },
    planos: () => espera(planos.map((p) => ({ ...p, assinantes: assinantes.filter((a) => a.planoId === p.id && a.situacao !== 'cancelada').length }))),
    criarPlano: async (p) => {
      let id = slug(p.nome)
      for (let i = 2; planos.some((x) => x.id === id); i++) id = `${slug(p.nome)}-${i}`
      planos = [...planos, { ...p, id, modulos: [...new Set<IdModulo>(['financeiro', ...p.modulos])] }]
      anotar('plano criado', p.nome)
      return espera(id)
    },
    salvarPlano: async (id, p) => {
      planos = planos.map((x) => (x.id === id ? { ...p, id, modulos: [...new Set<IdModulo>(['financeiro', ...p.modulos])] } : x))
      anotar('plano alterado', p.nome)
      await espera(null)
    },
    apagarPlano: async (id) => {
      if (assinantes.some((a) => a.planoId === id) || config.planoPadrao === id)
        throw new Error('Há clientes neste plano (ou ele é o plano dos novos cadastros). Mude-os de plano ou só desative este.')
      planos = planos.filter((p) => p.id !== id)
      anotar('plano apagado', id)
      await espera(null)
    },
    site: () => espera({ conteudo, imagens }),
    salvarSite: async (c) => {
      const novo = { ...conteudo }
      for (const [k, v] of Object.entries(c)) {
        if (v.trim()) novo[k] = v
        else delete novo[k]
      }
      conteudo = novo
      anotar('site alterado', Object.keys(c).join(', '))
      await espera(null)
    },
    enviarImagem: async (arquivo) => {
      const img = { id: uid(), nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size, url: URL.createObjectURL(arquivo) }
      imagens.unshift(img)
      anotar('imagem enviada', arquivo.name)
      return espera(img)
    },
    apagarImagem: async (id) => {
      const i = imagens.findIndex((x) => x.id === id)
      if (i >= 0) imagens.splice(i, 1)
      await espera(null)
    },
    config: () => espera(config),
    salvarConfig: async (c) => {
      config = { ...c }
      anotar('configurações alteradas')
      await espera(null)
    },
    registro: () => espera(registro),
    ia: () => espera(ia),
    salvarIa: async (m) => {
      const chave = m.chave === null ? 'nenhuma' : m.chave ? 'painel' : ia.origemChave
      ia = { ...ia, modelo: m.modelo, limiteDia: m.limiteDia, origemChave: chave, finalChave: m.chave === null ? '' : m.chave ? m.chave.slice(-4) : ia.finalChave }
      anotar('assistente alterado')
      await espera(null)
    },
    testarIa: async () => {
      await espera(null)
      throw new Error('Na demonstração não há chave de verdade para testar.')
    },
    recebidoNoMes: (h) =>
      espera(
        [...pagamentos.values()]
          .flat()
          .filter((p) => p.pagoEm.startsWith(h.slice(0, 7)))
          .reduce((s, p) => s + p.valorCentavos, 0),
      ),
  }
}
