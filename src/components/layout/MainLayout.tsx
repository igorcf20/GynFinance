import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { MobileNavigation } from './MobileNavigation'
import { ProtecaoDeErro } from './ProtecaoDeErro'
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
    // Se a animação não andar (aba em segundo plano, moldura pausada), o conteúdo não pode ficar
    // invisível: depois do tempo da cascata, tira a animação de qualquer jeito.
    const t = window.setTimeout(() => itens.forEach((el) => el.classList.remove('anim-entrar')), 1600)
    return () => window.clearTimeout(t)
  }, [chave])
  return ref
}

export function MainLayout() {
  const { pathname } = useLocation()
  const ref = useCascata(pathname)
  const navigate = useNavigate()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-7 md:pt-8 md:pb-10 xl:px-10">
        <div key={pathname} ref={ref} className="mx-auto max-w-[1240px]">
          <ProtecaoDeErro acao={<Button onClick={() => navigate('/')}>Voltar ao início</Button>}>
            <Outlet />
          </ProtecaoDeErro>
        </div>
      </main>
      <MobileNavigation />
    </div>
  )
}
