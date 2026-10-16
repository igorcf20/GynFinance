import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List, Plus, Rows3 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DetalheEvento } from '../components/agenda/DetalheEvento'
import { FormAtendimento, type PedidoForm } from '../components/agenda/FormAtendimento'
import { corDoEvento, dataPorExtenso, DIAS_CURTOS, ETIQUETA, intervalo, PONTO } from '../components/agenda/visual'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card, EstadoVazio } from '../components/ui/Card'
import { Explica } from '../components/ui/Explica'
import { Segmentado } from '../components/ui/Tabs'
import { diasDaSemana, eventosDoPeriodo, gradeDoMes, minutosDoDia, totaisDoPeriodo, type Evento, type FiltroAgenda } from '../domain/agenda'
import type { DataISO } from '../domain/types'
import { useStore } from '../data/store'
import { addDias, addMeses, brl, diaMes, mesAno, nomeMes } from '../lib/format'

type Vista = 'mes' | 'semana' | 'dia' | 'lista'
const VISTAS: Vista[] = ['mes', 'semana', 'dia', 'lista']
const CHAVE_VISTA = 'gynfinance:agenda-vista'
const ALTURA_HORA = 56

function vistaGuardada(): Vista {
  try {
    const v = localStorage.getItem(CHAVE_VISTA) as Vista | null
    if (v && VISTAS.includes(v)) return v
  } catch {
    /* sem armazenamento */
  }
  return 'semana'
}

