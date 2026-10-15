import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { MobileNavigation } from './MobileNavigation'
import { Sidebar } from './Sidebar'

/** Cartões entram um a um ao abrir a tela: mostra a ordem de leitura sem atrasar o uso. */
function useCascata(chave: string) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const itens = ref.current?.querySelectorAll<HTMLElement>('header, .card, [data-entrar]') ?? []
    itens.forEach((el, i) => {
      el.style.animationDelay = `${Math.min(i, 10) * 55}ms`
      el.classList.add('anim-entrar')
    })
  }, [chave])
  return ref
}

export function MainLayout() {
  const { pathname } = useLocation()
  const ref = useCascata(pathname)
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-7 md:pt-8 md:pb-10 xl:px-10">
        <div key={pathname} ref={ref} className="mx-auto max-w-[1240px]">
          <Outlet />
        </div>
      </main>
      <MobileNavigation />
    </div>
  )
}
