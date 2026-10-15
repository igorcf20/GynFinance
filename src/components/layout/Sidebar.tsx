import { ChevronDown, ChevronRight, MoreHorizontal, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../../data/store'
import { Logo } from './Logo'
import { estaAtivo, NAV_MAIS, NAV_PRINCIPAL, type ItemNav } from './navegacao'

const ATIVIDADE: Record<string, string> = { comercio: 'Comércio', servico: 'Serviços', industria: 'Indústria', misto: 'Comércio e serviços' }

function Item({ item, caminho, compacto }: { item: ItemNav; caminho: string; compacto: boolean }) {
  const ativo = estaAtivo(item, caminho)
  const Icone = item.icone
  return (
    <NavLink
      to={item.para}
      title={compacto ? item.rotulo : undefined}
      aria-current={ativo ? 'page' : undefined}
      className={`flex h-10 items-center gap-3 rounded-[9px] px-3 text-[14px] font-medium transition-colors duration-150 ${
        compacto ? 'justify-center px-0' : ''
      } ${ativo ? 'bg-primary-soft text-primary' : 'text-ink-2 hover:bg-hover hover:text-ink'}`}
    >
      <Icone size={19} strokeWidth={1.7} aria-hidden />
      <span className={compacto ? 'sr-only' : ''}>{item.rotulo}</span>
    </NavLink>
  )
}

/** Navegação lateral: expandida acima de 1200px e só com ícones no tablet. */
export function Sidebar() {
  const { pathname } = useLocation()
  const { dados, modo } = useStore()
  const [maisAberto, setMaisAberto] = useState(false)
  useEffect(() => {
    if (NAV_MAIS.some((i) => estaAtivo(i, pathname))) setMaisAberto(true)
  }, [pathname])
  const e = dados.empresa

  return (
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col border-r border-line bg-sidebar px-3 py-5 md:flex xl:w-[232px] xl:px-4">
      <Link to="/" className="mb-7 flex justify-center px-1 xl:justify-start xl:px-2" aria-label="Gynfinance, início">
        <span className="xl:hidden">
          <Logo compacto />
        </span>
        <span className="hidden xl:inline">
          <Logo />
        </span>
      </Link>

      <nav aria-label="Principal" className="flex flex-col gap-1">
        {NAV_PRINCIPAL.map((i) => (
          <span key={i.para}>
            <span className="xl:hidden">
              <Item item={i} caminho={pathname} compacto />
            </span>
            <span className="hidden xl:block">
              <Item item={i} caminho={pathname} compacto={false} />
            </span>
          </span>
        ))}

        <button
          onClick={() => setMaisAberto((v) => !v)}
          aria-expanded={maisAberto}
          title="Mais"
          className="flex h-10 items-center justify-center gap-3 rounded-[9px] px-0 text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink xl:justify-start xl:px-3"
        >
          <MoreHorizontal size={19} strokeWidth={1.7} aria-hidden />
          <span className="sr-only xl:not-sr-only">Mais</span>
          <ChevronDown size={15} className={`ml-auto hidden transition-transform duration-150 xl:block ${maisAberto ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {maisAberto && (
          <div className="anim-aparecer flex flex-col gap-1 xl:pl-3">
            {NAV_MAIS.map((i) => (
              <span key={i.para}>
                <span className="xl:hidden">
                  <Item item={i} caminho={pathname} compacto />
                </span>
                <span className="hidden xl:block">
                  <Item item={i} caminho={pathname} compacto={false} />
                </span>
              </span>
            ))}
          </div>
        )}
      </nav>

      <div className="mt-auto">
        {modo === 'demo' && (
          <p className="mb-3 hidden rounded-[9px] bg-primary-soft px-3 py-2 text-[12px] text-primary xl:block">
            Modo demonstração com dados de exemplo.
          </p>
        )}
        <Link
          to="/configuracoes"
          className="flex items-center justify-center gap-3 rounded-[12px] border border-line bg-surface p-2 transition-colors duration-150 hover:border-[#d6dee8] xl:justify-start xl:p-3"
          title={e.nomeFantasia}
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eef2f6] text-slate">
            <UserRound size={18} strokeWidth={1.7} aria-hidden />
          </span>
          <span className="hidden min-w-0 flex-1 xl:block">
            <span className="block truncate text-[13px] font-semibold text-ink">{e.nomeFantasia}</span>
            <span className="block truncate text-[12px] text-ink-2">
              {e.ehMei ? 'MEI' : 'Empresa'} · {ATIVIDADE[e.atividade]}
            </span>
          </span>
          <ChevronRight size={16} className="hidden text-slate xl:block" aria-hidden />
        </Link>
      </div>
    </aside>
  )
}
