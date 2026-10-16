// Estado do aplicativo. Nesta primeira versão os dados ficam no navegador (localStorage);
// as ações abaixo são o contrato que o back-end vai implementar depois. No servidor, toda
// consulta filtra pela empresa da sessão (nunca por um id vindo do navegador).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { vencimentoDas } from '../domain/calc'
import { parametroDoAno } from '../domain/parametros'
import { aplicarPagamento, reverterDados, type DetalhesPagamento } from '../domain/pagamento'
import { gerarPrevistos } from '../domain/recorrencia'
import type { Atividade, Centavos, Comprovante, Dados, DataISO, Empresa, Lancamento, MesISO, Preferencias, Recorrencia, SeFimDeSemana } from '../domain/types'
import { hojeReal, mesDe, uid } from '../lib/format'
import { api, ErroApi, verificarServidor, type Conta } from './api'
import { categoriasDoNegocio } from './categorias'
import { lerComprovante } from './comprovante'
import { dadosDemo, DEMO_HOJE } from './demo'
import { diferencas, juntar, paraNovoNegocio, type Mudancas } from './sincronizar'

// v2: valores em centavos e contas fixas como Recorrencia.
const CHAVE = 'gynfinance:v2'

interface Salvo {
  modo: 'demo' | 'real'
  dados: Dados
  /** Dados do negócio vindos do servidor: cada mudança é enviada para lá, não fica no navegador. */
  noServidor?: boolean
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
      // A demonstração nunca fica gravada: cada visita começa com os dados de exemplo.
      if (s.modo !== 'demo') return { modo: s.modo, dados: comPrevistos(s.dados, hojeDo(s.modo)) }
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
    // As telas escolhem a conta pelo tipo (dinheiro vai para o caixa; Pix, cartão e boleto para o banco).
    contas: [
      { id: uid(), empresaId, nome: 'Conta da empresa', tipo: 'banco', saldoInicial: c.saldoBanco, ativa: true },
      { id: uid(), empresaId, nome: 'Caixa (dinheiro)', tipo: 'caixa', saldoInicial: c.saldoCaixa, ativa: true },
      { id: uid(), empresaId, nome: 'Reserva', tipo: 'reserva', saldoInicial: 0, ativa: true },
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
  /** Baixa uma conta prevista com os dados de hoje. Devolve a função que desfaz. */
  marcarComoPago: (id: string, valorReal?: Centavos) => Desfazer
  /** Baixa com detalhes: valor, data, conta, forma, comprovante, parcial ou parcelado. */
  registrarPagamento: (id: string, detalhes: DetalhesPagamento) => Desfazer
  /** Lê (e, com servidor, envia) a foto ou PDF de um comprovante. */
  anexarComprovante: (arquivo: File) => Promise<Comprovante>
  marcarDasPago: (competencia: MesISO) => Desfazer
  /** Separa para a reserva a sobra de um mês (competência); a transferência acontece hoje. */
  separarReserva: (valor: Centavos, mes: MesISO) => Desfazer
  recorrenciaDe: (l: Lancamento) => Recorrencia | undefined
  atualizarEmpresa: (e: Partial<Empresa>) => void
  atualizarPreferencias: (p: Partial<Preferencias>) => void
  dispensarAviso: (id: string) => void
  /** Sai da demonstração e começa com os dados do próprio negócio (no servidor, quando há um). */
  comecar: (c: ConfigInicial) => Promise<void>
  restaurarDemo: () => void
  /** Há servidor (versão instalada) ou só o navegador (demonstração publicada)? */
  servidor: 'verificando' | 'sem' | 'com'
  conta: Conta | null
  /** Situação do envio das mudanças ao servidor. */
  salvamento: 'ok' | 'salvando' | 'erro'
  entrar: (email: string, senha: string) => Promise<Conta>
  criarConta: (nome: string, email: string, senha: string) => Promise<Conta>
  sair: () => Promise<void>
}

export type Desfazer = () => void

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [salvo, setSalvo] = useState<Salvo>(carregar)
  const hoje = hojeDo(salvo.modo)
  const [mes, setMes] = useState<MesISO>(mesDe(hoje))
  const [servidor, setServidor] = useState<Store['servidor']>('verificando')
  const [conta, setConta] = useState<Conta | null>(null)
  const [salvamento, setSalvamento] = useState<Store['salvamento']>('ok')
  const salvoRef = useRef(salvo)
  salvoRef.current = salvo

  useEffect(() => {
    if (salvo.noServidor) return
    try {
      if (salvo.modo === 'demo') localStorage.removeItem(CHAVE)
      else localStorage.setItem(CHAVE, JSON.stringify(salvo))
    } catch {
      /* ignora: o app funciona sem persistir */
    }
  }, [salvo])

  // ---------- Envio ao servidor ----------
  // As mudanças entram numa fila e vão em lotes, uma de cada vez. Sem internet, juntam-se e
  // tentam de novo a cada 5 segundos; nada se perde enquanto a página estiver aberta.
  const fila = useRef<Mudancas | null>(null)
  const enviando = useRef(false)
  const enviar = useCallback(async () => {
    if (enviando.current) return
    enviando.current = true
    while (fila.current) {
      const lote = fila.current
      fila.current = null
      setSalvamento('salvando')
      try {
        await api('POST', 'sincronizar', lote)
      } catch (e) {
        const status = e instanceof ErroApi ? e.status : 0
        if (status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) {
          // O servidor recusou o lote: repetir não adianta. Fica registrado e a fila segue.
          console.error('Mudança recusada pelo servidor', e, lote)
          setSalvamento('erro')
          continue
        }
        fila.current = fila.current ? juntar(lote, fila.current) : lote
        setSalvamento('erro')
        enviando.current = false
        if (status === 401) setConta(null)
        else window.setTimeout(() => void enviar(), 5000)
        return
      }
    }
    setSalvamento('ok')
    enviando.current = false
  }, [])
  const enfileirar = useCallback(
    (m: Mudancas | null) => {
      if (!m) return
      fila.current = fila.current ? juntar(fila.current, m) : m
      void enviar()
    },
    [enviar],
  )
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (fila.current || enviando.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [])

