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
  /** Vendas do ano feitas antes de usar o Gynfinance, informadas na configuração inicial (limite do MEI). */
  faturadoAntes?: { ano: number; valor: Centavos }
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
  /** Comprovante do pagamento (foto ou PDF). */
  comprovante?: Comprovante
  /** Observação do pagamento (ex.: "pago com juros", "combinado com o fornecedor"). */
  observacao?: string
  /** Parte que ficou para depois num pagamento parcial ou parcelado: aponta a conta de origem. */
  parcelaDe?: string
  /** Parcela "2 de 3" de um pagamento parcelado. */
  parcela?: { numero: number; total: number }
  /** Veio de um extrato importado: o código da transação no banco, para não importar duas vezes. */
  refExtrato?: string
}

/** Arquivo anexado a um pagamento. No servidor, o conteúdo fica guardado à parte (só o id vem aqui). */
export interface Comprovante {
  id: string
  nome: string
  /** Tipo do arquivo: image/jpeg, image/png, application/pdf... */
  tipo: string
  /** Tamanho em bytes. */
  tamanho: number
  /** Conteúdo como data URL, só quando não há servidor (demonstração ou uso no navegador). */
  dados?: string
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
  /** Pago antes de usar o Gynfinance (informado na configuração inicial); não gera saída. */
  pagoForaDoSistema?: boolean
}

export interface Preferencias {
  lembreteDias: 0 | 1 | 3
  lembreteEmail: boolean
  resumoMensal: boolean
}

export type SituacaoAtendimento = 'agendado' | 'confirmado' | 'concluido' | 'faltou' | 'cancelado'

/** Horário marcado com um cliente (agenda). Com valor, vira também uma conta a receber. */
export interface Atendimento {
  id: string
  empresaId: string
  cliente: string
  telefone?: string
  /** O que vai ser feito: corte, consulta, entrega da encomenda... */
  servico?: string
  data: DataISO
  /** Hora de início, HH:MM. */
  inicio: string
  duracaoMin: number
  valor?: Centavos
  situacao: SituacaoAtendimento
  observacao?: string
  /** Conta a receber criada junto com o atendimento. */
  lancamentoId?: string
}

export interface Dados {
  empresa: Empresa
  contas: ContaFinanceira[]
  categorias: Categoria[]
  lancamentos: Lancamento[]
  recorrencias: Recorrencia[]
  pagamentosDas: PagamentoDas[]
  atendimentos: Atendimento[]
  preferencias: Preferencias
  /** Avisos que o usuário dispensou (o id do aviso já traz o mês ou a conta). */
  avisosDispensados?: string[]
}
