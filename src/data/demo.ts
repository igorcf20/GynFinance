// Dados de demonstração: "Doces da Ana", MEI de comércio, vista em 15/10/2026.
// Ficam separados dos dados reais (regra 9 do DESIGN.md) e são gerados por código,
// para que todos os números das telas saiam dos mesmos lançamentos.
import { CATEGORIAS_PADRAO } from './categorias'
import { saldoCaixa } from '../domain/calc'
import { parametroDoAno } from '../domain/parametros'
import { gerarPrevistos } from '../domain/recorrencia'
import type { Atendimento, Dados, Lancamento, PagamentoDas, Recorrencia } from '../domain/types'

export const DEMO_HOJE = '2026-10-15'

const EMPRESA = 'doces-da-ana'
const BANCO = 'conta-pj'
const CAIXA = 'caixa'
const RESERVA = 'reserva'

// Entradas e saídas realizadas por mês (jan a set). Outubro é detalhado à parte.
const MESES: { mes: string; entrou: number; saiu: number }[] = [
  { mes: '2026-01', entrou: 4300, saiu: 3100 },
  { mes: '2026-02', entrou: 4400, saiu: 3150 },
  { mes: '2026-03', entrou: 4650, saiu: 3300 },
  { mes: '2026-04', entrou: 4780, saiu: 3350 },
  { mes: '2026-05', entrou: 5000, saiu: 3400 },
  { mes: '2026-06', entrou: 5200, saiu: 3550 },
  { mes: '2026-07', entrou: 5400, saiu: 3500 },
  { mes: '2026-08', entrou: 5300, saiu: 3520 },
  { mes: '2026-09', entrou: 5800, saiu: 3700 },
]

const CLIENTES = ['Balcão', 'Maria Souza', 'Padaria Central', 'Buffet Estrela', 'Encomenda de aniversário', 'Balcão']
const DIAS_VENDA = ['03', '07', '11', '16', '22', '27']
const FATIAS = [0.18, 0.15, 0.17, 0.2, 0.14, 0.16]

let seq = 0
const id = (p: string) => `${p}-${++seq}`
const r2 = (n: number) => Math.round(n * 100) / 100

// Os valores abaixo são escritos em reais para facilitar a leitura e convertidos para centavos no fim.
function realizado(p: Partial<Lancamento> & Pick<Lancamento, 'natureza' | 'valor' | 'dataCompetencia'>): Lancamento {
  return {
    id: id('l'),
    empresaId: EMPRESA,
    contaFinanceiraId: BANCO,
    situacao: 'realizado',
    dataPagamento: p.dataCompetencia,
    formaPagamento: 'pix',
    notaEmitida: p.natureza === 'entrada' ? 'sim' : 'nao_se_aplica',
    ...p,
  }
}

function previsto(p: Partial<Lancamento> & Pick<Lancamento, 'natureza' | 'valor' | 'dataCompetencia' | 'dataVencimento'>): Lancamento {
  return {
    id: id('l'),
    empresaId: EMPRESA,
    contaFinanceiraId: BANCO,
    situacao: 'previsto',
    formaPagamento: p.natureza === 'entrada' ? 'pix' : 'boleto',
    notaEmitida: p.natureza === 'entrada' ? 'nao' : 'nao_se_aplica',
    ...p,
  }
}

// Contas fixas. Aluguel e internet vêm de janeiro; a luz entrou em outubro e tem valor que varia.
// Valores do modelo em centavos (já no formato final).
const REC_ALUGUEL: Recorrencia = {
  id: 'rec-aluguel',
  empresaId: EMPRESA,
  modelo: { natureza: 'saida', valor: 120000, categoriaId: 'aluguel', contaFinanceiraId: BANCO, formaPagamento: 'boleto', descricao: 'Aluguel', contraparte: 'Imobiliária Lar' },
  frequencia: 'mensal',
  diaVencimento: 16,
  inicio: '2026-01-16',
  seFimDeSemana: 'antecipar',
  valorVaria: false,
  ativa: true,
  ultimaGeracao: '2026-09-16',
}
const REC_INTERNET: Recorrencia = {
  id: 'rec-internet',
  empresaId: EMPRESA,
  modelo: { natureza: 'saida', valor: 9990, categoriaId: 'internet', contaFinanceiraId: BANCO, formaPagamento: 'debito', descricao: 'Internet', contraparte: 'NetGoiás' },
  frequencia: 'mensal',
  diaVencimento: 12,
  inicio: '2026-01-12',
  seFimDeSemana: 'adiar',
  valorVaria: false,
  ativa: true,
  ultimaGeracao: '2026-09-12',
}
const REC_LUZ: Recorrencia = {
  id: 'rec-luz',
  empresaId: EMPRESA,
  modelo: { natureza: 'saida', valor: 18000, categoriaId: 'luz', contaFinanceiraId: BANCO, formaPagamento: 'boleto', descricao: 'Conta de luz', contraparte: 'Equatorial Goiás' },
  frequencia: 'mensal',
  diaVencimento: 20,
  inicio: '2026-10-20',
  seFimDeSemana: 'adiar',
  valorVaria: true,
  ativa: true,
}

