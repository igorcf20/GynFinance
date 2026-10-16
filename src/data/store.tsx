// Estado do aplicativo. Nesta primeira versão os dados ficam no navegador (localStorage);
// as ações abaixo são o contrato que o back-end vai implementar depois. No servidor, toda
// consulta filtra pela empresa da sessão (nunca por um id vindo do navegador).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { vencimentoDas } from '../domain/calc'
import { parametroDoAno } from '../domain/parametros'
import { gerarPrevistos } from '../domain/recorrencia'
import type { Atividade, Centavos, Dados, DataISO, Empresa, Lancamento, MesISO, Preferencias, Recorrencia, SeFimDeSemana } from '../domain/types'
import { hojeReal, mesDe, uid } from '../lib/format'
import { categoriasDoNegocio } from './categorias'
import { dadosDemo, DEMO_HOJE } from './demo'

// v2: valores em centavos e contas fixas como Recorrencia.
const CHAVE = 'gynfinance:v2'

interface Salvo {
  modo: 'demo' | 'real'
  dados: Dados
}

const hojeDo = (modo: Salvo['modo']) => (modo === 'demo' ? DEMO_HOJE : hojeReal())

/** Roda o gerador de contas fixas: cria os previstos que faltam até o fim do mês seguinte. */
function comPrevistos(d: Dados, hoje: DataISO): Dados {
  const { novos, recorrencias } = gerarPrevistos(d.recorrencias, d.lancamentos, hoje, uid)
  if (!novos.length && recorrencias.every((r, i) => r === d.recorrencias[i])) return d
  return { ...d, lancamentos: [...d.lancamentos, ...novos], recorrencias }
}

function carregar(): Salvo {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto) {
      const s = JSON.parse(bruto) as Salvo
      return { ...s, dados: comPrevistos(s.dados, hojeDo(s.modo)) }
    }
  } catch {
    /* sem armazenamento: segue com a demonstração */
  }
  return { modo: 'demo', dados: dadosDemo() }
}

export type NovoLancamento = Omit<Lancamento, 'id' | 'empresaId'>

/** Respostas da configuração inicial (tela 0 do planejamento). */
export interface ConfigInicial {
  nomeDono: string
  nomeFantasia: string
  cnpj?: string
  uf: string
  ehMei: boolean
  /** Mês de abertura da empresa (AAAA-MM). */
  mesAbertura: MesISO
  atividade: Atividade
  saldoBanco: Centavos
  saldoCaixa: Centavos
  prolaboreDesejado?: Centavos
  /** MEI: vendas deste ano antes de começar a usar o sistema. */
  faturadoAntes?: Centavos
  /** MEI: os DAS deste ano até o mês passado já estão pagos. */
  dasEmDia?: boolean
}

