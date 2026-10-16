// Chamados de suporte. Com servidor, tudo vai para /api/suporte (cliente) e /api/admin/suporte
// (equipe). Na demonstração publicada não há servidor: os chamados ficam na memória, num lugar só
// para o cliente e o painel, e somem ao recarregar, como o resto da demonstração.
import { useSyncExternalStore } from 'react'
import type {
  CategoriaTicket,
  GrupoErro,
  MensagemTicket,
  NovaMensagem,
  NovoAnexo,
  NovoTicket,
  PerfilTicket,
  PrioridadeTicket,
  ResumoTicket,
  SituacaoTicket,
  Ticket,
} from '../domain/suporte'
import { uid } from '../lib/format'
import { api, type Conta } from './api'
import { comprimirFoto } from './comprovante'

// ---------- Nomes das telas (vão no chamado) ----------
const NOMES: [RegExp, string][] = [
  [/^\/$/, 'Início'],
  [/^\/lancamentos/, 'Lançamentos'],
  [/^\/lancar/, 'Novo lançamento'],
  [/^\/contas/, 'Contas a pagar e receber'],
  [/^\/agenda/, 'Agenda'],
  [/^\/importar/, 'Importar extrato'],
  [/^\/mei/, 'Meu MEI'],
  [/^\/relatorios/, 'Relatórios'],
  [/^\/fluxo/, 'Fluxo de caixa'],
  [/^\/fechamento/, 'Fechamento do mês'],
  [/^\/configuracoes/, 'Configurações'],
  [/^\/mais/, 'Mais'],
  [/^\/admin/, 'Superadmin'],
  [/^\/comecar/, 'Configuração inicial'],
  [/^\/entrar/, 'Entrar'],
  [/^\/suporte/, 'Ajuda e suporte'],
]
export const nomeDaPagina = (rota: string) => NOMES.find(([r]) => r.test(rota))?.[1] ?? rota

/** Telas que a pessoa pode escolher ao abrir o chamado ("onde aconteceu?"). */
export const PAGINAS_ESCOLHA: { valor: string; rotulo: string }[] = [
  '/',
  '/lancamentos',
  '/lancar',
  '/contas',
  '/agenda',
  '/importar',
  '/mei',
  '/relatorios',
  '/fluxo',
  '/fechamento',
  '/configuracoes',
].map((r) => ({ valor: r, rotulo: nomeDaPagina(r) }))

// ---------- Fotos ----------
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const
export interface FotoPronta {
  anexo: NovoAnexo
  /** Para mostrar a miniatura antes de enviar. */
  previa: string
  tamanho: number
}

/** Foto ou print de tela: reduz para no máximo 1600 px em JPEG, como os comprovantes. */
export async function prepararFoto(arquivo: File): Promise<FotoPronta> {
  if (!arquivo.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(arquivo.name))
    throw new Error(`"${arquivo.name}" não é uma foto. Envie imagens JPG, PNG ou um print da tela.`)
  const f = await comprimirFoto(arquivo).catch(() => {
    throw new Error(`A foto "${arquivo.name}" não abriu. Tire um print da tela ou envie em JPG ou PNG.`)
  })
  if (f.tamanho > 5 * 1024 * 1024) throw new Error(`A foto "${arquivo.name}" ficou maior que 5 MB. Envie uma menor.`)
  const tipo = (TIPOS_FOTO as readonly string[]).includes(f.tipo) ? (f.tipo as NovoAnexo['tipo']) : 'image/jpeg'
  const nome = (arquivo.name.replace(/\.[^.]+$/, '') || 'foto').slice(0, 190) + '.jpg'
  return { anexo: { id: uid(), nome, tipo, dados: f.dados.slice(f.dados.indexOf(',') + 1) }, previa: f.dados, tamanho: f.tamanho }
}

