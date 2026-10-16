import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Pencil, Plus, ReceiptText, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header, SeletorMes } from '../components/layout/Header'
import { IconeCategoria } from '../components/financial/categoriaVisual'
import { Badge, type TomBadge } from '../components/ui/Badge'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card, EstadoVazio } from '../components/ui/Card'
import { Select } from '../components/ui/Field'
import { Modal, useToast } from '../components/ui/Modal'
import { Segmentado } from '../components/ui/Tabs'
import Papa from 'papaparse'
import type { Categoria, Lancamento, Natureza } from '../domain/types'
import { useStore } from '../data/store'
import { brl, dataBR, diaMes, mesDe } from '../lib/format'
import { FORMAS } from './NewTransaction'

type Filtro = 'todos' | 'entradas' | 'saidas'
type Ordem = { campo: 'data' | 'valor'; desc: boolean }

const POR_PAGINA = 10

const NATUREZA: Record<Natureza, string> = { entrada: 'Entrada', saida: 'Saída', retirada: 'Retirada', aporte: 'Aporte', transferencia: 'Transferência' }

export function situacaoBadge(l: Lancamento): { texto: string; tom: TomBadge } {
  if (l.situacao === 'cancelado') return { texto: 'Cancelado', tom: 'neutro' }
  if (l.situacao === 'previsto') return { texto: l.natureza === 'entrada' ? 'A receber' : 'A pagar', tom: 'ambar' }
  if (l.natureza === 'entrada') return { texto: 'Recebido', tom: 'verde' }
  if (l.natureza === 'transferencia') return { texto: 'Separado', tom: 'azul' }
  return { texto: 'Pago', tom: 'neutro' }
}

const dataRef = (l: Lancamento) => l.dataPagamento ?? l.dataVencimento ?? l.dataCompetencia
const sinal = (l: Lancamento) => (l.natureza === 'entrada' || l.natureza === 'aporte' ? 1 : l.natureza === 'transferencia' ? 0 : -1)

const NOMES_GRUPO_CSV: Record<string, string> = {
  receita: 'Receita',
  custo: 'Custo',
  despesa_fixa: 'Despesa fixa',
  despesa_variavel: 'Despesa variável',
  imposto: 'Imposto',
  retirada: 'Retirada',
}

/** Planilha do mês para o contador: todas as colunas úteis, `;` como separador e BOM para o Excel em português. */
export function csvDoMes(linhas: Lancamento[], categorias: Categoria[]): string {
  const cat = (id?: string) => categorias.find((c) => c.id === id)
  const dados = linhas.map((l) => ({
    'Data de pagamento': l.dataPagamento ? dataBR(l.dataPagamento) : '',
    'Data de competência': dataBR(l.dataCompetencia),
    Vencimento: l.dataVencimento ? dataBR(l.dataVencimento) : '',
    Tipo: NATUREZA[l.natureza],
    Categoria: cat(l.categoriaId)?.nome ?? '',
    'Grupo da categoria': NOMES_GRUPO_CSV[cat(l.categoriaId)?.grupo ?? ''] ?? '',
    Descrição: l.descricao ?? '',
    'Cliente ou fornecedor': l.contraparte ?? '',
    'Forma de pagamento': FORMAS.find((f) => f.valor === l.formaPagamento)?.rotulo ?? '',
    Valor: ((sinal(l) * l.valor) / 100).toFixed(2).replace('.', ','),
    Situação: situacaoBadge(l).texto,
    'Nota emitida': l.notaEmitida === 'sim' ? 'Sim' : l.notaEmitida === 'nao' ? 'Não' : '',
    'Número da nota': '',
  }))
  return '\ufeff' + Papa.unparse(dados, { delimiter: ';', newline: '\r\n' })
}

