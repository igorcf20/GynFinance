import { Bell, CalendarDays, ChevronDown, Menu } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { alertas } from '../../domain/calc'
import { useStore } from '../../data/store'
import { addMeses, mesAno } from '../../lib/format'
import { LogoMarca } from './Logo'

export function SeletorMes() {
  const { mes, setMes, hoje } = useStore()
  const atual = hoje.slice(0, 7)
  const meses = Array.from({ length: 12 }, (_, i) => addMeses(atual, -i))
  return (
    <label className="relative inline-flex h-11 items-center gap-2.5 whitespace-nowrap rounded-[12px] border border-[#e3e9f1] bg-surface pr-10 pl-3.5 text-[14px] font-semibold text-ink shadow-[var(--shadow-card)] transition-all hover:-translate-y-px">
      <CalendarDays size={18} strokeWidth={1.9} className="text-navy" aria-hidden />
      <span className="sr-only">Período</span>
      <select value={mes} onChange={(e) => setMes(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {meses.map((m) => (
          <option key={m} value={m}>
            {mesAno(m)}
          </option>
        ))}
      </select>
      {mesAno(mes)}
      <ChevronDown size={16} className="absolute right-3.5 text-navy" aria-hidden />
    </label>
  )
}

function Notificacoes() {
  const { dados, hoje } = useStore()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const lista = alertas(dados, hoje)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false)
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label={`Notificações${lista.length ? `, ${lista.length} novas` : ''}`}
        aria-expanded={aberto}
        className="relative inline-flex size-11 items-center justify-center rounded-full text-navy transition-colors hover:bg-white hover:shadow-[var(--shadow-card)]"
      >
        <Bell size={21} strokeWidth={1.9} />
        {lista.length > 0 && <span className="anim-pulso absolute top-2.5 right-3 size-2 rounded-full bg-danger ring-2 ring-white" aria-hidden />}
      </button>
      {aberto && (
        <div className="anim-subir absolute right-0 z-30 mt-2 w-80 rounded-[16px] border border-line bg-surface p-2 shadow-[var(--shadow-pop)]">
          <p className="px-3 pt-2 pb-1 text-[12px] font-semibold text-ink-2">Avisos</p>
          {lista.length === 0 && <p className="px-3 py-4 text-[13px] text-ink-2">Nenhum aviso agora. Tudo em dia.</p>}
          {lista.map((a) => (
            <Link
              key={a.id}
              to={a.acao?.para ?? '/'}
              onClick={() => setAberto(false)}
              className="flex gap-3 rounded-[10px] px-3 py-2.5 text-[13px] text-ink hover:bg-hover"
            >
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.nivel === 'perigo' ? 'bg-danger' : a.nivel === 'atencao' ? 'bg-warning-base' : 'bg-primary'}`} aria-hidden />
              {a.texto}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function Header({ titulo, subtitulo, periodo, acoes }: { titulo: ReactNode; subtitulo?: ReactNode; periodo?: boolean; acoes?: ReactNode }) {
  const { dados } = useStore()
  return (
    <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
      <Link to="/" className="md:hidden" aria-label="Início">
        <LogoMarca size={32} />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-bold tracking-[-0.025em] text-ink md:text-[26px]">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 truncate text-[13px] text-ink-2 md:text-[15px]">{subtitulo}</p>}
      </div>
      <div className="flex items-center gap-1.5 md:gap-2">
        {acoes}
        {periodo && (
          <span className="hidden sm:inline-flex">
            <SeletorMes />
          </span>
        )}
        <Notificacoes />
        <Link
          to="/configuracoes"
          aria-label="Perfil da empresa"
          className="hidden size-11 items-center justify-center rounded-full bg-gradient-to-b from-[#eaf0f8] to-[#d9e3f0] text-[17px] font-extrabold text-navy ring-2 ring-white md:inline-flex"
        >
          {dados.empresa.nomeDono.charAt(0).toUpperCase()}
        </Link>
        <Link to="/mais" aria-label="Mais opções" className="inline-flex size-10 items-center justify-center rounded-[10px] text-slate hover:bg-hover md:hidden">
          <Menu size={20} strokeWidth={1.7} />
        </Link>
      </div>
      {periodo && (
        <div className="w-full sm:hidden">
          <SeletorMes />
        </div>
      )}
    </header>
  )
}