function mesPadrao(mes: string, entrou: number, saiu: number, das: PagamentoDas[]): Lancamento[] {
  const ls: Lancamento[] = []
  let acumulado = 0
  FATIAS.forEach((f, i) => {
    const valor = i === FATIAS.length - 1 ? r2(entrou - acumulado) : Math.round(entrou * f)
    acumulado += valor
    ls.push(
      realizado({
        natureza: 'entrada',
        valor,
        categoriaId: 'vendas',
        dataCompetencia: `${mes}-${DIAS_VENDA[i]}`,
        descricao: i === 4 ? 'Bolo para festa' : 'Venda de doces',
        contraparte: CLIENTES[i],
        formaPagamento: i === 0 || i === 5 ? 'dinheiro' : 'pix',
        contaFinanceiraId: i === 0 || i === 5 ? CAIXA : BANCO,
        // Em setembro, duas vendas ficaram sem nota (aparece no fechamento).
        notaEmitida: mes === '2026-09' && (i === 0 || i === 5) ? 'nao' : 'sim',
      }),
    )
  })

  const p = parametroDoAno(Number(mes.slice(0, 4)))
  const valorDas = p.dasValorPorAtividade.comercio / 100
  const fixos = 1200 + 99.9 + valorDas
  const resto = r2(saiu - fixos)
  const mercadoria = mes === '2026-09' ? 1450 : Math.round(resto * 0.6)
  const embalagem = mes === '2026-09' ? 540 : Math.round(resto * 0.2)
  const maquininha = mes === '2026-09' ? 128.05 : r2(resto * 0.05)
  const transporte = r2(resto - mercadoria - embalagem - maquininha)

  ls.push(
    realizado({ natureza: 'saida', valor: mercadoria, categoriaId: 'mercadoria', dataCompetencia: `${mes}-02`, descricao: 'Ingredientes', contraparte: 'Atacadão' }),
    realizado({ ...REC_ALUGUEL.modelo, valor: 1200, dataCompetencia: `${mes}-16`, dataVencimento: `${mes}-16`, recorrenciaId: REC_ALUGUEL.id }),
    realizado({ ...REC_INTERNET.modelo, valor: 99.9, dataCompetencia: `${mes}-12`, dataVencimento: `${mes}-12`, recorrenciaId: REC_INTERNET.id }),
    realizado({ natureza: 'saida', valor: embalagem, categoriaId: 'embalagem', dataCompetencia: `${mes}-08`, descricao: 'Embalagens', contraparte: 'Embala Fácil' }),
    realizado({ natureza: 'saida', valor: maquininha, categoriaId: 'maquininha', dataCompetencia: `${mes}-28`, descricao: 'Taxas da maquininha', formaPagamento: 'debito' }),
    realizado({ natureza: 'saida', valor: transporte, categoriaId: 'transporte', dataCompetencia: `${mes}-18`, descricao: 'Entregas e combustível' }),
    realizado({ natureza: 'retirada', valor: 1500, categoriaId: 'prolabore', dataCompetencia: `${mes}-05`, descricao: 'Pró-labore' }),
  )
  const lancDas = realizado({ natureza: 'saida', valor: valorDas, categoriaId: 'das', dataCompetencia: `${mes}-19`, descricao: `DAS de ${mes.slice(5, 7)}/${mes.slice(0, 4)}`, formaPagamento: 'boleto' })
  ls.push(lancDas)
  das.push({ empresaId: EMPRESA, competencia: mes, valor: valorDas, vencimento: `${mes}-20`, lancamentoId: lancDas.id })
  return ls
}

