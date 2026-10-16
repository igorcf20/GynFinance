import type { IdModulo } from '../../domain/planos'
import { temModulo } from '../../domain/planos'
import { CalendarCheck, LifeBuoy, CalendarDays, ChartSpline, FileUp, FileChartColumn, FileText, House, ReceiptText, Settings, ShieldCheck, Store, type LucideIcon } from 'lucide-react'

export interface ItemNav {
  para: string
  rotulo: string
  icone: LucideIcon
  /** Outras rotas que deixam este item ativo. */
  tambem?: string[]
  /** Só aparece quando o plano do cliente inclui este módulo. */
  modulo?: IdModulo
}

export const NAV_PRINCIPAL: ItemNav[] = [
  { para: '/', rotulo: 'Início', icone: House },
  { para: '/lancamentos', rotulo: 'Lançamentos', icone: ReceiptText, tambem: ['/lancar'] },
  { para: '/contas', rotulo: 'Contas', icone: FileText },
  { para: '/agenda', rotulo: 'Agenda', icone: CalendarDays, modulo: 'agenda' },
  { para: '/mei', rotulo: 'Meu MEI', icone: Store, modulo: 'mei' },
  { para: '/relatorios', rotulo: 'Relatórios', icone: FileChartColumn },
]

export const NAV_ADMIN: ItemNav = { para: '/admin', rotulo: 'Superadmin', icone: ShieldCheck }

export const NAV_MAIS: ItemNav[] = [
  { para: '/fluxo', rotulo: 'Fluxo de caixa', icone: ChartSpline },
  { para: '/importar', rotulo: 'Importar extrato', icone: FileUp, modulo: 'extrato' },
  { para: '/fechamento', rotulo: 'Fechamento do mês', icone: CalendarCheck },
  { para: '/configuracoes', rotulo: 'Configurações', icone: Settings },
  { para: '/suporte', rotulo: 'Ajuda e suporte', icone: LifeBuoy },
]

/** Tira os itens de módulos que o plano do cliente não tem. */
export const doPlano = (itens: ItemNav[], modulos: IdModulo[] | undefined) => itens.filter((i) => !i.modulo || temModulo(modulos, i.modulo))

export function estaAtivo(item: ItemNav, caminho: string): boolean {
  if (item.para === '/') return caminho === '/'
  return [item.para, ...(item.tambem ?? [])].some((p) => caminho === p || caminho.startsWith(`${p}/`))
}
