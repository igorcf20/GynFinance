// Planos da assinatura (mensalidade) e o catálogo de módulos que cada plano libera.
// O superadmin monta os planos no painel; o sistema mostra a cada cliente só os módulos do plano dele.
import type { Centavos, DataISO } from './types'

export type IdModulo = 'financeiro' | 'mei' | 'agenda' | 'extrato' | 'comprovantes' | 'estoque' | 'clientes' | 'nota' | 'pix'

export interface Modulo {
  id: IdModulo
  nome: string
  descricao: string
  /** Já existe no sistema (os outros aparecem como "em breve"). */
  pronto: boolean
  /** Faz parte de todo plano: sem ele o sistema não funciona. */
  base?: boolean
}

export const MODULOS: Modulo[] = [
  { id: 'financeiro', nome: 'Financeiro', descricao: 'Painel, lançamentos, contas a pagar e a receber, relatórios, fluxo de caixa e fechamento do mês.', pronto: true, base: true },
  { id: 'mei', nome: 'Meu MEI', descricao: 'Limite anual do MEI e controle do DAS.', pronto: true },
  { id: 'agenda', nome: 'Agenda', descricao: 'Atendimentos com clientes e contas no calendário.', pronto: true },
  { id: 'extrato', nome: 'Importar extrato', descricao: 'Traz o extrato do banco (OFX ou CSV) e dá baixa nas contas.', pronto: true },
  { id: 'comprovantes', nome: 'Comprovantes', descricao: 'Anexar foto ou PDF do comprovante em cada pagamento.', pronto: true },
  { id: 'estoque', nome: 'Estoque', descricao: 'Produtos, entradas e saídas de estoque.', pronto: false },
  { id: 'clientes', nome: 'Clientes e fornecedores', descricao: 'Ficha de cada cliente e fornecedor, com quanto você ganhou e gastou com cada um.', pronto: true },
  { id: 'nota', nome: 'Nota fiscal', descricao: 'Emissão de nota fiscal pelo sistema.', pronto: false },
  { id: 'pix', nome: 'Pix integrado', descricao: 'Cobrança por Pix com baixa automática.', pronto: false },
]

export interface Plano {
  id: string
  nome: string
  descricao: string
  precoCentavos: Centavos
  modulos: IdModulo[]
  /** Inclui os recursos de inteligência artificial (quando existirem). */
  temIa: boolean
  /** Aparece em destaque no site ("mais escolhido"). */
  destaque: boolean
  /** Aparece no site e pode ser escolhido para novos clientes. */
  ativo: boolean
  ordem: number
}

export type SituacaoAssinatura = 'teste' | 'ativa' | 'atrasada' | 'suspensa' | 'cancelada'

export const SITUACOES_ASSINATURA: { valor: SituacaoAssinatura; rotulo: string }[] = [
  { valor: 'teste', rotulo: 'Em teste' },
  { valor: 'ativa', rotulo: 'Ativa' },
  { valor: 'atrasada', rotulo: 'Atrasada' },
  { valor: 'suspensa', rotulo: 'Suspensa' },
  { valor: 'cancelada', rotulo: 'Cancelada' },
]

/** O que o cliente logado recebe sobre a própria assinatura (GET /api/conta). */
export interface MinhaAssinatura {
  planoId: string
  planoNome: string
  modulos: IdModulo[]
  temIa: boolean
  situacao: SituacaoAssinatura
  proximoVencimento?: DataISO
}

/** Suspensa ou cancelada: o cliente vê e exporta os dados, mas não grava nada novo. */
export const podeGravar = (s: SituacaoAssinatura) => s !== 'suspensa' && s !== 'cancelada'

/** Sem servidor (demonstração) tudo fica liberado. */
export const TODOS_OS_MODULOS: IdModulo[] = MODULOS.filter((m) => m.pronto).map((m) => m.id)

export function temModulo(modulos: IdModulo[] | undefined, id: IdModulo): boolean {
  return !modulos || id === 'financeiro' || modulos.includes(id)
}
