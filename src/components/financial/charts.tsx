import { useId } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ResumoMes } from '../../domain/calc'
import { brl, nomeMesCurto } from '../../lib/format'
import { useTema } from '../layout/BotaoTema'

const AZUL = '#3478F6'

function DicaValor({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow-card-hover)]">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="num flex items-center gap-2 text-ink-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}: <span className="font-semibold text-ink">{brl(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

/** Barras do "sobrou" nos últimos meses: as antigas em azul bem claro e o mês atual em azul forte. */
export function SobrouMesesChart({ serie, altura = 150, discreto }: { serie: ResumoMes[]; altura?: number; discreto?: boolean }) {
  const dados = serie.map((r) => ({ mes: nomeMesCurto(r.mes), Sobrou: Math.max(0, r.sobrou) }))
  const n = dados.length
  const id = useId().replace(/:/g, '')
  const { escuro } = useTema()
  return (
    <div style={{ height: altura }} role="img" aria-label={`Sobrou por mês: ${serie.map((r) => `${nomeMesCurto(r.mes)} ${brl(r.sobrou)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="22%">
          <defs>
            <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F8FFB" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
            {dados.map((_, i) => {
              // Do cinza-azulado (mais antigo) ao azul claro (mês anterior).
              const t = n > 1 ? i / (n - 1) : 1
              const topo = discreto ? `rgba(148,170,200,${0.35 + t * 0.45})` : escuro ? `rgba(77,141,255,${0.22 + t * 0.3})` : `rgb(${Math.round(214 - t * 64)},${Math.round(225 - t * 33)},${Math.round(240 + t * 12)})`
              return (
                <linearGradient key={i} id={`${id}b${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={topo} />
                  <stop offset="100%" stopColor={discreto ? 'rgba(148,170,200,0.25)' : escuro ? 'rgba(77,141,255,0.08)' : '#E9F0F9'} />
                </linearGradient>
              )
            })}
          </defs>
          {!discreto && (
            <XAxis
              dataKey="mes"
              axisLine={{ stroke: 'var(--color-line)' }}
              tickLine={false}
              tick={({ x, y, payload, index }) => (
                <text x={x} y={Number(y) + 14} textAnchor="middle" fontSize={12} fontWeight={index === n - 1 ? 700 : 500} fill={index === n - 1 ? 'var(--color-ink)' : 'var(--color-ink-2)'}>
                  {payload.value}
                </text>
              )}
            />
          )}
          <Tooltip cursor={{ fill: 'var(--color-hover)', radius: 8 }} content={<DicaValor />} />
          <Bar dataKey="Sobrou" radius={[7, 7, 3, 3]} maxBarSize={30} animationBegin={150} animationDuration={900} animationEasing="ease-out">
            {dados.map((_, i) => (
              <Cell key={i} fill={i === n - 1 && !discreto ? `url(#${id}f)` : `url(#${id}b${i})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SaldoSparkline({ pontos }: { pontos: { dia: string; saldo: number }[] }) {
  return (
    <div className="h-16 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pontos} margin={{ top: 6, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id="gSaldo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AZUL} stopOpacity={0.22} />
              <stop offset="100%" stopColor={AZUL} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin - 30000', 'dataMax + 20000']} />
          <Area type="basis" dataKey="saldo" stroke={AZUL} strokeWidth={2.2} fill="url(#gSaldo)" animationBegin={250} animationDuration={1200} animationEasing="ease-out" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Entradas e saídas por mês (Fluxo de caixa). */
export function FluxoChart({ serie }: { serie: ResumoMes[] }) {
  const dados = serie.map((r) => ({ mes: nomeMesCurto(r.mes), Entradas: r.entrou, Saídas: r.saiu }))
  // Eixo em reais (os valores chegam em centavos).
  const k = (centavos: number) => {
    const v = centavos / 100
    return v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${v}`
  }
  return (
    <div className="h-[300px]" role="img" aria-label="Entradas e saídas por mês">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={6} barCategoryGap="28%">
          <defs>
            <linearGradient id="gEntradas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B9BFD" />
              <stop offset="100%" stopColor="#2F6FED" />
            </linearGradient>
            <linearGradient id="gSaidas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C3CFDE" />
              <stop offset="100%" stopColor="#A3B4CA" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: 'var(--color-ink-2)', fontWeight: 600 }} dy={6} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-ink-2)' }} tickFormatter={k} width={74} />
          <Tooltip cursor={{ fill: 'var(--color-hover)', radius: 8 }} content={<DicaValor />} />
          <Legend align="right" verticalAlign="top" iconType="square" iconSize={11} wrapperStyle={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink-2)', paddingBottom: 16 }} />
          <Bar dataKey="Entradas" fill="url(#gEntradas)" radius={[6, 6, 2, 2]} maxBarSize={30} animationDuration={900} animationEasing="ease-out" />
          <Bar dataKey="Saídas" fill="url(#gSaidas)" radius={[6, 6, 2, 2]} maxBarSize={30} animationBegin={120} animationDuration={900} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Barras horizontais simples (onde mais gastou). */
export function BarrasHorizontais({ itens }: { itens: { nome: string; valor: number }[] }) {
  const max = Math.max(...itens.map((i) => i.valor), 1)
  return (
    <ul className="space-y-4">
      {itens.map((i) => (
        <li key={i.nome} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]">
          <span className="truncate text-[14px] text-[#3d5170]">{i.nome}</span>
          <span className="num text-right text-[14px] font-semibold text-ink sm:hidden">{brl(i.valor)}</span>
          <div className="col-span-2 h-2.5 rounded-full bg-[#edf1f6] sm:col-span-1">
            <div
              className="anim-encher h-2.5 rounded-full shadow-[0_2px_6px_-2px_rgba(37,99,235,0.5)]"
              style={{ width: `${Math.max(6, (i.valor / max) * 100)}%`, backgroundImage: 'linear-gradient(90deg,#5B9BFD,#2F6FED)' }}
            />
          </div>
          <span className="num hidden min-w-[84px] text-right text-[14px] font-semibold text-ink sm:block">{brl(i.valor)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Recebido e pago mês a mês com um cliente ou fornecedor (ficha). */
export function ParceiroChart({ serie, mostrar }: { serie: { mes: string; recebido: number; pago: number }[]; mostrar: { recebido: boolean; pago: boolean } }) {
  const dados = serie.map((p) => ({ mes: nomeMesCurto(p.mes), Recebido: p.recebido, Pago: p.pago }))
  const k = (centavos: number) => {
    const v = centavos / 100
    return v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `${v}`
  }
  return (
    <div className="h-[240px]" role="img" aria-label={`Por mês: ${serie.map((p) => `${nomeMesCurto(p.mes)} recebido ${brl(p.recebido)}, pago ${brl(p.pago)}`).join('; ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={4} barCategoryGap="26%">
          <defs>
            <linearGradient id="gRecebido" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3FC58A" />
              <stop offset="100%" stopColor="#12925A" />
            </linearGradient>
            <linearGradient id="gPago" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFB26B" />
              <stop offset="100%" stopColor="#F08A24" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-ink-2)', fontWeight: 600 }} dy={6} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-ink-2)' }} tickFormatter={k} width={46} />
          <Tooltip cursor={{ fill: 'var(--color-hover)', radius: 8 }} content={<DicaValor />} />
          {mostrar.recebido && <Bar dataKey="Recebido" fill="url(#gRecebido)" radius={[6, 6, 2, 2]} maxBarSize={24} animationDuration={900} animationEasing="ease-out" />}
          {mostrar.pago && <Bar dataKey="Pago" fill="url(#gPago)" radius={[6, 6, 2, 2]} maxBarSize={24} animationBegin={120} animationDuration={900} animationEasing="ease-out" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
