// Modelo de dados do módulo inicial (ver doc "Gynfinance: módulo inicial (telas e dados)").
// Tudo gira em torno de Lancamento: uma conta a pagar é só um lançamento com situação "previsto".

/** Data no formato ISO curto, AAAA-MM-DD. */
export type DataISO = string
/** Mês no formato AAAA-MM. */
export type MesISO = string

export type Atividade = 'servico' | 'comercio' | 'industria' | 'misto'

export interface Empresa {
  id: string
  nomeDono: string
  nomeFantasia: string
  cnpj?: string
  ehMei: boolean
  dataAbertura: DataISO
  atividade: Atividade
  uf: string
  municipio?: string
  prolaboreDesejado?: number
  modulosAtivos: string[]
}

export type TipoConta = 'caixa' | 'banco' | 'reserva'

export interface ContaFinanceira {
  id: string
  nome: string
  tipo: TipoConta
  saldoInicial: number
  ativa: boolean
}

export type GrupoCategoria = 'receita' | 'custo' | 'despesa_fixa' | 'despesa_variavel' | 'imposto' | 'retirada'

export interface Categoria {
  id: string
  nome: string
  grupo: GrupoCategoria
  /** Entra no faturamento do MEI (vendas e serviços). */
  contaNoFaturamento: boolean
  ativa: boolean
}

export type Natureza = 'entrada' | 'saida' | 'retirada' | 'aporte' | 'transferencia'
export type Situacao = 'realizado' | 'previsto' | 'cancelado'
export type FormaPagamento = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'boleto' | 'outro'
export type NotaEmitida = 'sim' | 'nao' | 'nao_se_aplica'

export interface Lancamento {
  id: string
  natureza: Natureza
  /** Sempre positivo; a natureza dá o sinal. */
  valor: number
  categoriaId?: string
  contaFinanceiraId: string
  /** Só em transferência. */
  contaDestinoId?: string
  situacao: Situacao
  /** Quando a venda ou o gasto aconteceu. */
  dataCompetencia: DataISO
  /** Só em previsto. */
  dataVencimento?: DataISO
  /** Preenchida ao marcar pago/recebido. */
  dataPagamento?: DataISO
  formaPagamento: FormaPagamento
  descricao?: string
  contraparte?: string
  notaEmitida: NotaEmitida
  recorrente?: boolean
  pagoComDinheiroPessoal?: boolean
  /** Liga a despesa ao aporte espelho criado por "paguei com dinheiro pessoal". */
  espelhoDe?: string
}

/** Tabela do sistema, por ano: muda por lei e salário mínimo. */
export interface ParametroMei {
  ano: number
  limiteAnual: number
  limiteMensalProporcional: number
  salarioMinimo: number
  dasValorPorAtividade: Record<Atividade, number>
  dasDiaVencimento: number
}

export interface PagamentoDas {
  competencia: MesISO
  valor: number
  vencimento: DataISO
  lancamentoId?: string
}

export interface Preferencias {
  lembreteDias: 0 | 1 | 3
  lembreteEmail: boolean
  resumoMensal: boolean
}

export interface Dados {
  empresa: Empresa
  contas: ContaFinanceira[]
  categorias: Categoria[]
  lancamentos: Lancamento[]
  pagamentosDas: PagamentoDas[]
  preferencias: Preferencias
}
