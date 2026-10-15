import { ArrowDown, ArrowUpRight, UserRound } from 'lucide-react'
import type { ResumoMes } from '../../domain/calc'
import { Card, IconeBox } from '../ui/Card'
import { Explica } from '../ui/Explica'
import { ValorAnimado } from '../ui/ValorAnimado'

/** Os três números do mês: entrou, saiu e retirei. */
export function FinancialSummary({ r }: { r: ResumoMes }) {
  const itens = [
    { rotulo: 'Entrou', valor: r.entrou, texto: 'Total de vendas e outras entradas.', ajuda: 'Todo dinheiro que caiu no caixa ou no banco neste mês: vendas, serviços e outras entradas. Vendas a prazo só contam quando o cliente paga.', cor: 'text-success', icone: <ArrowUpRight size={21} strokeWidth={2.4} />, tom: 'verde' as const },
    { rotulo: 'Saiu', valor: r.saiu, texto: 'Total de despesas do mês.', ajuda: 'Tudo o que o negócio pagou neste mês: mercadoria, aluguel, contas, impostos. Não entra aqui o que você tirou para você nem o que separou para a reserva.', cor: 'text-danger', icone: <ArrowDown size={20} strokeWidth={2.4} />, tom: 'vermelho' as const },
    { rotulo: 'Retirei', valor: r.retirei, texto: 'Pró-labore para você.', ajuda: 'O que você tirou do negócio para a sua vida pessoal. Fica separado das despesas para você ver se está tirando mais do que o negócio gera.', cor: 'text-primary', icone: <UserRound size={20} strokeWidth={2.2} />, tom: 'azul' as const },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
      {itens.map((i) => (
        <Card key={i.rotulo} interativo className="flex items-center gap-4 !p-4 sm:block md:!p-5">
          <IconeBox tom={i.tom} className="sm:mb-3.5">
            {i.icone}
          </IconeBox>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[14px] font-bold text-ink">
              {i.rotulo}
              <Explica titulo={i.rotulo}>{i.ajuda}</Explica>
            </p>
            <p className={`valor-grande mt-1 text-[24px] sm:text-[26px] ${i.cor}`}><ValorAnimado centavos={i.valor} /></p>
            <p className="mt-1.5 text-[13px] text-ink-2">{i.texto}</p>
          </div>
        </Card>
      ))}
    </div>
  )
}
