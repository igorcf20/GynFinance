import { Plus } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { estaAtivo, NAV_PRINCIPAL } from './navegacao'

/** Abaixo de 768px a sidebar vira esta barra inferior, com o botão de lançar no centro. */
export function MobileNavigation() {
  const { pathname } = useLocation()
  const [inicio, lancamentos, contas, mei] = NAV_PRINCIPAL
  const itens = [inicio, lancamentos, null, contas, mei]
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 shadow-[0_-8px_24px_-12px_rgba(31,63,120,0.18)] pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {itens.map((i) =>
          i === null ? (
            <li key="lancar" className="flex justify-center">
              <Link
                to="/lancar"
                aria-label="Novo lançamento"
                className="-mt-6 inline-flex size-14 items-center justify-center rounded-full grad-primario text-white ring-4 ring-white transition-all duration-150 active:brightness-95"
              >
                <Plus size={26} strokeWidth={2.2} />
              </Link>
            </li>
          ) : (
            <li key={i.para}>
              <NavLink
                to={i.para}
                className={`flex flex-col items-center gap-1 py-1 text-[11px] font-medium ${estaAtivo(i, pathname) ? 'font-bold text-primary' : 'text-[#3d5170]'}`}
              >
                <i.icone size={22} strokeWidth={estaAtivo(i, pathname) ? 2.2 : 1.8} aria-hidden />
                {i.rotulo}
              </NavLink>
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}