// ---------- Chamados com resposta não lida (faixa no topo e menu) ----------
let naoLidos = 0
let contaVista: Conta | null | undefined
const ouvintes = new Set<() => void>()
export function definirNaoLidos(n: number) {
  if (n === naoLidos) return
  naoLidos = n
  ouvintes.forEach((f) => f())
}
/** Valor que veio com a conta (ao entrar ou recarregar). Depois, a tela de Ajuda atualiza. */
export function naoLidosDaConta(conta: Conta | null) {
  if (conta === contaVista) return
  contaVista = conta
  if (conta) definirNaoLidos(conta.suporte?.naoLidos ?? 0)
}
export const useNaoLidosSuporte = () =>
  useSyncExternalStore(
    (f) => {
      ouvintes.add(f)
      return () => ouvintes.delete(f)
    },
    () => naoLidos,
  )

// ---------- Fontes ----------
export interface FonteSuporte {
  demonstracao: boolean
  meus(): Promise<{ tickets: ResumoTicket[]; naoLidos: number }>
  /** O servidor monta o perfil pela conta; o perfil enviado aqui só vale na demonstração. */
  abrir(t: NovoTicket, perfil: PerfilTicket): Promise<{ id: string; numero: number }>
  ler(id: string): Promise<Ticket>
  responder(id: string, m: NovaMensagem): Promise<void>
  resolver(id: string): Promise<void>
}

export interface FiltroSuporte {
  situacao: SituacaoTicket | 'abertos' | 'todos'
  busca: string
}

export interface FonteSuporteAdmin {
  demonstracao: boolean
  lista(f: FiltroSuporte): Promise<{ tickets: ResumoTicket[]; contagem: Record<SituacaoTicket, number>; naoLidos: number }>
  ler(id: string): Promise<{ ticket: Ticket; outros: number }>
  responder(id: string, m: NovaMensagem): Promise<void>
  alterar(id: string, m: { situacao?: SituacaoTicket; prioridade?: PrioridadeTicket }): Promise<void>
  erros(resolvidos: boolean): Promise<GrupoErro[]>
  resolverErro(chave: string): Promise<void>
}

export const suporteServidor: FonteSuporte = {
  demonstracao: false,
  meus: () => api('GET', 'suporte/tickets'),
  abrir: (t) => api('POST', 'suporte/tickets', t),
  ler: async (id) => (await api<{ ticket: Ticket }>('GET', `suporte/tickets/${id}`)).ticket,
  responder: async (id, m) => void (await api('POST', `suporte/tickets/${id}/mensagens`, { id: m.id, texto: m.texto, anexos: m.anexos })),
  resolver: async (id) => void (await api('POST', `suporte/tickets/${id}/resolver`)),
}

export const suporteAdminServidor: FonteSuporteAdmin = {
  demonstracao: false,
  lista: (f) => {
    const q = new URLSearchParams()
    if (f.situacao !== 'todos' && f.situacao !== 'abertos') q.set('situacao', f.situacao)
    if (f.busca.trim()) q.set('busca', f.busca.trim())
    return api<{ tickets: ResumoTicket[]; contagem: Record<SituacaoTicket, number>; naoLidos: number }>('GET', `admin/suporte${q.size ? `?${q}` : ''}`).then((r) => ({
      ...r,
      // "Abertos" junta tudo o que não está resolvido.
      tickets: f.situacao === 'abertos' ? r.tickets.filter((t) => t.situacao !== 'resolvido') : r.tickets,
    }))
  },
  ler: (id) => api('GET', `admin/suporte/${id}`),
  responder: async (id, m) => void (await api('POST', `admin/suporte/${id}/mensagens`, m)),
  alterar: async (id, m) => void (await api('PATCH', `admin/suporte/${id}`, m)),
  erros: async (resolvidos) => (await api<{ grupos: GrupoErro[] }>('GET', `admin/erros${resolvidos ? '?resolvidos=1' : ''}`)).grupos,
  resolverErro: async (chave) => void (await api('POST', `admin/erros/${encodeURIComponent(chave)}/resolver`)),
}

// ---------- Demonstração (na memória) ----------
interface TicketDemo extends Ticket {
  donoDemo: boolean
  naoLidoSuporte: boolean
}