/** Monta os dados de um negócio novo, sem nenhum lançamento. */
export function dadosIniciais(c: ConfigInicial, hoje: DataISO): Dados {
  const empresaId = uid()
  const ano = Number(hoje.slice(0, 4))
  const abertura = `${c.mesAbertura}-01`
  const pagamentosDas = []
  if (c.ehMei && c.dasEmDia) {
    // Do mês de abertura (ou janeiro) até o mês passado: pagos antes do Gynfinance, sem gerar saída.
    let m = c.mesAbertura > `${ano}-01` ? c.mesAbertura : `${ano}-01`
    const atual = mesDe(hoje)
    while (m < atual) {
      const valor = parametroDoAno(ano).dasValorPorAtividade[c.atividade]
      pagamentosDas.push({ empresaId, competencia: m, valor, vencimento: vencimentoDas(m), pagoForaDoSistema: true })
      const [a, mm] = m.split('-').map(Number)
      m = mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, '0')}`
    }
  }
  return {
    empresa: {
      id: empresaId,
      nomeDono: c.nomeDono.trim(),
      nomeFantasia: c.nomeFantasia.trim(),
      cnpj: c.cnpj?.trim() || undefined,
      ehMei: c.ehMei,
      dataAbertura: abertura,
      atividade: c.atividade,
      uf: c.uf,
      prolaboreDesejado: c.prolaboreDesejado || undefined,
      faturadoAntes: c.ehMei && c.faturadoAntes ? { ano, valor: c.faturadoAntes } : undefined,
      modulosAtivos: ['financeiro'],
    },
    // Mesmos ids da demonstração: as telas escolhem a conta pela forma de pagamento.
    contas: [
      { id: 'conta-pj', empresaId, nome: 'Conta da empresa', tipo: 'banco', saldoInicial: c.saldoBanco, ativa: true },
      { id: 'caixa', empresaId, nome: 'Caixa (dinheiro)', tipo: 'caixa', saldoInicial: c.saldoCaixa, ativa: true },
      { id: 'reserva', empresaId, nome: 'Reserva', tipo: 'reserva', saldoInicial: 0, ativa: true },
    ],
    categorias: categoriasDoNegocio(c.atividade),
    lancamentos: [],
    recorrencias: [],
    pagamentosDas,
    preferencias: { lembreteDias: 1, lembreteEmail: true, resumoMensal: true },
    avisosDispensados: [],
  }
}

/** Opções de conta fixa ao salvar um lançamento previsto. */
export interface OpcoesRepetir {
  repetir: boolean
  seFimDeSemana: SeFimDeSemana
  valorVaria: boolean
}

interface Store {
  dados: Dados
  modo: 'demo' | 'real'
  hoje: DataISO
  /** Mês que o seletor do cabeçalho está mostrando. */
  mes: MesISO
  setMes: (m: MesISO) => void
  salvarLancamento: (l: NovoLancamento, id?: string, repetir?: OpcoesRepetir) => string
  excluirLancamento: (id: string) => void
  /** Baixa uma conta prevista; em conta de valor variável, recebe o valor real. */
  marcarComoPago: (id: string, valorReal?: Centavos) => void
  marcarDasPago: (competencia: MesISO) => void
  /** Separa para a reserva a sobra de um mês (competência); a transferência acontece hoje. */
  separarReserva: (valor: Centavos, mes: MesISO) => void
  recorrenciaDe: (l: Lancamento) => Recorrencia | undefined
  atualizarEmpresa: (e: Partial<Empresa>) => void
  atualizarPreferencias: (p: Partial<Preferencias>) => void
  dispensarAviso: (id: string) => void
  /** Sai da demonstração e começa com os dados do próprio negócio. */
  comecar: (c: ConfigInicial) => void
  restaurarDemo: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [salvo, setSalvo] = useState<Salvo>(carregar)
  const hoje = hojeDo(salvo.modo)
  const [mes, setMes] = useState<MesISO>(mesDe(hoje))

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(salvo))
    } catch {
      /* ignora: o app funciona sem persistir */
    }
  }, [salvo])

  // Toda mudança passa pelo gerador, para as contas fixas estarem sempre criadas.
  const mudar = useCallback((f: (d: Dados) => Dados) => setSalvo((s) => ({ ...s, dados: comPrevistos(f(s.dados), hojeDo(s.modo)) })), [])

  const salvarLancamento = useCallback(
    (l: NovoLancamento, id?: string, opcoes?: OpcoesRepetir) => {
      const novoId = id ?? uid()
      mudar((d) => {
        const empresaId = d.empresa.id
        const anterior = id ? d.lancamentos.find((x) => x.id === id) : undefined
        let recorrencias = d.recorrencias
        let lancamentos = d.lancamentos
        let recorrenciaId = anterior?.recorrenciaId

        if (l.situacao === 'previsto' && opcoes?.repetir && l.dataVencimento) {
          // Conta fixa: a competência de cada mês é a data de vencimento.
          l = { ...l, dataCompetencia: l.dataVencimento }
          const modelo = {
            natureza: l.natureza,
            valor: l.valor,
            categoriaId: l.categoriaId,
            contaFinanceiraId: l.contaFinanceiraId,
            formaPagamento: l.formaPagamento,
            descricao: l.descricao,
            contraparte: l.contraparte,
          }
          const dia = Number(l.dataCompetencia.slice(8, 10))
          if (recorrenciaId) {
            // Editar a conta fixa refaz só os previstos ainda não pagos (menos este).
            recorrencias = recorrencias.map((r) =>
              r.id === recorrenciaId ? { ...r, modelo, diaVencimento: dia, seFimDeSemana: opcoes.seFimDeSemana, valorVaria: opcoes.valorVaria, ultimaGeracao: l.dataCompetencia } : r,
            )
            lancamentos = lancamentos.filter((x) => !(x.recorrenciaId === recorrenciaId && x.situacao === 'previsto' && x.id !== id))
          } else {
            recorrenciaId = uid()
            recorrencias = [
              ...recorrencias,
              {
                id: recorrenciaId,
                empresaId,
                modelo,
                frequencia: 'mensal',
                diaVencimento: dia,
                inicio: l.dataCompetencia,
                seFimDeSemana: opcoes.seFimDeSemana,
                valorVaria: opcoes.valorVaria,
                ativa: true,
                ultimaGeracao: l.dataCompetencia,
              },
            ]
          }
        } else if (recorrenciaId && opcoes && !opcoes.repetir) {
          // Deixou de repetir: encerra a conta fixa e tira os próximos previstos.
          const fim = l.dataCompetencia
          recorrencias = recorrencias.map((r) => (r.id === recorrenciaId ? { ...r, ativa: false, fim } : r))
          lancamentos = lancamentos.filter((x) => !(x.recorrenciaId === recorrenciaId && x.situacao === 'previsto' && x.id !== id && x.dataCompetencia > fim))
        }

        const registro: Lancamento = { ...l, id: novoId, empresaId, recorrenciaId }
        lancamentos = id ? lancamentos.map((x) => (x.id === id ? registro : x)) : [...lancamentos, registro]

        // "Paguei com dinheiro pessoal": cria o aporte espelho para o caixa não ficar errado.
        lancamentos = lancamentos.filter((x) => x.espelhoDe !== novoId)
        if (l.pagoComDinheiroPessoal && l.natureza === 'saida' && l.situacao === 'realizado') {
          lancamentos.push({
            id: uid(),
            empresaId,
            natureza: 'aporte',
            valor: l.valor,
            contaFinanceiraId: l.contaFinanceiraId,
            situacao: 'realizado',
            dataCompetencia: l.dataCompetencia,
            dataPagamento: l.dataPagamento,
            formaPagamento: 'outro',
            descricao: `Aporte do dono: ${l.descricao || 'despesa paga com dinheiro pessoal'}`,
            notaEmitida: 'nao_se_aplica',
            espelhoDe: novoId,
          })
        }
        return { ...d, lancamentos, recorrencias }
      })
      return novoId
    },
    [mudar],
  )

  const excluirLancamento = useCallback(
    (id: string) =>
      mudar((d) => {
        const alvo = d.lancamentos.find((l) => l.id === id)
        // Excluir um previsto de conta fixa vira "cancelado", para o gerador não recriar o mês.
        if (alvo?.recorrenciaId && alvo.situacao === 'previsto') {
          return { ...d, lancamentos: d.lancamentos.map((l) => (l.id === id ? { ...l, situacao: 'cancelado' as const } : l)) }
        }
        return {
          ...d,
          lancamentos: d.lancamentos.filter((l) => l.id !== id && l.espelhoDe !== id),
          pagamentosDas: d.pagamentosDas.map((p) => (p.lancamentoId === id ? { ...p, lancamentoId: undefined } : p)),
        }
      }),
    [mudar],
  )

  const marcarComoPago = useCallback(
    (id: string, valorReal?: Centavos) =>
      mudar((d) => ({
        ...d,
        lancamentos: d.lancamentos.map((l) =>
          l.id === id ? { ...l, situacao: 'realizado' as const, dataPagamento: hoje, valor: valorReal && valorReal > 0 ? valorReal : l.valor } : l,
        ),
      })),
    [mudar, hoje],
  )

  const marcarDasPago = useCallback(
    (competencia: MesISO) =>
      mudar((d) => {
        const valor = parametroDoAno(Number(competencia.slice(0, 4))).dasValorPorAtividade[d.empresa.atividade]
        const lanc: Lancamento = {
          id: uid(),
          empresaId: d.empresa.id,
          natureza: 'saida',
          valor,
          categoriaId: 'das',
          contaFinanceiraId: d.contas.find((c) => c.tipo === 'banco')?.id ?? d.contas[0].id,
          situacao: 'realizado',
          dataCompetencia: hoje,
          dataPagamento: hoje,
          formaPagamento: 'boleto',
          descricao: `DAS de ${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`,
          notaEmitida: 'nao_se_aplica',
        }
        const existe = d.pagamentosDas.some((p) => p.competencia === competencia)
        const pagamentosDas = existe
          ? d.pagamentosDas.map((p) => (p.competencia === competencia ? { ...p, lancamentoId: lanc.id } : p))
          : [...d.pagamentosDas, { empresaId: d.empresa.id, competencia, valor, vencimento: vencimentoDas(competencia), lancamentoId: lanc.id }]
        return { ...d, lancamentos: [...d.lancamentos, lanc], pagamentosDas }
      }),
    [mudar, hoje],
  )

  const separarReserva = useCallback(
    (valor: Centavos, mesRef: MesISO) =>
      mudar((d) => {
        const competencia = mesRef === mesDe(hoje) ? hoje : `${mesRef}-28`
        const origem = d.contas.find((c) => c.tipo === 'banco') ?? d.contas[0]
        const destino = d.contas.find((c) => c.tipo === 'reserva')
        if (!destino) return d
        const t: Lancamento = {
          id: uid(),
          empresaId: d.empresa.id,
          natureza: 'transferencia',
          valor,
          contaFinanceiraId: origem.id,
          contaDestinoId: destino.id,
          situacao: 'realizado',
          dataCompetencia: competencia,
          dataPagamento: hoje,
          formaPagamento: 'pix',
          descricao: 'Separado para a reserva',
          notaEmitida: 'nao_se_aplica',
        }
        return { ...d, lancamentos: [...d.lancamentos, t] }
      }),
    [mudar, hoje],
  )

  const recorrenciaDe = useCallback((l: Lancamento) => (l.recorrenciaId ? salvo.dados.recorrencias.find((r) => r.id === l.recorrenciaId) : undefined), [salvo.dados.recorrencias])

  const atualizarEmpresa = useCallback((e: Partial<Empresa>) => mudar((d) => ({ ...d, empresa: { ...d.empresa, ...e } })), [mudar])
  const atualizarPreferencias = useCallback(
    (p: Partial<Preferencias>) => mudar((d) => ({ ...d, preferencias: { ...d.preferencias, ...p } })),
    [mudar],
  )
  const dispensarAviso = useCallback(
    (id: string) => mudar((d) => ({ ...d, avisosDispensados: [...(d.avisosDispensados ?? []), id] })),
    [mudar],
  )
  const comecar = useCallback((c: ConfigInicial) => {
    const hojeReal_ = hojeReal()
    setSalvo({ modo: 'real', dados: dadosIniciais(c, hojeReal_) })
    setMes(mesDe(hojeReal_))
  }, [])
  const restaurarDemo = useCallback(() => {
    setSalvo({ modo: 'demo', dados: dadosDemo() })
    setMes(mesDe(DEMO_HOJE))
  }, [])

  const valor = useMemo<Store>(
    () => ({
      dados: salvo.dados,
      modo: salvo.modo,
      hoje,
      mes,
      setMes,
      salvarLancamento,
      excluirLancamento,
      marcarComoPago,
      marcarDasPago,
      separarReserva,
      recorrenciaDe,
      atualizarEmpresa,
      atualizarPreferencias,
      dispensarAviso,
      comecar,
      restaurarDemo,
    }),
    [salvo, hoje, mes, salvarLancamento, excluirLancamento, marcarComoPago, marcarDasPago, separarReserva, recorrenciaDe, atualizarEmpresa, atualizarPreferencias, dispensarAviso, comecar, restaurarDemo],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}
