import { AlarmClock, CheckCircle2, ChevronRight, HandCoins } from 'lucide-react'
import { Link } from 'react-router-dom'
import { aReceberFuturo, emAtraso } from '../../domain/calc'
import type { DataISO, Lancamento } from '../../domain/types'
import { brl, diaMes } from '../../lib/format'
import { Card, IconeBox } from '../ui/Card'
import { Explica } from '../ui/Explica'
import { ValorAnimado } from '../ui/ValorAnimado'

const contas = (n: number) => `${n} conta${n === 1 ? '' : 's'}`

/** Painel: quanto ainda vai entrar (contas a receber em dia) e o que está atrasado dos dois lados. */
export function ReceberEAtraso({ lancamentos, hoje }: { lancamentos: Lancamento[]; hoje: DataISO }) {
  const futuro = aReceberFuturo(lancamentos, hoje)
  const atraso = emAtraso(lancamentos, hoje)
  const nadaAtrasado = !atraso.receber.quantidade && !atraso.pagar.quantidade
  const proxima = futuro.proxima

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5">
      <Card interativo className="relative flex flex-col">
        <div className="flex items-start gap-3.5">
          <IconeBox tom="verde">
            <HandCoins size={21} strokeWidth={2.1} />
          </IconeBox>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[14px] font-bold text-ink">
              <Link to="/contas?aba=receber" className="after:absolute after:inset-0 after:rounded-[18px]">
                A receber
              </Link>
              <span className="relative z-10">
                <Explica titulo="A receber">
                  Tudo o que clientes ainda vão pagar e que não venceu: vendas a prazo, parcelas e atendimentos marcados com valor. As que já passaram do dia ficam no
                  cartão "Em atraso".
                </Explica>
              </span>
            </p>
            <p className="valor-grande mt-1 text-[26px] text-success">
              <ValorAnimado centavos={futuro.total} />
            </p>
          </div>
          <ChevronRight size={20} className="mt-1 shrink-0 text-navy transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
        </div>
        <p className="mt-3 text-[13px] text-ink-2">
          {futuro.quantidade ? (
            <>
              <b className="num text-ink">{brl(futuro.em30Dias)}</b> nos próximos 30 dias · {contas(futuro.quantidade)}
              {proxima && (
                <span className="mt-0.5 block truncate">
                  Próxima: {proxima.contraparte || proxima.descricao}, {proxima.dataVencimento === hoje ? 'hoje' : diaMes(proxima.dataVencimento!)}
                </span>
              )}
            </>
          ) : (
            'Nenhuma venda a prazo em aberto.'
          )}
        </p>
      </Card>

      <Card interativo className={`relative flex flex-col ${nadaAtrasado ? '' : '!border-[#f6d3d9]'}`}>
        <div className="flex items-start gap-3.5">
          <IconeBox tom={nadaAtrasado ? 'verde' : 'vermelho'}>{nadaAtrasado ? <CheckCircle2 size={21} strokeWidth={2.1} /> : <AlarmClock size={21} strokeWidth={2.1} />}</IconeBox>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[14px] font-bold text-ink">
              <Link to={atraso.receber.total >= atraso.pagar.total && atraso.receber.quantidade ? '/contas?aba=receber' : '/contas'} className="after:absolute after:inset-0 after:rounded-[18px]">
                Em atraso
              </Link>
              <span className="relative z-10">
                <Explica titulo="Em atraso">
                  Contas que passaram do vencimento e ainda não foram marcadas como pagas ou recebidas. Cobre quem deve para você e acerte o que você deve para
                  não pagar juros.
                </Explica>
              </span>
            </p>
            {nadaAtrasado ? (
              <p className="mt-1 text-[18px] font-bold text-success">Nada atrasado</p>
            ) : (
              <p className="valor-grande mt-1 text-[26px] text-danger">
                <ValorAnimado centavos={atraso.receber.total + atraso.pagar.total} />
              </p>
            )}
          </div>
          <ChevronRight size={20} className="mt-1 shrink-0 text-navy transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
        </div>
        {nadaAtrasado ? (
          <p className="mt-3 text-[13px] text-ink-2">Todas as contas vencidas foram pagas e recebidas.</p>
        ) : (
          <dl className="num mt-3 grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-[10px] bg-[#f5f9f7] px-2.5 py-1.5">
              <dt className="text-ink-2">Para receber</dt>
              <dd className="font-bold text-ink">
                {brl(atraso.receber.total)} <span className="font-medium text-ink-2">· {atraso.receber.quantidade}</span>
              </dd>
            </div>
            <div className="rounded-[10px] bg-[#fdf5f6] px-2.5 py-1.5">
              <dt className="text-ink-2">Para pagar</dt>
              <dd className="font-bold text-ink">
                {brl(atraso.pagar.total)} <span className="font-medium text-ink-2">· {atraso.pagar.quantidade}</span>
              </dd>
            </div>
          </dl>
        )}
      </Card>
    </div>
  )
}
