import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { FluxoChart, PrevisaoChart } from '../components/financial/charts'
import { Explica } from '../components/ui/Explica'
import { previsaoCaixa } from '../domain/planejamento'
import { Header } from '../components/layout/Header'
import { Card, CardTitulo } from '../components/ui/Card'
import { Input } from '../components/ui/Field'
import { Segmentado } from '../components/ui/Tabs'
import { resumoMes, serieMensal } from '../domain/calc'
import { useStore } from '../data/store'
import { addMeses, brl, capitalizar, diaMes, mesAno, nomeMesCurto } from '../lib/format'

type Periodo = '3' | '6' | '12' | 'custom'

export function CashFlow() {
  const { dados, hoje } = useStore()
  const atual = hoje.slice(0, 7)
  const [periodo, setPeriodo] = useState<Periodo>('6')
  const [de, setDe] = useState(addMeses(atual, -5))
  const [ate, setAte] = useState(atual)

  let serie = periodo === 'custom' ? [] : serieMensal(dados.lancamentos, atual, Number(periodo))
  if (periodo === 'custom') {
    const [ini, fim] = de <= ate ? [de, ate] : [ate, de]
    for (let m = ini; m <= fim && serie.length < 36; m = addMeses(m, 1)) serie.push(resumoMes(dados.lancamentos, m))
  }
  serie = serie.filter((r) => r.mes >= dados.empresa.dataAbertura.slice(0, 7))
  const totalE = serie.reduce((t, r) => t + r.entrou, 0)
  const totalS = serie.reduce((t, r) => t + r.saiu, 0)
  const [dias, setDias] = useState<'30' | '60'>('60')
  const prev = previsaoCaixa(dados, hoje, Number(dias))
  const fim = prev.pontos.at(-1)!

  return (
    <>
      <Header titulo="Fluxo de caixa" subtitulo="O que vem pela frente e quanto entrou e saiu a cada mês." />
      <Card className="mb-5 md:!p-7">
        <CardTitulo
          explica={
            <Explica titulo="Vai faltar dinheiro?" conta={<>Hoje {brl(prev.hoje)} + a receber − a pagar, dia a dia</>}>
              Parte do saldo do caixa de hoje (sem a reserva) e soma o que vence: o que você tem a receber entra no dia do vencimento, o que tem a pagar sai no dia do
              vencimento. Contas a pagar já atrasadas saem hoje. O que clientes já deviam e não pagaram fica de fora, porque ninguém sabe quando chega.
            </Explica>
          }
          acao={
            <Segmentado
              rotulo="Dias da previsão"
              valor={dias}
              onChange={setDias}
              opcoes={[
                { valor: '30', rotulo: '30 dias' },
                { valor: '60', rotulo: '60 dias' },
              ]}
            />
          }
        >
          Vai faltar dinheiro?
        </CardTitulo>
        {prev.primeiroNegativo ? (
          <p className="mb-4 flex items-start gap-2.5 rounded-[14px] border border-[#f6d3d9] bg-[#fdf5f6] px-4 py-3 text-[14px] text-ink">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
            <span>
              Se nada mudar, no dia <b>{diaMes(prev.primeiroNegativo.dia)}</b> o caixa fica <b className="text-danger">{brl(-prev.primeiroNegativo.saldo)} no vermelho</b>. O pior
              dia é {diaMes(prev.menor.dia)}, com {brl(prev.menor.saldo)}. Cobre quem deve, adie uma conta ou separe dinheiro antes.
            </span>
          </p>
        ) : (
          <p className="mb-4 flex items-start gap-2.5 rounded-[14px] border border-[#cdebd9] bg-[#f3fbf6] px-4 py-3 text-[14px] text-ink">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" aria-hidden />
            <span>
              O caixa não fica negativo nos próximos {dias} dias. O menor saldo é {brl(prev.menor.saldo)}, no dia {diaMes(prev.menor.dia)}, e termina o período com{' '}
              <b>{brl(fim.saldo)}</b>.
            </span>
          </p>
        )}
        <PrevisaoChart pontos={prev.pontos} />
        {prev.atrasadoReceber > 0 && (
          <p className="mt-3 text-[12px] text-ink-2">Ficaram de fora {brl(prev.atrasadoReceber)} que clientes já deviam. Se receber, a linha sobe.</p>
        )}
      </Card>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Segmentado
          rotulo="Período"
          valor={periodo}
          onChange={setPeriodo}
          className="w-full sm:w-auto"
          opcoes={[
            { valor: '3', rotulo: '3 meses' },
            { valor: '6', rotulo: '6 meses' },
            { valor: '12', rotulo: '12 meses' },
            { valor: 'custom', rotulo: 'Escolher' },
          ]}
        />
        {periodo === 'custom' && (
          <div className="anim-aparecer grid grid-cols-2 gap-3">
            <Input label="De" type="month" value={de} max={atual} onChange={(e) => e.target.value && setDe(e.target.value)} />
            <Input label="Até" type="month" value={ate} max={atual} onChange={(e) => e.target.value && setAte(e.target.value)} />
          </div>
        )}
      </div>

      <Card className="mb-5 md:!p-7">
        <CardTitulo>Entradas e saídas</CardTitulo>
        <FluxoChart serie={serie} />
      </Card>

      <Card className="!p-0">
        <div className="relative overflow-x-auto">
          <table className="w-full text-left text-[13px] sm:min-w-[480px] sm:text-[14px]">
            <caption className="sr-only">Resultado por mês</caption>
            <thead>
              <tr className="border-b border-line bg-[#fafbfd] text-[13px] text-[#3d5170]">
                <th scope="col" className="px-4 sm:px-5 py-3 font-medium">Mês</th>
                <th scope="col" className="px-2 sm:px-3 py-3 text-right font-medium">Entradas</th>
                <th scope="col" className="px-2 sm:px-3 py-3 text-right font-medium">Saídas</th>
                <th scope="col" className="px-4 sm:px-5 py-3 text-right font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {[...serie].reverse().map((r) => (
                <tr key={r.mes} className="border-b border-line transition-colors last:border-0 hover:bg-[#f7faff]">
                  <th scope="row" className="px-4 sm:px-5 py-3.5 font-semibold text-ink">
                    <span className="sm:hidden">{`${capitalizar(nomeMesCurto(r.mes))}/${r.mes.slice(2, 4)}`}</span>
                    <span className="hidden sm:inline">{mesAno(r.mes)}</span>
                  </th>
                  <td className="num px-2 sm:px-3 py-3.5 text-right font-semibold text-success">{brl(r.entrou)}</td>
                  <td className="num px-2 sm:px-3 py-3.5 text-right font-semibold text-danger">{brl(r.saiu)}</td>
                  <td className={`num px-4 sm:px-5 py-3.5 text-right font-bold ${r.sobrou < 0 ? 'text-danger' : 'text-ink'}`}>{brl(r.sobrou)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-gradient-to-r from-[#f1f6fe] to-[#f8fafd]">
                <th scope="row" className="px-4 sm:px-5 py-3 font-semibold text-ink">Total</th>
                <td className="num px-2 sm:px-3 py-3 text-right font-semibold text-success">{brl(totalE)}</td>
                <td className="num px-2 sm:px-3 py-3 text-right font-semibold text-danger">{brl(totalS)}</td>
                <td className="num px-4 sm:px-5 py-3 text-right font-bold text-ink">{brl(totalE - totalS)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  )
}
