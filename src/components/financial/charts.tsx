import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ResumoMes } from '../../domain/calc'
import { brl, nomeMesCurto } from '../../lib/format'

const AZUL = '#3478F6'
const AZUL_CLARO = '#C9DCFC'
const ARDOSIA = '#A9BDD3'

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

/** Barras do "sobrou" nos últimos meses; o mês atual em destaque. */
export function SobrouMesesChart({ serie, altura = 120 }: { serie: ResumoMes[]; altura?: number }) {
  const dados = serie.map((r) => ({ mes: nomeMesCurto(r.mes), Sobrou: Math.max(0, r.sobrou) }))
  return (
    <div style={{ height: altura }} role="img" aria-label={`Sobrou por mês: ${serie.map((r) => `${nomeMesCurto(r.mes)} ${brl(r.sobrou)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
          <Tooltip cursor={{ fill: '#F1F4F8', radius: 6 }} content={<DicaValor />} />
          <Bar dataKey="Sobrou" radius={[5, 5, 5, 5]} maxBarSize={20} isAnimationActive={false}>
            {dados.map((_, i) => (
              <Cell key={i} fill={i === dados.length - 1 ? AZUL : AZUL_CLARO} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SaldoSparkline({ pontos }: { pontos: { dia: string; saldo: number }[] }) {
  return (
    <div className="h-14 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pontos} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="gSaldo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AZUL} stopOpacity={0.14} />
              <stop offset="100%" stopColor={AZUL} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin - 300', 'dataMax + 300']} />
          <Area type="monotone" dataKey="saldo" stroke={AZUL} strokeWidth={1.8} fill="url(#gSaldo)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Entradas e saídas por mês (Fluxo de caixa). */
export function FluxoChart({ serie }: { serie: ResumoMes[] }) {
  const dados = serie.map((r) => ({ mes: nomeMesCurto(r.mes), Entradas: r.entrou, Saídas: r.saiu }))
  const k = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${v}`)
  return (
    <div className="h-[300px]" role="img" aria-label="Entradas e saídas por mês">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={4}>
          <CartesianGrid vertical={false} stroke="#EEF2F6" />
          <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={k} width={70} />
          <Tooltip cursor={{ fill: '#F5F7FA' }} content={<DicaValor />} />
          <Legend align="right" verticalAlign="top" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#64748B', paddingBottom: 12 }} />
          <Bar dataKey="Entradas" fill={AZUL} radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive={false} />
          <Bar dataKey="Saídas" fill={ARDOSIA} radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Barras horizontais simples (onde mais gastou). */
export function BarrasHorizontais({ itens }: { itens: { nome: string; valor: number }[] }) {
  const max = Math.max(...itens.map((i) => i.valor), 1)
  return (
    <ul className="space-y-3.5">
      {itens.map((i, idx) => (
        <li key={i.nome}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{i.nome}</span>
            <span className="num shrink-0 font-semibold text-ink">{brl(i.valor)}</span>
          </div>
          <div className="h-2 rounded-full bg-[#eef2f6]">
            <div className="h-2 rounded-full" style={{ width: `${(i.valor / max) * 100}%`, background: idx === 0 ? AZUL : idx === 1 ? '#6A9CF8' : '#9DBEF9' }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