const espera = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 180))
const ha = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

/** Desenho simples de um print, para o chamado de exemplo ter foto. */
function printExemplo(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220"><rect width="360" height="220" rx="16" fill="#f5f7fa"/><rect x="16" y="16" width="328" height="48" rx="10" fill="#fff"/><rect x="28" y="32" width="120" height="14" rx="7" fill="#3478f6"/><rect x="16" y="76" width="328" height="128" rx="12" fill="#fff"/><rect x="32" y="96" width="200" height="12" rx="6" fill="#dbe4f0"/><rect x="32" y="120" width="150" height="12" rx="6" fill="#dbe4f0"/><rect x="32" y="152" width="96" height="30" rx="8" fill="#e0324a"/><text x="44" y="172" font-family="Arial" font-size="13" fill="#fff">Erro</text></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

function criarDemo() {
  const perfilAna: PerfilTicket = {
    nome: 'Ana Paula Ribeiro',
    email: 'ana@docesdaana.com.br',
    telefone: '62991234567',
    negocio: { nome: 'Doces da Ana', ehMei: true, uf: 'GO', municipio: 'Goiânia', atividade: 'comercio' },
    plano: 'Essencial',
    situacaoAssinatura: 'ativa',
  }
  const contexto = (pagina: string, navegador = 'Chrome 141 no Android', tela = '390x844') => ({
    pagina,
    paginaNome: nomeDaPagina(pagina),
    navegador,
    tela,
    plataforma: 'web',
    versao: 'web',
    online: true,
  })
  const msg = (autor: 'cliente' | 'suporte', texto: string, min: number, extra: Partial<MensagemTicket> = {}): MensagemTicket => ({
    id: uid(),
    autor,
    autorNome: autor === 'cliente' ? 'Ana Paula Ribeiro' : 'Equipe Gynfinance',
    texto,
    interna: false,
    criadoEm: ha(min),
    anexos: [],
    ...extra,
  })
  const tickets: TicketDemo[] = [
    {
      id: uid(),
      numero: 1042,
      assunto: 'Como separo o pró-labore do dinheiro da loja?',
      categoria: 'duvida',
      situacao: 'aguardando_cliente',
      prioridade: 'normal',
      pagina: '/lancar',
      paginaNome: nomeDaPagina('/lancar'),
      criadoEm: ha(60 * 26),
      atualizadoEm: ha(40),
      naoLido: true,
      totalMensagens: 2,
      perfil: perfilAna,
      contexto: contexto('/lancar'),
      erros: [],
      mensagens: [
        msg('cliente', 'Oi! Toda semana eu pego um dinheiro do caixa para mim. Onde eu lanço isso para não misturar com as despesas da loja?', 60 * 26),
        msg('suporte', 'Oi, Ana! Use "Retirada para mim (pró-labore)" no Novo lançamento. Ela sai do caixa, mas não entra como despesa, então o "quanto sobrou" do mês continua certo. Se quiser, defina um pró-labore fixo em Configurações.', 40),
      ],
      donoDemo: true,
      naoLidoSuporte: false,
    },
    {
      id: uid(),
      numero: 1038,
      assunto: 'Extrato do banco não importou',
      categoria: 'problema',
      situacao: 'resolvido',
      prioridade: 'alta',
      pagina: '/importar',
      paginaNome: nomeDaPagina('/importar'),
      criadoEm: ha(60 * 24 * 6),
      atualizadoEm: ha(60 * 24 * 5),
      naoLido: false,
      totalMensagens: 3,
      perfil: perfilAna,
      contexto: contexto('/importar', 'Chrome 141 no Windows', '1366x768'),
      erros: [{ quando: ha(60 * 24 * 6), origem: 'servidor', mensagem: 'POST sincronizar: 500 Algo deu errado no servidor.', pagina: '/importar' }],
      mensagens: [
        msg('cliente', 'Tentei importar o arquivo do Sicoob e apareceu erro. Mandei o print.', 60 * 24 * 6, {
          anexos: [{ id: uid(), nome: 'print-erro.png', tipo: 'image/svg+xml', tamanho: 18_000, url: printExemplo() }],
        }),
        msg('suporte', 'Achamos o problema: o arquivo vinha com a data num formato diferente. Já corrigimos. Pode tentar de novo?', 60 * 24 * 5.5),
        msg('cliente', 'Deu certo, obrigada!', 60 * 24 * 5),
      ],
      donoDemo: true,
      naoLidoSuporte: false,
    },
    {
      id: uid(),
      numero: 1045,
      assunto: 'Cobrança da mensalidade veio duplicada',
      categoria: 'financeiro',
      situacao: 'aberto',
      prioridade: 'urgente',
      pagina: '/configuracoes',
      paginaNome: nomeDaPagina('/configuracoes'),
      criadoEm: ha(25),
      atualizadoEm: ha(25),
      naoLido: false,
      totalMensagens: 1,
      perfil: {
        nome: 'Carlos Mendes',
        email: 'carlos.mendes@gmail.com',
        telefone: '62998887766',
        negocio: { nome: 'Mendes Refrigeração', ehMei: true, uf: 'GO', municipio: 'Aparecida de Goiânia', atividade: 'servico' },
        plano: 'Essencial',
        situacaoAssinatura: 'ativa',
      },
      contexto: contexto('/configuracoes', 'Safari 18 no iOS', '393x852'),
      erros: [],
      contato: '62998887766',
      mensagens: [
        { ...msg('cliente', 'Recebi dois Pix de cobrança da mensalidade de outubro. Paguei um só. Está certo?', 25), autorNome: 'Carlos Mendes' },
      ],
      donoDemo: false,
      naoLidoSuporte: true,
    },
    {
      id: uid(),
      numero: 1044,
      assunto: 'Tela da agenda ficou em branco',
      categoria: 'problema',
      situacao: 'em_andamento',
      prioridade: 'alta',
      pagina: '/agenda',
      paginaNome: nomeDaPagina('/agenda'),
      criadoEm: ha(60 * 5),
      atualizadoEm: ha(60 * 3),
      naoLido: false,
      totalMensagens: 2,
      perfil: {
        nome: 'Juliana Costa',
        email: 'ju.costa.estetica@gmail.com',
        telefone: '62981112233',
        negocio: { nome: 'Studio Ju Estética', ehMei: true, uf: 'GO', municipio: 'Goiânia', atividade: 'servico' },
        plano: 'Essencial',
        situacaoAssinatura: 'atrasada',
      },
      contexto: contexto('/agenda', 'Samsung Internet 27 no Android', '360x780'),
      erros: [
        {
          quando: ha(60 * 5 + 2),
          origem: 'tela',
          mensagem: "Cannot read properties of undefined (reading 'inicio')",
          pilha: "TypeError: Cannot read properties of undefined (reading 'inicio')\n    at Semana (Agenda.tsx:212)\n    at renderWithHooks",
          pagina: '/agenda',
        },
      ],
      mensagens: [
        { ...msg('cliente', 'Abri a agenda na semana que vem e ficou tudo branco, com uma mensagem de erro.', 60 * 5), autorNome: 'Juliana Costa' },
        msg('suporte', 'Erro reproduzido na semana com feriado. Correção vai na próxima atualização.', 60 * 3, { interna: true }),
      ],
      donoDemo: false,
      naoLidoSuporte: false,
    },
  ]
  const erros: (GrupoErro & { ticket?: number })[] = [
    {
      chave: 'a1b2c3d4e5f60718',
      origem: 'tela',
      mensagem: "Cannot read properties of undefined (reading 'inicio')",
      pilha: "TypeError: Cannot read properties of undefined (reading 'inicio')\n    at Semana (Agenda.tsx:212)\n    at renderWithHooks",
      pagina: '/agenda',
      vezes: 7,
      pessoas: 3,
      primeiraVez: ha(60 * 30),
      ultimaVez: ha(60 * 5),
      navegador: 'Samsung Internet 27 no Android',
      resolvido: false,
    },
    {
      chave: 'f0e1d2c3b4a59687',
      origem: 'servidor',
      mensagem: 'canceling statement due to statement timeout',
      pilha: 'error: canceling statement due to statement timeout\n    at lerDados (dados.ts:48)',
      pagina: 'GET /api/dados',
      vezes: 2,
      pessoas: 2,
      primeiraVez: ha(60 * 50),
      ultimaVez: ha(60 * 20),
      navegador: '',
      resolvido: false,
    },
    {
      chave: '0918273645abcdef',
      origem: 'promessa',
      mensagem: 'Failed to fetch dynamically imported module',
      pilha: '',
      pagina: '/relatorios',
      vezes: 1,
      pessoas: 1,
      primeiraVez: ha(60 * 24 * 3),
      ultimaVez: ha(60 * 24 * 3),
      navegador: 'Safari 17 no iOS',
      resolvido: true,
    },
  ]
  let numero = 1046

  const resumo = (t: TicketDemo, paraSuporte: boolean): ResumoTicket => {
    const visiveis = paraSuporte ? t.mensagens : t.mensagens.filter((m) => !m.interna)
    const ultima = visiveis[visiveis.length - 1]
    return {
      id: t.id,
      numero: t.numero,
      assunto: t.assunto,
      categoria: t.categoria,
      situacao: t.situacao,
      prioridade: t.prioridade,
      pagina: t.pagina,
      paginaNome: t.paginaNome,
      criadoEm: t.criadoEm,
      atualizadoEm: t.atualizadoEm,
      naoLido: paraSuporte ? t.naoLidoSuporte : t.naoLido,
      totalMensagens: visiveis.length,
      ultimaMensagem: ultima && { autor: ultima.autor, texto: ultima.texto.slice(0, 140), criadoEm: ultima.criadoEm },
      cliente: paraSuporte ? { id: t.perfil.email, nome: t.perfil.nome, email: t.perfil.email, negocio: t.perfil.negocio?.nome } : undefined,
    }
  }
  const achar = (id: string) => {
    const t = tickets.find((x) => x.id === id)
    if (!t) throw new Error('Chamado não encontrado.')
    return t
  }
  const anexosDe = (a: NovoAnexo[]) => a.map((x) => ({ id: x.id, nome: x.nome, tipo: x.tipo, tamanho: Math.round((x.dados.length * 3) / 4), url: `data:${x.tipo};base64,${x.dados}` }))
  const contarNaoLidos = () => tickets.filter((t) => t.donoDemo && t.naoLido).length
  const PESO: Record<PrioridadeTicket, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 }

  const cliente: FonteSuporte = {
    demonstracao: true,
    meus: () => {
      const meus = tickets.filter((t) => t.donoDemo).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
      return espera({ tickets: meus.map((t) => resumo(t, false)), naoLidos: contarNaoLidos() })
    },
    abrir: async (n, perfil) => {
      const agora = new Date().toISOString()
      const t: TicketDemo = {
        id: n.id,
        numero: numero++,
        assunto: n.assunto,
        categoria: n.categoria,
        situacao: 'aberto',
        prioridade: n.categoria === 'problema' ? 'alta' : 'normal',
        pagina: n.contexto.pagina,
        paginaNome: n.contexto.paginaNome,
        criadoEm: agora,
        atualizadoEm: agora,
        naoLido: false,
        totalMensagens: 1,
        perfil,
        contexto: n.contexto,
        erros: n.erros,
        contato: n.contato,
        mensagens: [{ id: uid(), autor: 'cliente', autorNome: perfil.nome, texto: n.texto, interna: false, criadoEm: agora, anexos: anexosDe(n.anexos) }],
        donoDemo: true,
        naoLidoSuporte: true,
      }
      tickets.unshift(t)
      return espera({ id: t.id, numero: t.numero })
    },
    ler: async (id) => {
      const t = achar(id)
      t.naoLido = false
      return espera({ ...resumo(t, false), perfil: t.perfil, contexto: t.contexto, erros: t.erros, contato: t.contato, mensagens: t.mensagens.filter((m) => !m.interna) })
    },
    responder: async (id, m) => {
      const t = achar(id)
      const agora = new Date().toISOString()
      t.mensagens.push({ id: m.id, autor: 'cliente', autorNome: t.perfil.nome, texto: m.texto, interna: false, criadoEm: agora, anexos: anexosDe(m.anexos) })
      if (t.situacao !== 'em_andamento') t.situacao = 'aberto'
      t.atualizadoEm = agora
      t.naoLidoSuporte = true
      await espera(null)
    },
    resolver: async (id) => {
      const t = achar(id)
      t.situacao = 'resolvido'
      t.atualizadoEm = new Date().toISOString()
      await espera(null)
    },
  }

  const admin: FonteSuporteAdmin = {
    demonstracao: true,
    lista: (f) => {
      const busca = f.busca.trim().toLowerCase()
      const contagem = { aberto: 0, em_andamento: 0, aguardando_cliente: 0, resolvido: 0 } as Record<SituacaoTicket, number>
      for (const t of tickets) contagem[t.situacao]++
      const lista = tickets
        .filter((t) => (f.situacao === 'todos' ? true : f.situacao === 'abertos' ? t.situacao !== 'resolvido' : t.situacao === f.situacao))
        .filter((t) => !busca || [t.assunto, t.perfil.nome, t.perfil.email, t.perfil.negocio?.nome ?? '', `#${t.numero}`].some((s) => s.toLowerCase().includes(busca)))
        .sort(
          (a, b) =>
            Number(b.naoLidoSuporte) - Number(a.naoLidoSuporte) ||
            Number(a.situacao === 'resolvido') - Number(b.situacao === 'resolvido') ||
            PESO[a.prioridade] - PESO[b.prioridade] ||
            b.atualizadoEm.localeCompare(a.atualizadoEm),
        )
      return espera({ tickets: lista.map((t) => resumo(t, true)), contagem, naoLidos: tickets.filter((t) => t.naoLidoSuporte).length })
    },
    ler: async (id) => {
      const t = achar(id)
      t.naoLidoSuporte = false
      const outros = tickets.filter((x) => x.perfil.email === t.perfil.email && x.id !== t.id).length
      return espera({ ticket: { ...resumo(t, true), perfil: t.perfil, contexto: t.contexto, erros: t.erros, contato: t.contato, mensagens: t.mensagens }, outros })
    },
    responder: async (id, m) => {
      const t = achar(id)
      const agora = new Date().toISOString()
      t.mensagens.push({ id: m.id, autor: 'suporte', autorNome: 'Equipe Gynfinance', texto: m.texto, interna: !!m.interna, criadoEm: agora, anexos: anexosDe(m.anexos) })
      if (!m.interna) {
        t.situacao = m.situacao ?? 'aguardando_cliente'
        t.naoLido = true
      } else if (m.situacao) t.situacao = m.situacao
      t.atualizadoEm = agora
      if (t.donoDemo) definirNaoLidos(contarNaoLidos())
      await espera(null)
    },
    alterar: async (id, m) => {
      const t = achar(id)
      if (m.situacao) t.situacao = m.situacao
      if (m.prioridade) t.prioridade = m.prioridade
      await espera(null)
    },
    erros: (resolvidos) => espera(erros.filter((e) => resolvidos || !e.resolvido)),
    resolverErro: async (chave) => {
      for (const e of erros) if (e.chave === chave) e.resolvido = true
      await espera(null)
    },
  }
  return { cliente, admin, naoLidos: contarNaoLidos }
}

let demo: ReturnType<typeof criarDemo> | null = null
/** A demonstração tem um conjunto só de chamados: o que o cliente abre aparece no painel. */
export function suporteDemo() {
  if (!demo) {
    demo = criarDemo()
    definirNaoLidos(demo.naoLidos())
  }
  return demo
}

export const CATEGORIA_PADRAO: CategoriaTicket = 'problema'
