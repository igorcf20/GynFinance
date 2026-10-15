import {
  Boxes,
  Briefcase,
  CirclePlus,
  CreditCard,
  FileText,
  House,
  Landmark,
  Lightbulb,
  Megaphone,
  Package,
  PiggyBank,
  Receipt,
  ShoppingBag,
  Truck,
  UserRound,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { Categoria, Lancamento } from '../../domain/types'
import { IconeBox, type TomIcone } from '../ui/Card'

const ICONE: Record<string, LucideIcon> = {
  vendas: ShoppingBag,
  servicos: Briefcase,
  'outras-entradas': CirclePlus,
  mercadoria: Boxes,
  aluguel: House,
  internet: Wifi,
  luz: Lightbulb,
  contador: FileText,
  sistema: Zap,
  transporte: Truck,
  embalagem: Package,
  maquininha: CreditCard,
  marketing: Megaphone,
  manutencao: Wrench,
  das: Receipt,
  prolabore: UserRound,
}

const TOM_GRUPO: Record<Categoria['grupo'], TomIcone> = {
  receita: 'verde',
  custo: 'laranja',
  despesa_fixa: 'vermelho',
  despesa_variavel: 'laranja',
  imposto: 'azul',
  retirada: 'azul',
}

/** Ícone colorido da categoria, usado no extrato. */
export function IconeCategoria({ l, categorias }: { l: Lancamento; categorias: Categoria[] }) {
  if (l.natureza === 'transferencia')
    return (
      <IconeBox tom="azul" className="!size-8">
        <PiggyBank size={15} strokeWidth={2.1} />
      </IconeBox>
    )
  const c = categorias.find((x) => x.id === l.categoriaId)
  const Icone = (l.categoriaId && ICONE[l.categoriaId]) || (l.natureza === 'aporte' ? Landmark : FileText)
  const tom: TomIcone = c ? TOM_GRUPO[c.grupo] : l.natureza === 'entrada' ? 'verde' : 'neutro'
  return (
    <IconeBox tom={tom} className="!size-8">
      <Icone size={15} strokeWidth={2.1} />
    </IconeBox>
  )
}
