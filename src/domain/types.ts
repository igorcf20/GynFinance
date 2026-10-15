// Modelo de dados do módulo inicial (ver doc "Gynfinance: módulo inicial (telas e dados)").
// Tudo gira em torno de Lancamento: uma conta a pagar é só um lançamento com situação "previsto".

/** Data no formato ISO curto, AAAA-MM-DD. */
export type DataISO = string
/** Mês no formato AAAA-MM. */
export type MesISO = string
/** Dinheiro sempre em centavos inteiros (R$ 12,34 = 1234); só a tela formata. */
export type Centavos = number

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
  prolaboreDesejado?: Centavos
  modulosAtivos: string[]
}

export type TipoConta = 'caixa' | 'banco' | 'reserva'

export interface ContaFinanceira {
  id: string
  empresaId: string
  nome: string
  tipo: TipoConta
  saldoInicial: Centavos
  ativa: boolean
}

export type GrupoCategoria = 'receita' | 'custo' | 'despesa_fixa' | 'despesa_variavel' | 'imposto' | 'retirada'

export interface Categoria {
  id: string
  /** Vazio = categoria padrão do sistema. */
  empresaId?: string
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
  empresaId: string
  natureza: Natureza
  /** Sempre positivo; a natureza dá o sinal. */
  valor: Centavos
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
  /** Quando nasceu de uma conta fixa. */
  recorrenciaId?: string
  pagoComDinheiroPessoal?: boolean
  /** Liga a despesa ao aporte espelho criado por "paguei com dinheiro pessoal". */
  espelhoDe?: string
}

export type SeFimDeSemana = 'manter' | 'antecipar' | 'adiar'

/** Conta fixa: a regra fica aqui; cada mês vira um Lancamento previsto. */
export interface Recorrencia {
  id: string
  empresaId: string
  /** Cópia dos campos do lançamento que se repetem. */
  modelo: Pick<Lancamento, 'natureza' | 'valor' | 'categoriaId' | 'contaFinanceiraId' | 'formaPagamento' | 'descricao' | 'contraparte'>
  frequencia: 'mensal'
  diaVencimento: number
  inicio: DataISO
  fim?: DataISO
  seFimDeSemana: SeFimDeSemana
  /** O valor do modelo é aproximado (luz, água, maquininha). */
  valorVaria: boolean
  ativa: boolean
  /** Último vencimento já gerado (controle do gerador). */
  ultimaGeracao?: DataISO
}

/** Tabela do sistema, por ano: muda por lei e salário mínimo. */
export interface ParametroMei {
  ano: number
  limiteAnual: Centavos
  limiteMensalProporcional: Centavos
  salarioMinimo: Centavos
  dasValorPorAtividade: Record<Atividade, Centavos>
  dasDiaVencimento: number
}

export interface PagamentoDas {
  empresaId: string
  competencia: MesISO
  valor: Centavos
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
  recorrencias: Recorrencia[]
  pagamentosDas: PagamentoDas[]
  preferencias: Preferencias
}