export function Agenda() {
  const { dados, hoje } = useStore()
  const [params] = useSearchParams()
  const [vista, setVista] = useState<Vista>(() => (VISTAS.includes(params.get('vista') as Vista) ? (params.get('vista') as Vista) : vistaGuardada()))
  const [cursor, setCursor] = useState<DataISO>(params.get('data') ?? hoje)
  const [filtro, setFiltro] = useState<FiltroAgenda>({ atendimentos: true, pagar: true, receber: true })
  const [aberto, setAberto] = useState<Evento | null>(null)
  const [pedido, setPedido] = useState<PedidoForm | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_VISTA, vista)
    } catch {
      /* ignora */
    }
  }, [vista])

  // Período que a vista mostra.
  const mes = cursor.slice(0, 7)
  const [de, ate] = useMemo((): [DataISO, DataISO] => {
    if (vista === 'mes') {
      const g = gradeDoMes(mes)
      return [g[0], g[41]]
    }
    if (vista === 'semana') {
      const s = diasDaSemana(cursor)
      return [s[0], s[6]]
    }
    if (vista === 'dia') return [cursor, cursor]
    return [cursor, addDias(cursor, 29)]
  }, [vista, cursor, mes])
  const eventos = useMemo(() => eventosDoPeriodo(dados, de, ate, hoje, filtro), [dados, de, ate, hoje, filtro])
  // No mês, o resumo conta só os dias do próprio mês (a grade mostra pedaços dos vizinhos).
  const doResumo = vista === 'mes' ? eventos.filter((e) => e.data.startsWith(mes)) : eventos
  const totais = totaisDoPeriodo(doResumo)

  const andar = (n: number) => {
    if (vista === 'mes') setCursor(`${addMeses(mes, n)}-01`)
    else setCursor(addDias(cursor, n * (vista === 'semana' ? 7 : vista === 'dia' ? 1 : 30)))
  }
  const titulo = vista === 'mes' ? mesAno(mes) : vista === 'semana' ? intervalo(de, ate) : vista === 'dia' ? dataPorExtenso(cursor) : `30 dias a partir de ${Number(de.slice(8, 10))} de ${nomeMes(de.slice(0, 7))}`
  const abrirDia = (d: DataISO) => {
    setCursor(d)
    setVista('dia')
  }
  const novo = (data?: DataISO, inicio?: string) => setPedido({ data: data ?? (cursor >= hoje ? cursor : hoje), inicio })

  return (
    <>
      <Header
        titulo="Agenda"
        subtitulo="Atendimentos marcados e as contas de cada dia."
        acoes={
          <span className="hidden sm:inline-flex">
            <Button icone={<Plus size={17} strokeWidth={2.4} />} onClick={() => novo()}>
              Novo atendimento
            </Button>
          </span>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-[12px] border border-line bg-surface shadow-[0_1px_2px_rgba(16,32,64,0.04)]">
            <button type="button" onClick={() => andar(-1)} aria-label="Anterior" className="inline-flex size-10 items-center justify-center rounded-l-[12px] text-navy hover:bg-hover">
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={() => setCursor(hoje)} className="h-10 border-x border-line px-3.5 text-[13px] font-semibold text-ink hover:bg-hover">
              Hoje
            </button>
            <button type="button" onClick={() => andar(1)} aria-label="Próximo" className="inline-flex size-10 items-center justify-center rounded-r-[12px] text-navy hover:bg-hover">
              <ChevronRight size={18} />
            </button>
          </div>
          <h2 className="min-w-0 truncate text-[17px] font-bold tracking-[-0.01em] text-ink md:text-[19px]" aria-live="polite">
            {vista === 'dia' ? (
              <>
                <span className="sm:hidden">{`${DIAS_CURTOS[new Date(`${cursor}T12:00:00`).getDay()]}, ${Number(cursor.slice(8, 10))} de ${nomeMes(mes)}`}</span>
                <span className="hidden sm:inline">{titulo}</span>
              </>
            ) : vista === 'lista' ? (
              <>
                <span className="sm:hidden">{`30 dias desde ${diaMes(de)}`}</span>
                <span className="hidden sm:inline">{titulo}</span>
              </>
            ) : (
              titulo
            )}
          </h2>
        </div>
        <Segmentado
          rotulo="Modo de visualização"
          valor={vista}
          onChange={setVista}
          className="w-full lg:ml-auto lg:w-auto"
          opcoes={[
            { valor: 'mes', rotulo: 'Mês', icone: <CalendarDays size={15} aria-hidden /> },
            { valor: 'semana', rotulo: 'Semana', icone: <CalendarRange size={15} aria-hidden /> },
            { valor: 'dia', rotulo: 'Dia', icone: <Rows3 size={15} aria-hidden /> },
            { valor: 'lista', rotulo: 'Lista', icone: <List size={15} aria-hidden /> },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['atendimentos', 'Atendimentos', 'azul'],
            ['receber', 'A receber', 'verde'],
            ['pagar', 'A pagar', 'laranja'],
          ] as const
        ).map(([chave, rotulo, cor]) => (
          <button
            key={chave}
            type="button"
            role="switch"
            aria-checked={filtro[chave]}
            onClick={() => setFiltro((f) => ({ ...f, [chave]: !f[chave] }))}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-all sm:gap-2 sm:px-3.5 sm:text-[13px] duration-200 active:scale-95 ${
              filtro[chave] ? 'border-line bg-surface text-ink shadow-[0_1px_2px_rgba(16,32,64,0.06)]' : 'border-transparent bg-[#eef2f7] text-muted line-through'
            }`}
          >
            <span className={`size-2.5 rounded-full ${filtro[chave] ? PONTO[cor] : 'bg-[#c3cddb]'}`} aria-hidden />
            {rotulo}
          </button>
        ))}
        <p className="num w-full text-[13px] text-ink-2 sm:ml-auto sm:w-auto">
          {totais.atendimentos} atendimento{totais.atendimentos === 1 ? '' : 's'} · <b className="text-success">{brl(totais.aReceber)}</b> a receber ·{' '}
          <b className="text-[#b44d06]">{brl(totais.aPagar)}</b> a pagar{' '}
          <span className="inline-flex align-middle">
            <Explica titulo="Resumo do período" lado="direita">
              Soma o que está marcado no período que você está vendo: atendimentos com valor e contas a receber entram em "a receber"; contas a pagar em "a pagar".
              Atendimento cancelado ou em que o cliente faltou não conta.
            </Explica>
          </span>
        </p>
      </div>

      <div key={`${vista}-${de}`} className="anim-entrar pb-16 sm:pb-0">
        {vista === 'mes' && <VistaMes mes={mes} eventos={eventos} hoje={hoje} cursor={cursor} onDia={setCursor} onAbrirDia={abrirDia} onEvento={setAberto} />}
        {vista === 'semana' && <VistaSemana dias={diasDaSemana(cursor)} eventos={eventos} hoje={hoje} onEvento={setAberto} onNovo={novo} onAbrirDia={abrirDia} />}
        {vista === 'dia' && <VistaDia dia={cursor} eventos={eventos} hoje={hoje} onEvento={setAberto} onNovo={novo} />}
        {vista === 'lista' && <VistaLista eventos={eventos} hoje={hoje} onEvento={setAberto} onNovo={() => novo()} />}
      </div>

      {/* No celular, o botão de marcar fica sempre à mão, acima da barra inferior. */}
      <button
        type="button"
        onClick={() => novo()}
        aria-label="Novo atendimento"
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 inline-flex h-12 items-center gap-2 rounded-full grad-primario px-5 text-[14px] font-semibold text-white shadow-[0_12px_28px_-10px_rgba(52,120,246,0.8)] active:scale-95 sm:hidden"
      >
        <Plus size={18} strokeWidth={2.4} aria-hidden /> Atendimento
      </button>

      <DetalheEvento
        evento={aberto}
        onFechar={() => setAberto(null)}
        onEditar={() => {
          const a = aberto?.atendimento && dados.atendimentos.find((x) => x.id === aberto.atendimento!.id)
          setAberto(null)
          if (a) setPedido({ editando: a })
        }}
      />
      <FormAtendimento pedido={pedido} onFechar={() => setPedido(null)} />
    </>
  )
}

// ---------- Peças ----------

function Etiqueta({ e, onClick, compacta }: { e: Evento; onClick: () => void; compacta?: boolean }) {
  const cor = corDoEvento(e)
  const riscado = e.atendimento && (e.atendimento.situacao === 'cancelado' || e.atendimento.situacao === 'faltou')
  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation()
        onClick()
      }}
      title={`${e.inicio ? `${e.inicio} ` : ''}${e.titulo}${e.valor ? ` · ${brl(e.valor)}` : ''}`}
      className={`flex w-full min-w-0 items-center gap-1.5 rounded-[7px] border-l-[3px] px-1.5 text-left font-semibold transition-colors ${compacta ? 'h-[22px] text-[11.5px]' : 'min-h-8 py-1 text-[13px]'} ${ETIQUETA[cor]}`}
    >
      {e.inicio && <span className="num shrink-0 font-bold opacity-80">{e.inicio}</span>}
      <span className={`min-w-0 truncate ${riscado ? 'line-through' : ''}`}>{e.titulo}</span>
      {!compacta && e.valor ? <span className="num ml-auto shrink-0 pl-1">{brl(e.valor)}</span> : null}
    </button>
  )
}

/** Linha de um item na lista (vista Lista, semana no celular e dia escolhido no mês). */
function ItemLista({ e, onClick }: { e: Evento; onClick: () => void }) {
  const cor = corDoEvento(e)
  const riscado = e.atendimento && (e.atendimento.situacao === 'cancelado' || e.atendimento.situacao === 'faltou')
  const situacao = e.atendimento?.situacao
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-[12px] px-2 py-3 text-left transition-colors hover:bg-hover">
        <span className="num w-[52px] shrink-0 text-[13px] font-bold text-ink">{e.inicio ?? <span className="text-[11px] font-semibold text-ink-2">Dia todo</span>}</span>
        <span className={`h-9 w-1 shrink-0 rounded-full ${PONTO[cor]}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[14px] font-bold text-ink ${riscado ? 'line-through opacity-60' : ''}`}>{e.titulo}</span>
          <span className={`block truncate text-[12.5px] ${e.atrasada ? 'text-danger' : 'text-ink-2'}`}>
            {e.tipo === 'atendimento'
              ? [e.detalhe, e.atrasada ? 'Pagamento atrasado' : null, situacao === 'concluido' ? 'Concluído' : situacao === 'faltou' ? 'Cliente faltou' : situacao === 'cancelado' ? 'Cancelado' : situacao === 'confirmado' ? 'Confirmado' : null]
                  .filter(Boolean)
                  .join(' · ') || 'Atendimento'
              : `${e.tipo === 'receber' ? 'A receber' : 'A pagar'}${e.atrasada ? ' · atrasada' : ''}${e.detalhe ? ` · ${e.detalhe}` : ''}`}
          </span>
        </span>
        {e.valor ? <span className={`num shrink-0 text-[14px] font-bold ${e.tipo === 'pagar' ? 'text-ink' : 'text-success'}`}>{e.tipo === 'pagar' ? '−' : '+'}{brl(e.valor)}</span> : null}
      </button>
    </li>
  )
}

function porDia(eventos: Evento[]): Map<DataISO, Evento[]> {
  const m = new Map<DataISO, Evento[]>()
  for (const e of eventos) m.set(e.data, [...(m.get(e.data) ?? []), e])
  return m
}

// ---------- Mês ----------

function VistaMes({
  mes,
  eventos,
  hoje,
  cursor,
  onDia,
  onAbrirDia,
  onEvento,
}: {
  mes: string
  eventos: Evento[]
  hoje: DataISO
  cursor: DataISO
  onDia: (d: DataISO) => void
  onAbrirDia: (d: DataISO) => void
  onEvento: (e: Evento) => void
}) {
  const grade = gradeDoMes(mes)
  const dia = porDia(eventos)
  // Esconde a 6ª semana quando ela é toda do mês seguinte.
  const semanas = grade[35].slice(0, 7) !== mes ? 5 : 6
  const doDia = dia.get(cursor) ?? []
  return (
    <div className="flex flex-col gap-4">
      <Card className="!p-0 overflow-visible">
        <div className="grid grid-cols-7 border-b border-line">
          {DIAS_CURTOS.map((d) => (
            <div key={d} className="py-2.5 text-center text-[12px] font-semibold tracking-wide text-ink-2 uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grade.slice(0, semanas * 7).map((d, i) => {
            const lista = dia.get(d) ?? []
            const fora = !d.startsWith(mes)
            const ehHoje = d === hoje
            const escolhido = d === cursor
            return (
              <div
                key={d}
                role="button"
                tabIndex={0}
                aria-label={`${dataPorExtenso(d)}: ${lista.length} ${lista.length === 1 ? 'item' : 'itens'}`}
                onClick={() => onDia(d)}
                onDoubleClick={() => onAbrirDia(d)}
                onKeyDown={(ev) => ev.key === 'Enter' && onAbrirDia(d)}
                className={`flex min-h-[64px] min-w-0 cursor-pointer flex-col gap-1 border-line p-1 transition-colors md:min-h-[112px] md:p-1.5 ${i % 7 ? 'border-l' : ''} ${i >= 7 ? 'border-t' : ''} ${
                  escolhido ? 'bg-primary-soft/50' : fora ? 'bg-[#fafbfd]' : 'hover:bg-hover/60'
                }`}
              >
                <span
                  className={`num inline-flex size-7 items-center justify-center self-center rounded-full text-[13px] font-semibold md:self-start ${
                    ehHoje ? 'grad-primario text-white' : fora ? 'text-muted' : 'text-ink'
                  }`}
                >
                  {Number(d.slice(8, 10))}
                </span>
                {/* Celular: pontinhos. Computador: as etiquetas, até três por dia. */}
                <span className="flex flex-wrap justify-center gap-0.5 md:hidden">
                  {lista.slice(0, 4).map((e) => (
                    <span key={e.id} className={`size-1.5 rounded-full ${PONTO[corDoEvento(e)]}`} aria-hidden />
                  ))}
                </span>
                <div className="hidden flex-col gap-1 md:flex">
                  {lista.slice(0, 3).map((e) => (
                    <Etiqueta key={e.id} e={e} compacta onClick={() => onEvento(e)} />
                  ))}
                  {lista.length > 3 && (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        onAbrirDia(d)
                      }}
                      className="px-1.5 text-left text-[11.5px] font-semibold text-primary hover:underline"
                    >
                      +{lista.length - 3} mais
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h3 className="text-[16px] font-bold text-ink">{dataPorExtenso(cursor)}</h3>
          <button type="button" onClick={() => onAbrirDia(cursor)} className="text-[13px] font-semibold text-primary hover:underline">
            Ver o dia
          </button>
        </div>
        {doDia.length ? (
          <ul className="-mx-2 divide-y divide-line">
            {doDia.map((e) => (
              <ItemLista key={e.id} e={e} onClick={() => onEvento(e)} />
            ))}
          </ul>
        ) : (
          <p className="py-3 text-[14px] text-ink-2">Nada marcado neste dia.</p>
        )}
      </Card>
    </div>
  )
}

// ---------- Grade de horários (semana e dia) ----------

interface Posicionado {
  e: Evento
  topo: number
  altura: number
  coluna: number
  colunas: number
}

/** Coloca os atendimentos lado a lado quando os horários se cruzam. */
function posicionar(eventos: Evento[], inicioGrade: number): Posicionado[] {
  const comHora = eventos.filter((e) => e.inicio).sort((a, b) => minutosDoDia(a.inicio!) - minutosDoDia(b.inicio!))
  const saida: Posicionado[] = []
  let grupo: Posicionado[] = []
  let fimGrupo = -1
  const fecharGrupo = () => {
    const n = Math.max(1, ...grupo.map((p) => p.coluna + 1))
    for (const p of grupo) p.colunas = n
    saida.push(...grupo)
    grupo = []
  }
  for (const e of comHora) {
    const ini = minutosDoDia(e.inicio!)
    const fim = Math.max(minutosDoDia(e.fim!), ini + 20)
    if (ini >= fimGrupo && grupo.length) fecharGrupo()
    const ocupadas = new Set(grupo.filter((p) => minutosDoDia(p.e.fim!) > ini).map((p) => p.coluna))
    let coluna = 0
    while (ocupadas.has(coluna)) coluna++
    grupo.push({ e, topo: ((ini - inicioGrade) / 60) * ALTURA_HORA, altura: Math.max(((fim - ini) / 60) * ALTURA_HORA - 3, 22), coluna, colunas: 1 })
    fimGrupo = Math.max(fimGrupo, fim)
  }
  if (grupo.length) fecharGrupo()
  return saida
}

function faixaDeHoras(eventos: Evento[]): [number, number] {
  let ini = 7
  let fim = 20
  for (const e of eventos) {
    if (!e.inicio) continue
    ini = Math.min(ini, Math.floor(minutosDoDia(e.inicio) / 60))
    fim = Math.max(fim, Math.ceil(minutosDoDia(e.fim!) / 60))
  }
  return [ini, Math.min(fim, 24)]
}

function agoraEmMinutos(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function GradeHoras({ dias, eventos, hoje, onEvento, onNovo, onAbrirDia }: { dias: DataISO[]; eventos: Evento[]; hoje: DataISO; onEvento: (e: Evento) => void; onNovo: (d: DataISO, h: string) => void; onAbrirDia?: (d: DataISO) => void }) {
  const [hIni, hFim] = faixaDeHoras(eventos)
  const horas = Array.from({ length: hFim - hIni }, (_, i) => hIni + i)
  const dia = porDia(eventos)
  const agora = agoraEmMinutos()
  const umDia = dias.length === 1
  return (
    <Card className="!p-0 overflow-hidden">
      {/* Cabeçalho dos dias e as contas (dia todo) */}
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `52px repeat(${dias.length}, minmax(0, 1fr))` }}>
        <div className="flex items-end justify-end px-1.5 pb-2 text-[10.5px] font-semibold text-muted">Contas</div>
        {dias.map((d) => {
          const contas = (dia.get(d) ?? []).filter((e) => !e.inicio)
          return (
            <div key={d} className="flex min-w-0 flex-col gap-1 border-l border-line p-1.5">
              {!umDia && (
                <button type="button" onClick={() => onAbrirDia?.(d)} className="flex items-center justify-center gap-1.5 rounded-[8px] py-1 hover:bg-hover">
                  <span className="text-[12px] font-semibold text-ink-2 uppercase">{DIAS_CURTOS[new Date(`${d}T12:00:00`).getDay()]}</span>
                  <span className={`num inline-flex size-7 items-center justify-center rounded-full text-[14px] font-bold ${d === hoje ? 'grad-primario text-white' : 'text-ink'}`}>{Number(d.slice(8, 10))}</span>
                </button>
              )}
              {contas.map((e) => (
                <Etiqueta key={e.id} e={e} compacta={!umDia} onClick={() => onEvento(e)} />
              ))}
              {umDia && !contas.length && <span className="py-1 text-[12px] text-muted">Nenhuma conta vence neste dia.</span>}
            </div>
          )
        })}
      </div>
      {/* Horários */}
      <div className="grid" style={{ gridTemplateColumns: `52px repeat(${dias.length}, minmax(0, 1fr))` }}>
        <div className="relative" style={{ height: horas.length * ALTURA_HORA }}>
          {horas.map((h, i) => (
            <span key={h} className="num absolute right-2 -translate-y-1/2 text-[11px] font-medium text-muted" style={{ top: i * ALTURA_HORA }}>
              {i === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
            </span>
          ))}
        </div>
        {dias.map((d) => {
          const pos = posicionar(dia.get(d) ?? [], hIni * 60)
          return (
            <div key={d} className={`relative border-l border-line ${d === hoje && !umDia ? 'bg-primary-soft/25' : ''}`} style={{ height: horas.length * ALTURA_HORA }}>
              {horas.map((h, i) => (
                <button
                  key={h}
                  type="button"
                  aria-label={`Marcar atendimento em ${dataPorExtenso(d)} às ${h}h`}
                  onClick={() => onNovo(d, `${String(h).padStart(2, '0')}:00`)}
                  className="absolute inset-x-0 border-t border-line/70 transition-colors hover:bg-primary-soft/40"
                  style={{ top: i * ALTURA_HORA, height: ALTURA_HORA }}
                />
              ))}
              {d === hoje && agora >= hIni * 60 && agora <= hFim * 60 && (
                <span className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-danger" style={{ top: ((agora - hIni * 60) / 60) * ALTURA_HORA }} aria-hidden>
                  <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-danger" />
                </span>
              )}
              {pos.map((p) => {
                const cor = corDoEvento(p.e)
                const riscado = p.e.atendimento && (p.e.atendimento.situacao === 'cancelado' || p.e.atendimento.situacao === 'faltou')
                return (
                  <button
                    key={p.e.id}
                    type="button"
                    onClick={() => onEvento(p.e)}
                    className={`absolute z-10 flex flex-col overflow-hidden rounded-[8px] border-l-[3px] px-1.5 py-1 text-left shadow-[0_1px_2px_rgba(16,32,64,0.08)] transition-[filter,transform] hover:brightness-[0.98] active:scale-[0.98] ${ETIQUETA[cor]}`}
                    style={{ top: p.topo + 1, height: p.altura, left: `calc(${(p.coluna / p.colunas) * 100}% + 2px)`, width: `calc(${100 / p.colunas}% - 4px)` }}
                  >
                    <span className={`truncate text-[12px] font-bold leading-tight ${riscado ? 'line-through' : ''}`}>
                      {p.e.titulo}
                      {umDia && p.altura <= 34 && <span className="num font-medium opacity-85"> · {p.e.inicio}–{p.e.fim}{p.e.detalhe ? ` · ${p.e.detalhe}` : ''}</span>}
                    </span>
                    {p.altura > 34 && (
                      <span className="num truncate text-[11px] font-medium leading-tight opacity-85">
                        {p.e.inicio}–{p.e.fim}
                        {umDia && p.e.detalhe ? ` · ${p.e.detalhe}` : ''}
                      </span>
                    )}
                    {p.altura > 52 && p.e.valor ? <span className="num mt-auto text-[11px] font-bold">{brl(p.e.valor)}</span> : null}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ---------- Semana, dia e lista ----------

function VistaSemana({ dias, eventos, hoje, onEvento, onNovo, onAbrirDia }: { dias: DataISO[]; eventos: Evento[]; hoje: DataISO; onEvento: (e: Evento) => void; onNovo: (d: DataISO, h?: string) => void; onAbrirDia: (d: DataISO) => void }) {
  const dia = porDia(eventos)
  return (
    <>
      <div className="hidden md:block">
        <GradeHoras dias={dias} eventos={eventos} hoje={hoje} onEvento={onEvento} onNovo={onNovo} onAbrirDia={onAbrirDia} />
      </div>
      {/* No celular, a semana vira uma lista por dia. */}
      <div className="flex flex-col gap-3 md:hidden">
        {dias.map((d) => {
          const lista = dia.get(d) ?? []
          return (
            <Card key={d} className={`!px-3 !py-2.5 ${d === hoje ? '!border-primary-line' : ''}`}>
              <button type="button" onClick={() => onAbrirDia(d)} className="flex w-full items-center gap-2 py-1 text-left">
                <span className={`num inline-flex size-8 items-center justify-center rounded-full text-[14px] font-bold ${d === hoje ? 'grad-primario text-white' : 'bg-[#f1f5fa] text-ink'}`}>{Number(d.slice(8, 10))}</span>
                <span className="text-[14px] font-bold text-ink">{dataPorExtenso(d).split(',')[0]}</span>
                <span className="ml-auto text-[12px] text-ink-2">{lista.length ? `${lista.length} ${lista.length === 1 ? 'item' : 'itens'}` : 'Livre'}</span>
              </button>
              {lista.length > 0 && (
                <ul className="divide-y divide-line">
                  {lista.map((e) => (
                    <ItemLista key={e.id} e={e} onClick={() => onEvento(e)} />
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}

function VistaDia({ dia, eventos, hoje, onEvento, onNovo }: { dia: DataISO; eventos: Evento[]; hoje: DataISO; onEvento: (e: Evento) => void; onNovo: (d: DataISO, h?: string) => void }) {
  return <GradeHoras dias={[dia]} eventos={eventos} hoje={hoje} onEvento={onEvento} onNovo={onNovo} />
}

function VistaLista({ eventos, hoje, onEvento, onNovo }: { eventos: Evento[]; hoje: DataISO; onEvento: (e: Evento) => void; onNovo: () => void }) {
  const dias = [...porDia(eventos).entries()]
  if (!dias.length) {
    return (
      <Card>
        <EstadoVazio
          icone={<CalendarDays size={22} />}
          titulo="Nada marcado nos próximos 30 dias"
          texto="Marque um atendimento ou lance uma conta a pagar ou a receber: tudo aparece aqui no dia certo."
          acao={<Button onClick={onNovo}>Novo atendimento</Button>}
        />
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {dias.map(([d, lista]) => (
        <Card key={d} className="!py-3">
          <h3 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-ink">
            {dataPorExtenso(d)}
            {d === hoje && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">Hoje</span>}
          </h3>
          <ul className="-mx-2 divide-y divide-line">
            {lista.map((e) => (
              <ItemLista key={e.id} e={e} onClick={() => onEvento(e)} />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}