function exportarCsv(linhas: Lancamento[], categorias: Categoria[], mes: string) {
  const blob = new Blob([csvDoMes(linhas, categorias)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `lancamentos-${mes}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function Transactions() {
  const { dados, mes, setMes, excluirLancamento } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  // Avisos e o fechamento abrem o extrato já filtrado (ex.: ?situacao=semnota&mes=2026-09).
  const [situacao, setSituacao] = useState(params.get('situacao') ?? '')
  const mesDoLink = params.get('mes')
  useEffect(() => {
    if (mesDoLink && /^\d{4}-\d{2}$/.test(mesDoLink)) setMes(mesDoLink)
  }, [mesDoLink, setMes])
  const [ordem, setOrdem] = useState<Ordem>({ campo: 'data', desc: true })
  const [pagina, setPagina] = useState(1)
  const [excluir, setExcluir] = useState<Lancamento | null>(null)

  const nomeCategoria = (id?: string) => dados.categorias.find((c) => c.id === id)?.nome ?? '—'

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const r = dados.lancamentos.filter((l) => {
      if (l.espelhoDe) return false
      if (mesDe(dataRef(l)) !== mes) return false
      if (filtro === 'entradas' && l.natureza !== 'entrada') return false
      if (filtro === 'saidas' && !(l.natureza === 'saida' || l.natureza === 'retirada')) return false
      if (categoria && l.categoriaId !== categoria) return false
      if (situacao === 'feito' && l.situacao !== 'realizado') return false
      if (situacao === 'aberto' && l.situacao !== 'previsto') return false
      if (situacao === 'semnota' && !(l.natureza === 'entrada' && l.notaEmitida === 'nao')) return false
      if (termo && !`${l.descricao ?? ''} ${l.contraparte ?? ''}`.toLowerCase().includes(termo)) return false
      return true
    })
    return r.sort((a, b) => {
      const d = ordem.campo === 'data' ? dataRef(a).localeCompare(dataRef(b)) : a.valor - b.valor
      return ordem.desc ? -d : d
    })
  }, [dados.lancamentos, mes, filtro, categoria, situacao, busca, ordem])

  const paginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA))
  const atual = Math.min(pagina, paginas)
  const visiveis = linhas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA)
  const ordenar = (campo: Ordem['campo']) => setOrdem((o) => ({ campo, desc: o.campo === campo ? !o.desc : true }))
  const SetaOrdem = ({ campo }: { campo: Ordem['campo'] }) => (ordem.campo !== campo ? null : ordem.desc ? <ArrowDown size={13} /> : <ArrowUp size={13} />)
  const resetPagina = <T,>(f: (v: T) => void) => (v: T) => {
    f(v)
    setPagina(1)
  }

  const valorCor = (l: Lancamento) => (sinal(l) > 0 ? 'text-success' : sinal(l) < 0 ? 'text-danger' : 'text-ink')
  const valorTxt = (l: Lancamento) => `${sinal(l) < 0 ? '- ' : ''}${brl(l.valor, { centavos: true })}`

  return (
    <>
      <Header
        titulo="Lançamentos"
        subtitulo="Tudo o que entrou e saiu, mês a mês."
        acoes={
          <>
            <span className="hidden lg:inline-flex">
              <Button variante="secundario" icone={<Download size={16} />} onClick={() => exportarCsv([...linhas].sort((a, b) => dataRef(a).localeCompare(dataRef(b))), dados.categorias, mes)} title="Planilha para o contador">
                Exportar CSV
              </Button>
            </span>
            <span className="hidden sm:inline-flex">
              <ButtonLink to="/lancar" icone={<Plus size={17} strokeWidth={2.4} />}>
                Novo lançamento
              </ButtonLink>
            </span>
          </>
        }
      />

      <Card className="!p-0">
        <div className="flex flex-col gap-3 border-b border-line p-4 md:p-5 lg:flex-row lg:items-center">
          <div className="relative lg:w-64">
            <Search size={17} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-navy" aria-hidden />
            <input
              type="search"
              aria-label="Buscar lançamentos"
              placeholder="Buscar lançamentos…"
              value={busca}
              onChange={(e) => resetPagina(setBusca)(e.target.value)}
              className="h-11 w-full rounded-[12px] border border-line bg-surface pr-3 pl-10 text-[14px] shadow-[0_1px_2px_rgba(16,32,64,0.04)] placeholder:text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <Segmentado
            rotulo="Tipo"
            valor={filtro}
            onChange={resetPagina(setFiltro)}
            opcoes={[
              { valor: 'todos', rotulo: 'Todos' },
              { valor: 'entradas', rotulo: 'Entradas' },
              { valor: 'saidas', rotulo: 'Saídas' },
            ]}
          />
          <div className="grid grid-cols-2 gap-3 sm:flex lg:ml-auto">
            <SeletorMes />
            <Select
              aria-label="Categoria"
              className="sm:w-52"
              value={categoria}
              onChange={(e) => resetPagina(setCategoria)(e.target.value)}
              opcoes={[{ valor: '', rotulo: 'Todas as categorias' }, ...dados.categorias.map((c) => ({ valor: c.id, rotulo: c.nome }))]}
            />
            <Select
              aria-label="Situação"
              className="col-span-2 sm:w-48"
              value={situacao}
              onChange={(e) => resetPagina(setSituacao)(e.target.value)}
              opcoes={[
                { valor: '', rotulo: 'Qualquer situação' },
                { valor: 'feito', rotulo: 'Pago ou recebido' },
                { valor: 'aberto', rotulo: 'Em aberto' },
                { valor: 'semnota', rotulo: 'Sem nota emitida' },
              ]}
            />
          </div>
        </div>

        {linhas.length === 0 ? (
          <EstadoVazio
            icone={<ReceiptText size={22} />}
            titulo="Nenhum lançamento aqui"
            texto="Mude os filtros ou o mês, ou lance uma entrada ou saída. Leva menos de 10 segundos."
            acao={
              <ButtonLink to="/lancar" icone={<Plus size={16} />}>
                Novo lançamento
              </ButtonLink>
            }
          />
        ) : (
          <>
            {/* Desktop e tablet: tabela */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-line bg-[#fafbfd] text-[13px] text-[#3d5170]">
                    <th scope="col" className="px-5 py-3 font-medium">
                      <button onClick={() => ordenar('data')} className="inline-flex items-center gap-1 hover:text-ink" aria-label="Ordenar por data">
                        Data <SetaOrdem campo="data" />
                      </button>
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">Descrição</th>
                    <th scope="col" className="px-3 py-3 font-medium">Categoria</th>
                    <th scope="col" className="px-3 py-3 font-medium">Forma</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      <button onClick={() => ordenar('valor')} className="inline-flex items-center gap-1 hover:text-ink" aria-label="Ordenar por valor">
                        Valor <SetaOrdem campo="valor" />
                      </button>
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">Situação</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((l) => {
                    const s = situacaoBadge(l)
                    return (
                      <tr key={l.id} className="border-b border-line transition-colors last:border-0 hover:bg-[#f7faff]">
                        <td className="num px-5 py-3.5 font-medium text-[#3d5170]">{diaMes(dataRef(l))}</td>
                        <td className="px-3 py-3.5">
                          <p className="font-bold text-ink">{l.descricao || NATUREZA[l.natureza]}</p>
                          {l.contraparte && <p className="text-[12px] text-ink-2">{l.contraparte}</p>}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex items-center gap-2.5 text-[#3d5170]">
                            <IconeCategoria l={l} categorias={dados.categorias} />
                            {l.natureza === 'transferencia' ? 'Reserva' : nomeCategoria(l.categoriaId)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-[#3d5170]">{FORMAS.find((f) => f.valor === l.formaPagamento)?.rotulo}</td>
                        <td className={`num px-3 py-3.5 text-right font-bold ${valorCor(l)}`}>{valorTxt(l)}</td>
                        <td className="px-3 py-3.5">
                          <Badge tom={s.tom}>{s.texto}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => navigate(`/lancar?id=${l.id}`)} aria-label={`Editar ${l.descricao ?? 'lançamento'}`} className="rounded-lg p-2 text-slate hover:bg-hover hover:text-ink">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => setExcluir(l)} aria-label={`Excluir ${l.descricao ?? 'lançamento'}`} className="rounded-lg p-2 text-slate hover:bg-danger-soft hover:text-danger">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Celular: lista */}
            <ul className="divide-y divide-line md:hidden">
              {visiveis.map((l) => {
                const s = situacaoBadge(l)
                return (
                  <li key={l.id}>
                    <button onClick={() => navigate(`/lancar?id=${l.id}`)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-hover">
                      <IconeCategoria l={l} categorias={dados.categorias} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-ink">{l.descricao || NATUREZA[l.natureza]}</p>
                        <p className="truncate text-[12px] text-ink-2">
                          {diaMes(dataRef(l))} · {l.natureza === 'transferencia' ? 'Reserva' : nomeCategoria(l.categoriaId)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`num mb-0.5 font-bold ${valorCor(l)}`}>{valorTxt(l)}</p>
                        <Badge tom={s.tom}>{s.texto}</Badge>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-ink-2 md:px-5">
              <span className="num">
                {linhas.length} {linhas.length === 1 ? 'lançamento' : 'lançamentos'}
              </span>
              <div className="flex items-center gap-1">
                <button disabled={atual <= 1} onClick={() => setPagina(atual - 1)} aria-label="Página anterior" className="rounded-lg p-1.5 hover:bg-hover disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <span className="num px-2">
                  {atual} de {paginas}
                </span>
                <button disabled={atual >= paginas} onClick={() => setPagina(atual + 1)} aria-label="Próxima página" className="rounded-lg p-1.5 hover:bg-hover disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        aberto={!!excluir}
        onFechar={() => setExcluir(null)}
        titulo="Excluir lançamento?"
        rodape={
          <>
            <Button variante="secundario" onClick={() => setExcluir(null)}>
              Cancelar
            </Button>
            <Button
              variante="perigo"
              onClick={() => {
                if (!excluir) return
                excluirLancamento(excluir.id)
                toast('Lançamento excluído.')
                setExcluir(null)
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        {excluir && (
          <p>
            "{excluir.descricao || NATUREZA[excluir.natureza]}" de {brl(excluir.valor, { centavos: true })} vai sair dos totais do mês. Não dá para desfazer.
          </p>
        )}
      </Modal>
    </>
  )
}
