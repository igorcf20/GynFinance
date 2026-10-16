import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { ToastProvider } from './components/ui/Modal'
import { StoreProvider } from './data/store'
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

// HashRouter: o build roda em qualquer hospedagem estática, sem configurar o servidor.
export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
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
        </HashRouter>
      </ToastProvider>
    </StoreProvider>
  )
}
