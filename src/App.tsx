import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LogoMarca } from './components/layout/Logo'
import { MainLayout } from './components/layout/MainLayout'
import { ToastProvider } from './components/ui/Modal'
import { StoreProvider, useStore } from './data/store'
import { Entrar } from './pages/Entrar'
import { Accounts } from './pages/Accounts'
import { CashFlow } from './pages/CashFlow'
import { Dashboard } from './pages/Dashboard'
import { MEI } from './pages/MEI'
import { MonthlyClosing } from './pages/MonthlyClosing'
import { More } from './pages/More'
import { NewTransaction } from './pages/NewTransaction'
import { Onboarding } from './pages/Onboarding'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { Transactions } from './pages/Transactions'

/**
 * Enquanto descobre se há servidor (e quem está logado), mostra só a marca, para não piscar a
 * demonstração antes dos dados do negócio. Logado sem negócio: vai para a configuração inicial.
 */
function Portao({ children }: { children: ReactNode }) {
  const { servidor, conta } = useStore()
  const { pathname } = useLocation()
  if (servidor === 'verificando') {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Carregando">
        <span className="anim-pulso">
          <LogoMarca size={44} />
        </span>
      </div>
    )
  }
  if (conta && !conta.temNegocio && pathname !== '/comecar') return <Navigate to="/comecar" replace />
  return <>{children}</>
}

// HashRouter: o build roda em qualquer hospedagem estática, sem configurar o servidor.
export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <HashRouter>
          <Portao>
            <Routes>
              <Route path="entrar" element={<Entrar />} />
              <Route path="comecar" element={<Onboarding />} />
              <Route element={<MainLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="lancamentos" element={<Transactions />} />
                <Route path="lancar" element={<NewTransaction />} />
                <Route path="contas" element={<Accounts />} />
                <Route path="mei" element={<MEI />} />
                <Route path="relatorios" element={<Reports />} />
                <Route path="fluxo" element={<CashFlow />} />
                <Route path="fechamento" element={<MonthlyClosing />} />
                <Route path="configuracoes/:secao?" element={<Settings />} />
                <Route path="mais" element={<More />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Portao>
        </HashRouter>
      </ToastProvider>
    </StoreProvider>
  )
}
