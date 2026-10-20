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
  /** Código do link de convite de contador (deixa cadastrar mesmo com cadastros fechados). */
  convite: z.string().trim().max(200).optional(),
  /** Código do link "Indique e ganhe" de quem indicou. */
  indicacao: z.string().trim().max(40).optional(),
})
export const esqueci = z.object({ email: z.string().trim().max(200) })
export const redefinir = z.object({
  codigo: z.string().min(20).max(200),
  senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.').max(200),
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
  chavePix: texto(140).optional(),
  metaFaturamento: centavos.optional(),
  limitesCategoria: z.record(texto(60), centavos).optional().refine((x) => !x || Object.keys(x).length <= 100, 'Tetos demais.'),
  mensagemCobranca: texto(1000).optional(),
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
  // O conteúdo do comprovante vai antes, por /api/comprovantes; aqui só a referência.
  comprovante: z.object({ id, nome: texto(200), tipo: texto(60), tamanho: z.number().int().positive() }).optional(),
  observacao: texto(300).optional(),
  parcelaDe: id.optional(),
  parcela: z.object({ numero: z.number().int().min(1).max(60), total: z.number().int().min(2).max(60) }).optional(),
  refExtrato: texto(200).optional(),
  lembreteDias: z.union([z.literal(-1), z.literal(0), z.literal(1), z.literal(3)]).optional(),
  parceiroId: id.optional(),
  numeroFatura: texto(60).optional(),
  numeroProforma: texto(60).optional(),
  numeroOrcamento: texto(60).optional(),
})

export const atendimento = z.object({
  id,
  cliente: texto(120).min(1),
  telefone: texto(40).optional(),
  servico: texto(200).optional(),
  data,
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duracaoMin: z.number().int().min(5).max(1440),
  valor: positivo.optional(),
  situacao: z.enum(['agendado', 'confirmado', 'concluido', 'faltou', 'cancelado']),
  observacao: texto(300).optional(),
  lancamentoId: id.optional(),
  parceiroId: id.optional(),
})

export const parceiro = z.object({
  id,
  tipo: z.enum(['cliente', 'fornecedor', 'ambos']),
  nome: texto(120).min(1),
  documento: texto(30).optional(),
  telefone: texto(40).optional(),
  email: texto(200).optional(),
  endereco: texto(300).optional(),
  observacao: texto(500).optional(),
  contatos: z.array(z.object({ id: texto(60).min(1), nome: texto(120).min(1), cargo: texto(80).optional(), telefone: texto(40).optional(), email: texto(200).optional() })).max(30).optional(),
  anotacoes: z.array(z.object({ id: texto(60).min(1), data, texto: texto(2000).min(1) })).max(500).optional(),
  tarefas: z.array(z.object({ id: texto(60).min(1), texto: texto(300).min(1), prazo: data.optional(), feita: z.boolean() })).max(300).optional(),
  ativo: z.boolean(),
  criadoEm: data,
})

export const TIPOS_COMPROVANTE = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
export const novoComprovante = z.object({
  id,
  nome: texto(200),
  tipo: z.enum(TIPOS_COMPROVANTE),
  /** Conteúdo em base64 (até 5 MB depois de decodificado). */
  dados: z.string().min(4).max(7_000_000),
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
    lembreteDias: z.union([z.literal(-1), z.literal(0), z.literal(1), z.literal(3)]).optional(),
    parceiroId: id.optional(),
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

export const categoria = z.object({
  id: texto(60).min(1),
  /** Ausente nas categorias padrão (aí só vale ligar e desligar). Qualquer valor marca uma categoria própria. */
  empresaId: z.string().optional(),
  nome: texto(60).min(1, 'Dê um nome à categoria.'),
  grupo: z.enum(['receita', 'custo', 'despesa_fixa', 'despesa_variavel', 'imposto', 'retirada']),
  contaNoFaturamento: z.boolean(),
  ativa: z.boolean(),
})

const itemLixeira = z.object({ id, excluidoEm: data, lancamentos: z.array(lancamento).min(1).max(5) })

export const mudancas = z.object({
  empresa: empresa.optional(),
  preferencias: preferencias.optional(),
  lancamentos: z.object({ salvar: z.array(lancamento).max(2000), excluir: z.array(id).max(2000) }).optional(),
  recorrencias: z.object({ salvar: z.array(recorrencia).max(500) }).optional(),
  pagamentosDas: z.object({ salvar: z.array(pagamentoDas).max(200) }).optional(),
  atendimentos: z.object({ salvar: z.array(atendimento).max(2000), excluir: z.array(id).max(2000) }).optional(),
  parceiros: z.object({ salvar: z.array(parceiro).max(2000), excluir: z.array(id).max(2000) }).optional(),
  avisosDispensados: z.array(texto(300)).max(200).optional(),
  categorias: z.object({ salvar: z.array(categoria).max(200) }).optional(),
  lixeira: z.object({ salvar: z.array(itemLixeira).max(500), excluir: z.array(id).max(500) }).optional(),
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
