import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { SeloNav, useGruposNav, useSelosNav } from '../components/layout/Sidebar'
import { Card } from '../components/ui/Card'
import { CartaoComecar } from '../components/layout/CartaoComecar'
import { useStore } from '../data/store'
import { TrocaNegocio } from '../components/layout/TrocaNegocio'

/** No celular, o menu completo: os mesmos grupos do menu lateral do computador. */
export function More() {
  const { modo, servidor, conta } = useStore()
  const grupos = useGruposNav()
  const selos = useSelosNav()
  return (
    <>
      <Header titulo="Menu" />
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
      <TrocaNegocio className="mb-4" />
      <div className="flex flex-col gap-4">
        {grupos.map((g, n) => (
          <section key={g.titulo ?? n} aria-label={g.titulo ?? 'Início'}>
            {g.titulo && <h2 className="mb-1.5 px-1 text-[11px] font-bold tracking-[0.08em] text-slate uppercase">{g.titulo}</h2>}
            <Card className="!p-1.5">
              <ul>
                {g.itens.map((i) => {
                  const selo = i.selo ? selos[i.selo] : 0
                  return (
                    <li key={i.para}>
                      <Link to={i.para} className="flex items-center gap-3 rounded-[12px] px-3 py-3 text-ink transition-colors hover:bg-hover active:bg-hover">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                          <i.icone size={19} strokeWidth={1.9} aria-hidden />
                        </span>
                        <span className="flex-1 font-medium">{i.rotulo}</span>
                        <SeloNav item={i} n={selo} />
                        {selo > 0 && <span className="sr-only">({selo})</span>}
                        <ChevronRight size={17} className="text-slate" aria-hidden />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </section>
        ))}
      </div>
    </>
  )
}
