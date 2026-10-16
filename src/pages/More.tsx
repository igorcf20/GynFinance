import { BarChart3, CalendarDays, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { doPlano, NAV_ADMIN, NAV_MAIS, NAV_PRINCIPAL } from '../components/layout/navegacao'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { CartaoComecar } from '../components/layout/CartaoComecar'
import { useStore } from '../data/store'

/** No celular, tudo o que não cabe na barra inferior. */
export function More() {
  const { modo, servidor, conta, modulos } = useStore()
  const itens = [
    ...doPlano([{ ...NAV_PRINCIPAL.find((i) => i.para === '/agenda')!, icone: CalendarDays }, { para: '/relatorios', rotulo: 'Relatórios', icone: BarChart3 }, ...NAV_MAIS], modulos),
    ...(conta?.admin || servidor === 'sem' ? [NAV_ADMIN] : []),
  ]
  return (
    <>
      <Header titulo="Mais" />
      {modo === 'demo' && (
        <div className="mb-4">
          <CartaoComecar />
          {servidor === 'com' && !conta && (
            <Link to="/entrar" className="mt-3 block text-center text-[13px] font-semibold text-ink-2">
              Já tem conta? Entrar
            </Link>
          )}
        </div>
      )}
      <Card className="!p-2">
        <ul>
          {itens.map((i) => (
            <li key={i.para}>
              <Link to={i.para} className="flex items-center gap-3 rounded-[12px] px-3 py-3.5 text-ink hover:bg-hover">
                <i.icone size={20} strokeWidth={1.7} className="text-slate" aria-hidden />
                <span className="flex-1 font-medium">{i.rotulo}</span>
                <ChevronRight size={17} className="text-slate" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
