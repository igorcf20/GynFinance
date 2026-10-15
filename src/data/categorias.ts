import type { Categoria } from '../domain/types'

const c = (id: string, nome: string, grupo: Categoria['grupo'], contaNoFaturamento = false): Categoria => ({
  id,
  nome,
  grupo,
  contaNoFaturamento,
  ativa: true,
})

export const CATEGORIAS_PADRAO: Categoria[] = [
  c('vendas', 'Vendas', 'receita', true),
  c('servicos', 'Serviços prestados', 'receita', true),
  c('outras-entradas', 'Outras entradas', 'receita'),
  c('mercadoria', 'Mercadoria e matéria-prima', 'custo'),
  c('aluguel', 'Aluguel', 'despesa_fixa'),
  c('internet', 'Internet e telefone', 'despesa_fixa'),
  c('contador', 'Contador', 'despesa_fixa'),
  c('sistema', 'Sistema e apps', 'despesa_fixa'),
  c('transporte', 'Transporte', 'despesa_variavel'),
  c('embalagem', 'Embalagem', 'despesa_variavel'),
  c('maquininha', 'Taxa de maquininha', 'despesa_variavel'),
  c('marketing', 'Marketing', 'despesa_variavel'),
  c('manutencao', 'Manutenção', 'despesa_variavel'),
  c('das', 'DAS e impostos', 'imposto'),
  c('prolabore', 'Pró-labore', 'retirada'),
]

export const NOMES_GRUPO: Record<Categoria['grupo'], string> = {
  receita: 'Receita',
  custo: 'Custo',
  despesa_fixa: 'Despesa fixa',
  despesa_variavel: 'Despesa variável',
  imposto: 'Imposto',
  retirada: 'Retirada',
}