function outubro(): Lancamento[] {
  const m = '2026-10'
  const venda = (dia: string, valor: number, contraparte: string, descricao = 'Venda de doces', extra: Partial<Lancamento> = {}) =>
    realizado({ natureza: 'entrada', valor, categoriaId: 'vendas', dataCompetencia: `${m}-${dia}`, descricao, contraparte, ...extra })
  const saida = (dia: string, valor: number, categoriaId: string, descricao: string, extra: Partial<Lancamento> = {}) =>
    realizado({ natureza: 'saida', valor, categoriaId, dataCompetencia: `${m}-${dia}`, descricao, ...extra })

  return [
    venda('01', 980, 'Balcão', 'Vendas do fim de semana', { formaPagamento: 'dinheiro', contaFinanceiraId: CAIXA }),
    venda('03', 1250, 'Buffet Estrela', 'Doces para evento'),
    venda('06', 720, 'Maria Souza'),
    venda('08', 1100, 'Padaria Central', 'Revenda de bolos', { formaPagamento: 'boleto' }),
    venda('10', 860, 'Balcão', 'Vendas da semana', { formaPagamento: 'dinheiro', contaFinanceiraId: CAIXA, notaEmitida: 'nao' }),
    venda('13', 1060, 'Encomenda de aniversário', 'Bolo para festa', { formaPagamento: 'credito' }),
    venda('15', 350, 'João Silva', 'Venda de bolos'),
    saida('02', 1300, 'mercadoria', 'Ingredientes', { contraparte: 'Atacadão' }),
    saida('09', 800, 'mercadoria', 'Chocolate e confeitos', { contraparte: 'Atacadão' }),
    saida('05', 230, 'embalagem', 'Caixas para bolo', { contraparte: 'Embala Fácil' }),
    saida('10', 380, 'embalagem', 'Embalagens', { contraparte: 'Embala Fácil' }),
    saida('14', 180, 'maquininha', 'Taxas da maquininha', { formaPagamento: 'debito' }),
    saida('07', 250, 'transporte', 'Entregas e combustível'),
    saida('11', 300, 'marketing', 'Anúncio no Instagram', { formaPagamento: 'credito' }),
    saida('12', 400, 'manutencao', 'Conserto da batedeira', { formaPagamento: 'dinheiro', contaFinanceiraId: CAIXA }),
    realizado({ natureza: 'retirada', valor: 1500, categoriaId: 'prolabore', dataCompetencia: `${m}-05`, descricao: 'Pró-labore' }),
    previsto({ natureza: 'saida', valor: 380, categoriaId: 'embalagem', dataCompetencia: `${m}-24`, dataVencimento: `${m}-24`, descricao: 'Fornecedor de embalagens', contraparte: 'Embala Fácil' }),
    previsto({ natureza: 'entrada', valor: 350, categoriaId: 'vendas', dataCompetencia: `${m}-02`, dataVencimento: `${m}-02`, descricao: 'Encomenda de doces', contraparte: 'João Silva' }),
    previsto({ natureza: 'entrada', valor: 900, categoriaId: 'vendas', dataCompetencia: `${m}-14`, dataVencimento: `${m}-28`, descricao: 'Doces para casamento', contraparte: 'Buffet Estrela' }),
  ]
}

/** Saldo de hoje que a demonstração deve mostrar. */
const SALDO_HOJE = 4150

