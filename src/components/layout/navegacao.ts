import { CalendarCheck, CalendarDays, ChartSpline, FileUp, FileChartColumn, FileText, House, ReceiptText, Settings, Store, type LucideIcon } from 'lucide-react'

export interface ItemNav {
  para: string
  rotulo: string
  icone: LucideIcon
  /** Outras rotas que deixam este item ativo. */
  tambem?: string[]
}

export const NAV_PRINCIPAL: ItemNav[] = [
  { para: '/', rotulo: 'Início', icone: House },
  { para: '/lancamentos', rotulo: 'Lançamentos', icone: ReceiptText, tambem: ['/lancar'] },
  { para: '/contas', rotulo: 'Contas', icone: FileText },
  { para: '/agenda', rotulo: 'Agenda', icone: CalendarDays },
  { para: '/mei', rotulo: 'Meu MEI', icone: Store },
  { para: '/relatorios', rotulo: 'Relatórios', icone: FileChartColumn },
]

export const NAV_MAIS: ItemNav[] = [
  { para: '/fluxo', rotulo: 'Fluxo de caixa', icone: ChartSpline },
  { para: '/importar', rotulo: 'Importar extrato', icone: FileUp },
  { para: '/fechamento', rotulo: 'Fechamento do mês', icone: CalendarCheck },
  { para: '/configuracoes', rotulo: 'Configurações', icone: Settings },
]

export function estaAtivo(item: ItemNav, caminho: string): boolean {
  if (item.para === '/') return caminho === '/'
  return [item.para, ...(item.tambem ?? [])].some((p) => caminho === p || caminho.startsWith(`${p}/`))
}
