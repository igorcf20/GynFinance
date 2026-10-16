import { Plus } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../../data/store'
import { estaAtivo, NAV_PRINCIPAL } from './navegacao'

/** Abaixo de 768px a sidebar vira esta barra inferior, com o botão de lançar no centro. */
export function MobileNavigation() {
  const { pathname } = useLocation()
  const { dados } = useStore()
  const item = (para: string) => NAV_PRINCIPAL.find((i) => i.para === para)!
  const [inicio, lancamentos, contas, mei, relatorios] = ['/', '/lancamentos', '/contas', '/mei', '/relatorios'].map(item)
  // Meu MEI só aparece para MEI; para os outros, o quarto lugar fica com Relatórios.
  const itens = [inicio, lancamentos, null, contas, dados.empresa.ehMei ? mei : relatorios]
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
                className="-mt-6 inline-flex size-14 items-center justify-center rounded-full grad-primario text-white ring-4 ring-white transition-all duration-300 active:scale-90 active:rotate-90"
              >
                <Plus size={26} strokeWidth={2.2} />
              </Link>
            </li>
          ) : (
            <li key={i.para}>
              <NavLink
                to={i.para}
                className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition-colors duration-200 active:scale-95 ${estaAtivo(i, pathname) ? 'font-bold text-primary' : 'text-[#3d5170]'}`}
              >
                <span className={`inline-flex h-7 w-12 items-center justify-center rounded-full transition-all duration-300 ${estaAtivo(i, pathname) ? 'bg-primary-soft' : ''}`}>
                  <i.icone size={21} strokeWidth={estaAtivo(i, pathname) ? 2.2 : 1.8} aria-hidden />
                </span>
                {i.rotulo}
              </NavLink>
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}
