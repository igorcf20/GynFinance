// Estado do aplicativo. Nesta primeira versão os dados ficam no navegador (localStorage);
// as ações abaixo são o contrato que o back-end vai implementar depois.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { vencimentoDas } from '../domain/calc'
import { parametroDoAno } from '../domain/parametros'
import type { Dados, DataISO, Empresa, Lancamento, MesISO, Preferencias } from '../domain/types'
import { hojeReal, mesDe, uid } from '../lib/format'
import { dadosDemo, DEMO_HOJE } from './demo'

const CHAVE = 'gynfinance:v1'

interface Salvo {
  modo: 'demo' | 'real'
  dados: Dados
}

function carregar(): Salvo {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto) return JSON.parse(bruto) as Salvo
  } catch {
    /* sem armazenamento: segue com a demonstração */
  }
  return { modo: 'demo', dados: dadosDemo() }
}

export type NovoLancamento = Omit<Lancamento, 'id'>

interface Store {
  dados: Dados
  modo: 'demo' | 'real'
  hoje: DataISO
  /** Mês que o seletor do cabeçalho está mostrando. */
  mes: MesISO
  setMes: (m: MesISO) => void
  salvarLancamento: (l: NovoLancamento, id?: string) => string
  excluirLancamento: (id: string) => void
  marcarComoPago: (id: string) => void
  marcarDasPago: (competencia: MesISO) => void
  /** Separa para a reserva a sobra de um mês (competência); a transferência acontece hoje. */
  separarReserva: (valor: number, mes: MesISO) => void
  atualizarEmpresa: (e: Partial<Empresa>) => void
  atualizarPreferencias: (p: Partial<Preferencias>) => void
  restaurarDemo: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [salvo, setSalvo] = useState<Salvo>(carregar)
  const hoje = salvo.modo === 'demo' ? DEMO_HOJE : hojeReal()
  const [mes, setMes] = useState<MesISO>(mesDe(hoje))

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(salvo))
    } catch {
      /* ignora: o app funciona sem persistir */
    }
  }, [salvo])

  const mudar = useCallback((f: (d: Dados) => Dados) => setSalvo((s) => ({ ...s, dados: f(s.dados) })), [])

  const salvarLancamento = useCallback(
    (l: NovoLancamento, id?: string) => {
      const novoId = id ?? uid()
      mudar((d) => {
        let lancamentos = id ? d.lancamentos.map((x) => (x.id === id ? { ...l, id } : x)) : [...d.lancamentos, { ...l, id: novoId }]
        // "Paguei com dinheiro pessoal": cria o aporte espelho para o caixa não ficar errado.
        lancamentos = lancamentos.filter((x) => x.espelhoDe !== novoId)
        if (l.pagoComDinheiroPessoal && l.natureza === 'saida' && l.situacao === 'realizado') {
          lancamentos.push({
            id: uid(),
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
        return { ...d, lancamentos }
      })
      return novoId
    },
    [mudar],
  )

  const excluirLancamento = useCallback(
    (id: string) =>
      mudar((d) => ({
        ...d,
        lancamentos: d.lancamentos.filter((l) => l.id !== id && l.espelhoDe !== id),
        pagamentosDas: d.pagamentosDas.map((p) => (p.lancamentoId === id ? { ...p, lancamentoId: undefined } : p)),
      })),
    [mudar],
  )

  const marcarComoPago = useCallback(
    (id: string) =>
      mudar((d) => {
        const conta = d.lancamentos.find((l) => l.id === id)
        if (!conta) return d
        const lancamentos = d.lancamentos.map((l) => (l.id === id ? { ...l, situacao: 'realizado' as const, dataPagamento: hoje } : l))
        // Conta fixa: já deixa a do mês seguinte prevista.
        if (conta.recorrente && conta.dataVencimento) {
          const [a, m, dia] = conta.dataVencimento.split('-').map(Number)
          const prox = new Date(a, m, Math.min(dia, 28))
          const venc = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, '0')}-${String(prox.getDate()).padStart(2, '0')}`
          lancamentos.push({ ...conta, id: uid(), situacao: 'previsto', dataCompetencia: venc, dataVencimento: venc, dataPagamento: undefined })
        }
        return { ...d, lancamentos }
      }),
    [mudar, hoje],
  )

  const marcarDasPago = useCallback(
    (competencia: MesISO) =>
      mudar((d) => {
        const valor = parametroDoAno(Number(competencia.slice(0, 4))).dasValorPorAtividade[d.empresa.atividade]
        const lanc: Lancamento = {
          id: uid(),
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
          : [...d.pagamentosDas, { competencia, valor, vencimento: vencimentoDas(competencia), lancamentoId: lanc.id }]
        return { ...d, lancamentos: [...d.lancamentos, lanc], pagamentosDas }
      }),
    [mudar, hoje],
  )

  const separarReserva = useCallback(
    (valor: number, mesRef: MesISO) =>
      mudar((d) => {
        const competencia = mesRef === mesDe(hoje) ? hoje : `${mesRef}-28`
        const origem = d.contas.find((c) => c.tipo === 'banco') ?? d.contas[0]
        const destino = d.contas.find((c) => c.tipo === 'reserva')
        if (!destino) return d
        const t: Lancamento = {
          id: uid(),
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
      atualizarEmpresa,
      atualizarPreferencias,
      restaurarDemo,
    }),
    [salvo, hoje, mes, salvarLancamento, excluirLancamento, marcarComoPago, marcarDasPago, separarReserva, atualizarEmpresa, atualizarPreferencias, restaurarDemo],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}
