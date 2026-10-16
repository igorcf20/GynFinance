// Validação de tudo que chega do navegador. Nada de empresa_id vindo de fora: o servidor
// usa sempre a empresa da sessão.
import { z } from 'zod'

const id = z.uuid()
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const mes = z.string().regex(/^\d{4}-\d{2}$/)
const centavos = z.number().int().nonnegative().max(1e13)
const positivo = z.number().int().positive().max(1e13)
const texto = (max = 200) => z.string().trim().max(max)

export const atividade = z.enum(['servico', 'comercio', 'industria', 'misto'])
const natureza = z.enum(['entrada', 'saida', 'retirada', 'aporte', 'transferencia'])
const forma = z.enum(['pix', 'dinheiro', 'debito', 'credito', 'boleto', 'outro'])

export const criarConta = z.object({
  nome: texto(80).min(1),
  email: z.email().max(200),
  senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.').max(200),
  aceiteTermos: z.literal(true),
})
export const entrar = z.object({ email: z.string().trim().max(200), senha: z.string().max(200) })

export const empresa = z.object({
  nomeDono: texto(80).min(1),
  nomeFantasia: texto(120).min(1),
  cnpj: texto(20).optional(),
  ehMei: z.boolean(),
  dataAbertura: data,
  atividade,
  uf: z.string().length(2),
  municipio: texto(80).optional(),
  prolaboreDesejado: centavos.optional(),
  faturadoAntes: z.object({ ano: z.number().int(), valor: centavos }).optional(),
  modulosAtivos: z.array(texto(40)).max(20),
})

export const preferencias = z.object({
  lembreteDias: z.union([z.literal(0), z.literal(1), z.literal(3)]),
  lembreteEmail: z.boolean(),
  resumoMensal: z.boolean(),
})

export const lancamento = z.object({
  id,
  natureza,
  valor: positivo,
  categoriaId: texto(60).optional(),
  contaFinanceiraId: id,
  contaDestinoId: id.optional(),
  situacao: z.enum(['realizado', 'previsto', 'cancelado']),
  dataCompetencia: data,
  dataVencimento: data.optional(),
  dataPagamento: data.optional(),
  formaPagamento: forma,
  descricao: texto(200).optional(),
  contraparte: texto(120).optional(),
  notaEmitida: z.enum(['sim', 'nao', 'nao_se_aplica']),
  recorrenciaId: id.optional(),
  pagoComDinheiroPessoal: z.boolean().optional(),
  espelhoDe: id.optional(),
})

export const recorrencia = z.object({
  id,
  modelo: z.object({
    natureza,
    valor: positivo,
    categoriaId: texto(60).optional(),
    contaFinanceiraId: id,
    formaPagamento: forma,
    descricao: texto(200).optional(),
    contraparte: texto(120).optional(),
  }),
  frequencia: z.literal('mensal'),
  diaVencimento: z.number().int().min(1).max(31),
  inicio: data,
  fim: data.optional(),
  seFimDeSemana: z.enum(['manter', 'antecipar', 'adiar']),
  valorVaria: z.boolean(),
  ativa: z.boolean(),
  ultimaGeracao: data.optional(),
})

export const pagamentoDas = z.object({
  competencia: mes,
  valor: centavos,
  vencimento: data,
  lancamentoId: id.optional(),
  pagoForaDoSistema: z.boolean().optional(),
})

export const mudancas = z.object({
  empresa: empresa.optional(),
  preferencias: preferencias.optional(),
  lancamentos: z.object({ salvar: z.array(lancamento).max(2000), excluir: z.array(id).max(2000) }).optional(),
  recorrencias: z.object({ salvar: z.array(recorrencia).max(500) }).optional(),
  pagamentosDas: z.object({ salvar: z.array(pagamentoDas).max(200) }).optional(),
  avisosDispensados: z.array(texto(300)).max(200).optional(),
})

const conta = z.object({ id, nome: texto(60).min(1), tipo: z.enum(['caixa', 'banco', 'reserva']), saldoInicial: z.number().int().min(-1e13).max(1e13), ativa: z.boolean() })

/** Dados de um negócio novo, vindos da configuração inicial. */
export const novoNegocio = z.object({
  empresa: empresa.extend({ id }),
  contas: z.array(conta).min(1).max(20),
  categoriasDesativadas: z.array(texto(60)).max(100),
  pagamentosDas: z.array(pagamentoDas).max(200),
  preferencias,
})
