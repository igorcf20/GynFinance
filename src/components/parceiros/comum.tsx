// Peças do módulo Clientes e fornecedores usadas em mais de uma tela.
import { Building2, Truck, UserRound } from 'lucide-react'
import { iniciais } from '../../domain/parceiros'
import type { DataISO, Parceiro, TipoParceiro } from '../../domain/types'
import { addMeses, mesDe } from '../../lib/format'
import type { Periodo } from '../../domain/parceiros'
import { Badge } from '../ui/Badge'

export type IdPeriodo = 'mes' | 'ano' | '12m' | 'tudo'

export const PERIODOS: { valor: IdPeriodo; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'ano', rotulo: 'Este ano' },
  { valor: '12m', rotulo: '12 meses' },
  { valor: 'tudo', rotulo: 'Tudo' },
]

export function periodoDe(id: IdPeriodo, hoje: DataISO): Periodo & { texto: string } {
  if (id === 'mes') return { de: `${mesDe(hoje)}-01`, ate: hoje, texto: 'neste mês' }
  if (id === 'ano') return { de: `${hoje.slice(0, 4)}-01-01`, ate: hoje, texto: `em ${hoje.slice(0, 4)}` }
  if (id === '12m') return { de: `${addMeses(mesDe(hoje), -11)}-01`, ate: hoje, texto: 'nos últimos 12 meses' }
  return { texto: 'desde o começo' }
}

const CORES: Record<TipoParceiro, string> = {
  cliente: 'from-[#e4f7ee] to-[#c9eedb] text-[#0f7a4b]',
  fornecedor: 'from-[#fff1e3] to-[#ffdcbb] text-[#b4560a]',
  ambos: 'from-[#e8f0fe] to-[#cfe0fd] text-[#1f5fd6]',
}

/** Círculo com as iniciais, na cor do tipo (verde cliente, laranja fornecedor, azul os dois). */
export function AvatarParceiro({ p, tamanho = 'md' }: { p: Pick<Parceiro, 'nome' | 'tipo'>; tamanho?: 'md' | 'lg' }) {
  const t = tamanho === 'lg' ? 'size-16 text-[22px]' : 'size-11 text-[15px]'
  return (
    <span aria-hidden className={`inline-flex ${t} shrink-0 items-center justify-center rounded-full bg-gradient-to-b font-extrabold tracking-[-0.02em] ring-2 ring-white ${CORES[p.tipo]}`}>
      {iniciais(p.nome)}
    </span>
  )
}

export function SeloTipo({ tipo }: { tipo: TipoParceiro }) {
  if (tipo === 'cliente') return <Badge tom="verde" icone={<UserRound size={12} />}>Cliente</Badge>
  if (tipo === 'fornecedor') return <Badge tom="ambar" icone={<Truck size={12} />}>Fornecedor</Badge>
  return <Badge tom="azul" icone={<Building2 size={12} />}>Cliente e fornecedor</Badge>
}
