import { Bell, CalendarDays, ChevronDown, CloudOff, LogOut, Menu, Settings } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { alertas } from '../../domain/calc'
import { useStore } from '../../data/store'
import { addMeses, mesAno } from '../../lib/format'
import { LogoMarca } from './Logo'

export function SeletorMes({ className = '' }: { className?: string }) {
  const { mes, setMes, hoje } = useStore()
  const atual = hoje.slice(0, 7)
  const meses = Array.from({ length: 12 }, (_, i) => addMeses(atual, -i))
  return (
    <label className={`relative inline-flex h-11 min-w-0 items-center gap-2.5 whitespace-nowrap rounded-[12px] border border-[#e3e9f1] bg-surface pr-10 pl-3.5 text-[14px] font-semibold text-ink shadow-[var(--shadow-card)] transition-all hover:-translate-y-px ${className}`}>
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
        <div className="anim-subir fixed inset-x-4 top-[calc(4.5rem+env(safe-area-inset-top))] z-50 max-h-[70dvh] overflow-y-auto overscroll-contain rounded-[16px] md:absolute md:inset-x-auto md:top-auto md:right-0 md:mt-2 md:w-80 border border-line bg-surface p-2 shadow-[var(--shadow-pop)]">
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

/** Avatar: na versão instalada abre o menu da conta (configurações e sair). */
function Perfil() {
  const { dados, conta, sair } = useStore()
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false)
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  const classe =
    'hidden size-11 items-center justify-center rounded-full bg-gradient-to-b from-[#eaf0f8] to-[#d9e3f0] text-[17px] font-extrabold text-navy ring-2 ring-white transition-transform hover:-translate-y-px md:inline-flex'
  const inicial = dados.empresa.nomeDono.charAt(0).toUpperCase()
  if (!conta) {
    return (
      <Link to="/configuracoes" aria-label="Perfil da empresa" className={classe}>
        {inicial}
      </Link>
    )
  }
  return (
    <div ref={ref} className="relative hidden md:block">
      <button onClick={() => setAberto((v) => !v)} aria-label="Sua conta" aria-expanded={aberto} className={classe}>
        {inicial}
      </button>
      {aberto && (
        <div className="anim-janela absolute right-0 z-30 mt-2 w-64 rounded-[16px] border border-line bg-surface p-2 shadow-[var(--shadow-pop)]">
          <div className="px-3 pt-2 pb-2.5">
            <p className="truncate text-[14px] font-bold text-ink">{conta.usuario.nome}</p>
            <p className="truncate text-[12px] text-ink-2">{conta.usuario.email}</p>
          </div>
          <Link to="/configuracoes" onClick={() => setAberto(false)} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium text-ink hover:bg-hover">
            <Settings size={16} className="text-slate" aria-hidden /> Configurações
          </Link>
          <button
            onClick={async () => {
              await sair()
              navigate('/entrar', { replace: true })
            }}
            className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium text-danger hover:bg-danger-soft"
          >
            <LogOut size={16} aria-hidden /> Sair
          </button>
        </div>
      )}
    </div>
  )
}

/** Só aparece quando uma mudança ainda não chegou ao servidor. */
function AvisoSalvamento() {
  const { salvamento, conta } = useStore()
  if (salvamento !== 'erro') return null
  const classe = 'inline-flex h-9 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-[12px] font-semibold text-[#7a3c07]'
  if (!conta) {
    return (
      <Link to="/entrar" role="status" className={`${classe} hover:underline`}>
        <CloudOff size={15} aria-hidden /> Entre de novo para salvar
      </Link>
    )
  }
  return (
    <span role="status" className={classe}>
      <CloudOff size={15} aria-hidden /> Sem conexão. Tentando salvar…
    </span>
  )
}

export function Header({ titulo, subtitulo, periodo, acoes }: { titulo: ReactNode; subtitulo?: ReactNode; periodo?: boolean; acoes?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-3 md:gap-x-4">
      <Link to="/" className="md:hidden" aria-label="Início">
        <LogoMarca size={32} />
      </Link>
      <div className="min-w-0 flex-1">
        {/* No celular o título e a explicação quebram linha em vez de virar reticências. */}
        <h1 className="text-[21px] leading-tight font-bold tracking-[-0.025em] text-balance text-ink md:truncate md:text-[26px]">{titulo}</h1>
        {subtitulo && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-2 md:mt-0.5 md:line-clamp-1 md:text-[15px]">{subtitulo}</p>}
      </div>
      <div className="flex items-center gap-1.5 md:gap-2">
        {acoes}
        {periodo && (
          <span className="hidden sm:inline-flex">
            <SeletorMes />
          </span>
        )}
        <AvisoSalvamento />
        <Notificacoes />
        <Perfil />
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