  // Toda mudança passa pelo gerador, para as contas fixas estarem sempre criadas.
  const mudar = useCallback(
    (f: (d: Dados) => Dados) => {
      const s = salvoRef.current
      const dados = comPrevistos(f(s.dados), hojeDo(s.modo))
      const novo = { ...s, dados }
      salvoRef.current = novo
      setSalvo(novo)
      if (s.noServidor) enfileirar(diferencas(s.dados, dados))
    },
    [enfileirar],
  )

  /** Roda uma mudança e devolve como desfazê-la, sem perder o que mudou depois em outros registros. */
  const desfazivel = useCallback(
    (f: (d: Dados) => Dados): Desfazer => {
      const antes = salvoRef.current.dados
      mudar(f)
      const depois = salvoRef.current.dados
      return () => mudar((d) => reverterDados(d, antes, depois))
    },
    [mudar],
  )

  const carregarDoServidor = useCallback(async () => {
    const { dados } = await api<{ dados: Dados | null }>('GET', 'dados')
    if (!dados) return
    const h = hojeReal()
    const atualizado = comPrevistos(dados, h)
    setSalvo({ modo: 'real', dados: atualizado, noServidor: true })
    setMes(mesDe(h))
    // Contas fixas do mês que virou desde o último acesso: o servidor também guarda.
    enfileirar(diferencas(dados, atualizado))
  }, [enfileirar])

  useEffect(() => {
    void (async () => {
      const s = await verificarServidor()
      if (!s.tem) return setServidor('sem')
      setConta(s.conta)
      if (s.conta?.temNegocio) await carregarDoServidor().catch(() => {})
      setServidor('com')
    })()
  }, [carregarDoServidor])

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const c = await api<Conta>('POST', 'conta/entrar', { email, senha })
      // Mudanças que ficaram esperando porque a sessão tinha vencido vão antes de recarregar.
      if (fila.current) await enviar()
      if (c.temNegocio) await carregarDoServidor()
      setConta(c)
      return c
    },
    [carregarDoServidor, enviar],
  )
  const criarConta = useCallback(async (nome: string, email: string, senha: string) => {
    const c = await api<Conta>('POST', 'conta/criar', { nome, email, senha, aceiteTermos: true })
    setConta(c)
    return c
  }, [])

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
      desfazivel((d) => ({
        ...d,
        lancamentos: d.lancamentos.map((l) =>
          l.id === id ? { ...l, situacao: 'realizado' as const, dataPagamento: hoje, valor: valorReal && valorReal > 0 ? valorReal : l.valor } : l,
        ),
      })),
    [desfazivel, hoje],
  )

  const anexarComprovante = useCallback(async (arquivo: File) => {
    const c = await lerComprovante(arquivo)
    if (!salvoRef.current.noServidor) return c
    // Com servidor, o arquivo vai na hora; o lançamento guarda só o id, o nome e o tamanho.
    await api('POST', 'comprovantes', { id: c.id, nome: c.nome, tipo: c.tipo, dados: c.dados!.slice(c.dados!.indexOf(',') + 1) })
    return { id: c.id, nome: c.nome, tipo: c.tipo, tamanho: c.tamanho }
  }, [])

  const registrarPagamento = useCallback(
    (id: string, detalhes: DetalhesPagamento) => desfazivel((d) => aplicarPagamento(d, id, detalhes, uid)),
    [desfazivel],
  )

  const marcarDasPago = useCallback(
    (competencia: MesISO) =>
      desfazivel((d) => {
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
    [desfazivel, hoje],
  )

  const separarReserva = useCallback(
    (valor: Centavos, mesRef: MesISO) =>
      desfazivel((d) => {
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
    [desfazivel, hoje],
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
  const comecar = useCallback(
    async (c: ConfigInicial) => {
      const h = hojeReal()
      const dados = dadosIniciais(c, h)
      if (servidor === 'com') {
        const r = await api<{ dados: Dados }>('POST', 'negocio', paraNovoNegocio(dados))
        fila.current = null
        setSalvo({ modo: 'real', dados: r.dados, noServidor: true })
        setConta((x) => x && { ...x, temNegocio: true })
      } else {
        setSalvo({ modo: 'real', dados })
      }
      setMes(mesDe(h))
    },
    [servidor],
  )
  const restaurarDemo = useCallback(() => {
    setSalvo({ modo: 'demo', dados: dadosDemo() })
    setMes(mesDe(DEMO_HOJE))
  }, [])
  const sair = useCallback(async () => {
    await api('POST', 'conta/sair').catch(() => {})
    fila.current = null
    setConta(null)
    restaurarDemo()
  }, [restaurarDemo])

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
      registrarPagamento,
      anexarComprovante,
      marcarDasPago,
      separarReserva,
      recorrenciaDe,
      atualizarEmpresa,
      atualizarPreferencias,
      dispensarAviso,
      comecar,
      restaurarDemo,
      servidor,
      conta,
      salvamento,
      entrar,
      criarConta,
      sair,
    }),
    [salvo, hoje, mes, salvarLancamento, excluirLancamento, marcarComoPago, registrarPagamento, anexarComprovante, marcarDasPago, separarReserva, recorrenciaDe, atualizarEmpresa, atualizarPreferencias, dispensarAviso, comecar, restaurarDemo, servidor, conta, salvamento, entrar, criarConta, sair],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}
