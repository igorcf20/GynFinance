import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { MobileNavigation } from './MobileNavigation'
import { Sidebar } from './Sidebar'

export function MainLayout() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-7 md:pt-8 md:pb-10 xl:px-10">
        <div key={pathname} className="anim-aparecer mx-auto max-w-[1240px]">
          <Outlet />
        </div>
      </main>
      <MobileNavigation />
    </div>
  )
}
