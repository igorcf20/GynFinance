import type { IdModulo } from '../../domain/planos'
import { temModulo } from '../../domain/planos'
import { CalendarCheck, LifeBuoy, CalendarDays, ChartSpline, FileUp, FileChartColumn, FileText, House, ReceiptText, Settings, ShieldCheck, Store, Users, type LucideIcon } from 'lucide-react'

export interface ItemNav {
  para: string
  rotulo: string
  icone: LucideIcon
  /** Outras rotas que deixam este item ativo. */
  tambem?: string[]
  /** Só aparece quando o plano do cliente inclui este módulo. */
  modulo?: IdModulo
  /** Número ao lado do item: contas atrasadas ou respostas do suporte não lidas. */
  selo?: 'atrasadas' | 'suporte'
}

export interface GrupoNav {
  titulo?: string
  itens: ItemNav[]
}

export const NAV_PRINCIPAL: ItemNav[] = [
  { para: '/', rotulo: 'Início', icone: House },
  { para: '/lancamentos', rotulo: 'Lançamentos', icone: ReceiptText, tambem: ['/lancar'] },
  { para: '/contas', rotulo: 'Contas', icone: FileText, selo: 'atrasadas' },
  { para: '/agenda', rotulo: 'Agenda', icone: CalendarDays, modulo: 'agenda' },
  { para: '/clientes', rotulo: 'Clientes', icone: Users, modulo: 'clientes' },
  { para: '/mei', rotulo: 'Meu MEI', icone: Store, modulo: 'mei' },
  { para: '/relatorios', rotulo: 'Relatórios', icone: FileChartColumn },
]

export const NAV_ADMIN: ItemNav = { para: '/admin', rotulo: 'Superadmin', icone: ShieldCheck }

export const NAV_MAIS: ItemNav[] = [
  { para: '/fluxo', rotulo: 'Fluxo de caixa', icone: ChartSpline },
  { para: '/importar', rotulo: 'Importar extrato', icone: FileUp, modulo: 'extrato' },
  { para: '/fechamento', rotulo: 'Fechamento do mês', icone: CalendarCheck },
  { para: '/configuracoes', rotulo: 'Configurações', icone: Settings },
  { para: '/suporte', rotulo: 'Ajuda e suporte', icone: LifeBuoy, selo: 'suporte' },
]

const nav = (para: string) => [...NAV_PRINCIPAL, ...NAV_MAIS].find((i) => i.para === para)!

/** Menu lateral: tudo à vista, separado pelo que a pessoa quer fazer. */
export const GRUPOS_NAV: GrupoNav[] = [
  { itens: [nav('/')] },
  { titulo: 'Dinheiro', itens: ['/lancamentos', '/contas', '/fluxo', '/importar'].map(nav) },
  { titulo: 'Negócio', itens: ['/agenda', '/clientes', '/mei', '/relatorios', '/fechamento'].map(nav) },
  { titulo: 'Ajustes', itens: ['/configuracoes', '/suporte'].map(nav) },
]

/** Tira os itens de módulos que o plano do cliente não tem. */
export const doPlano = (itens: ItemNav[], modulos: IdModulo[] | undefined) => itens.filter((i) => !i.modulo || temModulo(modulos, i.modulo))

export function estaAtivo(item: ItemNav, caminho: string): boolean {
  if (item.para === '/') return caminho === '/'
  return [item.para, ...(item.tambem ?? [])].some((p) => caminho === p || caminho.startsWith(`${p}/`))
}
