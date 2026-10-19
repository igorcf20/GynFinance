import { useState, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, UNSAFE_createMemoryHistory, unstable_HistoryRouter as HistoryRouter, useLocation } from 'react-router-dom'
import { LogoMarca } from './components/layout/Logo'
import { SoNoPlano } from './components/layout/AvisosDoPlano'
import { MainLayout } from './components/layout/MainLayout'
import { ProtecaoDeErro } from './components/layout/ProtecaoDeErro'
import { Button } from './components/ui/Button'
import { ToastProvider } from './components/ui/Modal'
import { StoreProvider, useStore } from './data/store'
import { definirPagina } from './lib/erros'
import { dentroDeMoldura, rotaInicial } from './lib/moldura'
import { Entrar } from './pages/Entrar'
import { RedefinirSenha } from './pages/RedefinirSenha'
import { Accounts } from './pages/Accounts'
import { Agenda } from './pages/Agenda'
import { Assistente } from './pages/Assistente'
import { Admin } from './pages/admin/Admin'
import { ImportarExtrato } from './pages/ImportarExtrato'
import { CashFlow } from './pages/CashFlow'
import { Dashboard } from './pages/Dashboard'
import { MEI } from './pages/MEI'
import { MonthlyClosing } from './pages/MonthlyClosing'
import { More } from './pages/More'
import { NewTransaction } from './pages/NewTransaction'
import { Parceiros } from './pages/Parceiros'
import { FichaParceiro } from './pages/FichaParceiro'
import { Onboarding } from './pages/Onboarding'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { Suporte } from './pages/Suporte'
import { Transactions } from './pages/Transactions'

/**
 * Enquanto descobre se há servidor (e quem está logado), mostra só a marca, para não piscar a
 * demonstração antes dos dados do negócio. Logado sem negócio: vai para a configuração inicial.
 */
function Portao({ children }: { children: ReactNode }) {
  const { servidor, conta } = useStore()
  const { pathname } = useLocation()
  // A tela atual vai junto com os erros e com o chamado de suporte.
  definirPagina(pathname)
  if (servidor === 'verificando') {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Carregando">
        <span className="anim-pulso">
          <LogoMarca size={44} />
        </span>
      </div>
    )
  }
  // O superadmin entra no painel mesmo sem ter configurado um negócio próprio.
  if (conta && !conta.temNegocio && pathname !== '/comecar' && pathname !== '/redefinir-senha' && !(conta.admin && pathname === '/admin')) return <Navigate to="/comecar" replace />
  return <>{children}</>
}

/**
 * Na demonstração (dentro de moldura) a navegação fica na memória. Os links apontam para "#",
 * que não muda de tela nem de endereço se o clique escapar do React.
 */
function RoteadorDaMoldura({ children }: { children: ReactNode }) {
  const [historico] = useState(() => {
    const h = UNSAFE_createMemoryHistory({ initialEntries: [rotaInicial()], v5Compat: true })
    return new Proxy(h, { get: (alvo, chave) => (chave === 'createHref' ? () => '#' : Reflect.get(alvo, chave)) })
  })
  return <HistoryRouter history={historico}>{children}</HistoryRouter>
}

// HashRouter: o build roda em qualquer hospedagem estática, sem configurar o servidor.
const Roteador = dentroDeMoldura ? RoteadorDaMoldura : HashRouter

export default function App() {
  return (
    <ProtecaoDeErro acao={<Button onClick={() => window.location.reload()}>Recarregar</Button>}>
    <StoreProvider>
      <ToastProvider>
        <Roteador>
          <Portao>
            <Routes>
              <Route path="entrar" element={<Entrar />} />
              <Route path="redefinir-senha" element={<RedefinirSenha />} />
              <Route path="comecar" element={<Onboarding />} />
              <Route element={<MainLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="assistente" element={<Assistente />} />
                <Route path="lancamentos" element={<Transactions />} />
                <Route path="lancar" element={<NewTransaction />} />
                <Route path="contas" element={<Accounts />} />
                <Route path="agenda" element={<SoNoPlano modulo="agenda"><Agenda /></SoNoPlano>} />
                <Route path="clientes" element={<SoNoPlano modulo="clientes"><Parceiros /></SoNoPlano>} />
                <Route path="clientes/:id" element={<SoNoPlano modulo="clientes"><FichaParceiro /></SoNoPlano>} />
                <Route path="importar" element={<SoNoPlano modulo="extrato"><ImportarExtrato /></SoNoPlano>} />
                <Route path="mei" element={<SoNoPlano modulo="mei"><MEI /></SoNoPlano>} />
                <Route path="relatorios" element={<Reports />} />
                <Route path="fluxo" element={<CashFlow />} />
                <Route path="fechamento" element={<MonthlyClosing />} />
                <Route path="configuracoes/:secao?" element={<Settings />} />
                <Route path="mais" element={<More />} />
                <Route path="admin" element={<Admin />} />
                <Route path="suporte" element={<Suporte />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Portao>
        </Roteador>
      </ToastProvider>
    </StoreProvider>
    </ProtecaoDeErro>
  )
}
