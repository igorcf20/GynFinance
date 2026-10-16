// Suporte: chamados que o cliente abre de dentro do sistema e a equipe responde pelo painel de
// superadmin. Estes tipos são o contrato com o servidor (server/src/suporte.ts confere o mesmo).

export type CategoriaTicket = 'duvida' | 'problema' | 'financeiro' | 'sugestao' | 'outro'
export type SituacaoTicket = 'aberto' | 'em_andamento' | 'aguardando_cliente' | 'resolvido'
export type PrioridadeTicket = 'baixa' | 'normal' | 'alta' | 'urgente'
export type OrigemErro = 'tela' | 'script' | 'promessa' | 'servidor' | 'conexao'

export const CATEGORIAS_TICKET: { valor: CategoriaTicket; rotulo: string; descricao: string }[] = [
  { valor: 'problema', rotulo: 'Algo não funciona', descricao: 'Erro, tela que não abre, valor que não bate.' },
  { valor: 'duvida', rotulo: 'Dúvida', descricao: 'Como fazer alguma coisa no sistema.' },
  { valor: 'financeiro', rotulo: 'Mensalidade', descricao: 'Plano, pagamento ou cobrança.' },
  { valor: 'sugestao', rotulo: 'Sugestão', descricao: 'Uma ideia para o Gynfinance ficar melhor.' },
  { valor: 'outro', rotulo: 'Outro assunto', descricao: 'Qualquer outra coisa.' },
]

export const SITUACOES_TICKET: { valor: SituacaoTicket; rotulo: string; paraCliente: string }[] = [
  { valor: 'aberto', rotulo: 'Aberto', paraCliente: 'Recebido' },
  { valor: 'em_andamento', rotulo: 'Em andamento', paraCliente: 'Em análise' },
  { valor: 'aguardando_cliente', rotulo: 'Aguardando cliente', paraCliente: 'Respondido' },
  { valor: 'resolvido', rotulo: 'Resolvido', paraCliente: 'Resolvido' },
]

export const PRIORIDADES_TICKET: { valor: PrioridadeTicket; rotulo: string }[] = [
  { valor: 'baixa', rotulo: 'Baixa' },
  { valor: 'normal', rotulo: 'Normal' },
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'urgente', rotulo: 'Urgente' },
]

/** Um erro que o app capturou (tela que quebrou, falha de script, servidor fora). */
export interface ErroCapturado {
  quando: string
  origem: OrigemErro
  mensagem: string
  pilha?: string
  /** Rota onde aconteceu, como /lancamentos. */
  pagina: string
}

/** Onde e em que aparelho a pessoa estava. */
export interface ContextoTicket {
  /** Rota, como /lancamentos. */
  pagina: string
  /** Nome da tela, como "Lançamentos". */
  paginaNome: string
  navegador: string
  /** Largura x altura da janela, como 390x844. */
  tela: string
  /** web, android ou ios (o app das lojas). */
  plataforma: string
  versao: string
  online: boolean
}

/** Cópia do perfil no momento da abertura (o servidor monta a partir da conta). */
export interface PerfilTicket {
  nome: string
  email: string
  telefone?: string
  negocio?: { nome: string; cnpj?: string; ehMei: boolean; uf: string; municipio?: string; atividade: string }
  plano?: string
  situacaoAssinatura?: string
}

export interface AnexoTicket {
  id: string
  nome: string
  tipo: string
  tamanho: number
  /** Endereço para abrir a foto. */
  url: string
}

export interface MensagemTicket {
  id: string
  autor: 'cliente' | 'suporte'
  autorNome: string
  texto: string
  /** Nota interna da equipe (só aparece no painel). */
  interna: boolean
  criadoEm: string
  anexos: AnexoTicket[]
}

export interface ResumoTicket {
  id: string
  numero: number
  assunto: string
  categoria: CategoriaTicket
  situacao: SituacaoTicket
  prioridade: PrioridadeTicket
  pagina: string
  paginaNome: string
  criadoEm: string
  atualizadoEm: string
  /** Tem resposta que quem está olhando ainda não leu. */
  naoLido: boolean
  totalMensagens: number
  ultimaMensagem?: { autor: 'cliente' | 'suporte'; texto: string; criadoEm: string }
  /** Só no painel: quem abriu. */
  cliente?: { id: string; nome: string; email: string; negocio?: string }
}

export interface Ticket extends ResumoTicket {
  perfil: PerfilTicket
  contexto: ContextoTicket
  erros: ErroCapturado[]
  contato?: string
  mensagens: MensagemTicket[]
}

export interface NovoAnexo {
  id: string
  nome: string
  tipo: 'image/jpeg' | 'image/png' | 'image/webp'
  /** Conteúdo em base64, sem o prefixo data:. */
  dados: string
}

export interface NovoTicket {
  id: string
  assunto: string
  categoria: CategoriaTicket
  texto: string
  contato?: string
  contexto: ContextoTicket
  erros: ErroCapturado[]
  anexos: NovoAnexo[]
}

export interface NovaMensagem {
  id: string
  texto: string
  anexos: NovoAnexo[]
  /** Só o painel: nota interna, que o cliente não vê. */
  interna?: boolean
  /** Só o painel: situação depois da resposta (padrão: aguardando cliente). */
  situacao?: SituacaoTicket
}

/** Erros iguais na mesma tela, agrupados para o painel. */
export interface GrupoErro {
  chave: string
  origem: OrigemErro
  mensagem: string
  pilha: string
  pagina: string
  vezes: number
  pessoas: number
  primeiraVez: string
  ultimaVez: string
  navegador?: string
  resolvido: boolean
}

export const MAX_FOTOS = 5
export const rotuloSituacao = (s: SituacaoTicket, paraCliente = false) => {
  const x = SITUACOES_TICKET.find((i) => i.valor === s)!
  return paraCliente ? x.paraCliente : x.rotulo
}
export const rotuloCategoria = (c: CategoriaTicket) => CATEGORIAS_TICKET.find((i) => i.valor === c)!.rotulo
