// Estado do aplicativo. Nesta primeira versão os dados ficam no navegador (localStorage);
// as ações abaixo são o contrato que o back-end vai implementar depois. No servidor, toda
// consulta filtra pela empresa da sessão (nunca por um id vindo do navegador).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { vencimentoDas } from '../domain/calc'
import { parametroDoAno } from '../domain/parametros'
import { gerarPrevistos } from '../domain/recorrencia'
import type { Centavos, Dados, DataISO, Empresa, Lancamento, MesISO, Preferencias, Recorrencia, SeFimDeSemana } from '../domain/types'
import { hojeReal, mesDe, uid } from '../lib/format'
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
      restaurarDemo,
    }),
    [salvo, hoje, mes, salvarLancamento, excluirLancamento, marcarComoPago, marcarDasPago, separarReserva, recorrenciaDe, atualizarEmpresa, atualizarPreferencias, restaurarDemo],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}