export function dadosDemo(): Dados {
  seq = 0
  const pagamentosDas: PagamentoDas[] = []
  let lancamentos = [...MESES.flatMap((m) => mesPadrao(m.mes, m.entrou, m.saiu, pagamentosDas)), ...outubro()]
  pagamentosDas.push({ empresaId: EMPRESA, competencia: '2026-10', valor: parametroDoAno(2026).dasValorPorAtividade.comercio / 100, vencimento: '2026-10-20' })

  // Reais para centavos.
  const c = (v: number) => Math.round(v * 100)
  lancamentos = lancamentos.map((l) => ({ ...l, valor: c(l.valor) }))
  for (const p of pagamentosDas) p.valor = c(p.valor)

  const contas = [
    { id: BANCO, empresaId: EMPRESA, nome: 'Conta PJ', tipo: 'banco' as const, saldoInicial: 0, ativa: true },
    { id: CAIXA, empresaId: EMPRESA, nome: 'Caixa (dinheiro)', tipo: 'caixa' as const, saldoInicial: 0, ativa: true },
    { id: RESERVA, empresaId: EMPRESA, nome: 'Reserva', tipo: 'reserva' as const, saldoInicial: 0, ativa: true },
  ]
  // Saldo inicial de janeiro calculado para o saldo de hoje fechar em R$ 4.150.
  contas[0].saldoInicial = c(SALDO_HOJE) - saldoCaixa({ contas, lancamentos })

  const gerado = gerarPrevistos([REC_ALUGUEL, REC_INTERNET, REC_LUZ], lancamentos, DEMO_HOJE, () => id('l'))

  return {
    empresa: {
      id: EMPRESA,
      nomeDono: 'Ana',
      nomeFantasia: 'Doces da Ana',
      cnpj: '12.345.678/0001-90',
      ehMei: true,
      dataAbertura: '2024-03-01',
      atividade: 'comercio',
      uf: 'GO',
      municipio: 'Goiânia',
      prolaboreDesejado: 150000,
      modulosAtivos: ['financeiro'],
    },
    contas,
    categorias: CATEGORIAS_PADRAO,
    lancamentos: [...lancamentos, ...gerado.novos],
    recorrencias: gerado.recorrencias,
    pagamentosDas,
    atendimentos: atendimentosDemo(lancamentos),
    preferencias: { lembreteDias: 1, lembreteEmail: true, resumoMensal: true },
  }
}

/**
 * Agenda da Ana: retiradas, entregas e degustações. As que têm valor usam as contas a receber
 * que já existem, para os números do painel e do MEI continuarem os da imagem de referência.
 */
function atendimentosDemo(lancamentos: Lancamento[]): Atendimento[] {
  const conta = (contraparte: string) => lancamentos.find((l) => l.situacao === 'previsto' && l.natureza === 'entrada' && l.contraparte === contraparte)
  const marcar = (data: string, inicio: string, duracaoMin: number, cliente: string, servico: string, situacao: Atendimento['situacao'], extra: Partial<Atendimento> = {}): Atendimento => ({
    id: id('a'),
    empresaId: EMPRESA,
    cliente,
    servico,
    data,
    inicio,
    duracaoMin,
    situacao,
    ...extra,
  })
  const joao = conta('João Silva')
  const buffet = conta('Buffet Estrela')
  return [
    marcar('2026-10-02', '17:00', 30, 'João Silva', 'Encomenda de doces', 'concluido', { valor: joao?.valor, lancamentoId: joao?.id, telefone: '(62) 99654-7788' }),
    marcar('2026-10-13', '10:00', 60, 'Paula e Rui', 'Degustação de doces para casamento', 'concluido'),
    marcar('2026-10-14', '15:00', 45, 'Pedro Alves', 'Degustação de bolos', 'faltou'),
    marcar('2026-10-15', '09:00', 30, 'Maria Souza', 'Retirada: 100 brigadeiros (já pago)', 'confirmado', { telefone: '(62) 99876-1234' }),
    marcar('2026-10-15', '14:30', 60, 'Carla Mendes', 'Orçamento de bolo de 15 anos', 'agendado', { telefone: '(62) 98111-2233' }),
    marcar('2026-10-16', '16:00', 45, 'Padaria Central', 'Entrega de bolos para revenda', 'confirmado'),
    marcar('2026-10-17', '10:00', 90, 'Juliana Prado', 'Aula de brigadeiro gourmet', 'agendado'),
    marcar('2026-10-20', '11:00', 30, 'Lúcia Ramos', 'Orçamento de doces para batizado', 'agendado'),
    marcar('2026-10-22', '15:00', 60, 'Fernanda Lima', 'Degustação de bolo de casamento', 'agendado'),
    marcar('2026-10-28', '16:00', 60, 'Buffet Estrela', 'Entrega dos doces do casamento', 'confirmado', { valor: buffet?.valor, lancamentoId: buffet?.id }),
  ]
}
