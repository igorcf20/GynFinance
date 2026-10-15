import { ArrowDownRight, ArrowUpRight, UserRound } from 'lucide-react'
import type { ResumoMes } from '../../domain/calc'
import { brl } from '../../lib/format'
import { Card, IconeBox } from '../ui/Card'

/** Os três números do mês: entrou, saiu e retirei. */
export function FinancialSummary({ r }: { r: ResumoMes }) {
  const itens = [
    { rotulo: 'Entrou', valor: r.entrou, texto: 'Total de vendas e outras entradas.', cor: 'text-success', icone: <ArrowUpRight size={19} strokeWidth={1.8} />, tom: 'verde' as const },
    { rotulo: 'Saiu', valor: r.saiu, texto: 'Total de despesas do mês.', cor: 'text-danger', icone: <ArrowDownRight size={19} strokeWidth={1.8} />, tom: 'vermelho' as const },
    { rotulo: 'Retirei', valor: r.retirei, texto: 'Pró-labore para você.', cor: 'text-primary', icone: <UserRound size={19} strokeWidth={1.7} />, tom: 'azul' as const },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
      {itens.map((i) => (
        <Card key={i.rotulo} interativo className="flex items-center gap-4 !p-4 sm:block md:!p-5">
          <IconeBox tom={i.tom} className="sm:mb-3">
            {i.icone}
          </IconeBox>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">{i.rotulo}</p>
            <p className={`num text-[22px] font-bold sm:text-[23px] ${i.cor}`}>{brl(i.valor)}</p>
            <p className="text-[12px] text-ink-2">{i.texto}</p>
          </div>
        </Card>
      ))}
    </div>
  )
}
