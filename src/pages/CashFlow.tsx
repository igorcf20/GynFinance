import { useState } from 'react'
import { FluxoChart } from '../components/financial/charts'
import { Header } from '../components/layout/Header'
import { Card, CardTitulo } from '../components/ui/Card'
import { Input } from '../components/ui/Field'
import { Segmentado } from '../components/ui/Tabs'
import { resumoMes, serieMensal } from '../domain/calc'
import { useStore } from '../data/store'
import { addMeses, brl, mesAno } from '../lib/format'

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

  return (
    <>
      <Header titulo="Fluxo de caixa" subtitulo="Quanto entrou e saiu a cada mês." />
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[14px]">
            <caption className="sr-only">Resultado por mês</caption>
            <thead>
              <tr className="border-b border-line bg-[#fafbfd] text-[13px] text-[#3d5170]">
                <th scope="col" className="px-5 py-3 font-medium">Mês</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Entradas</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Saídas</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {[...serie].reverse().map((r) => (
                <tr key={r.mes} className="border-b border-line transition-colors last:border-0 hover:bg-[#f7faff]">
                  <th scope="row" className="px-5 py-3.5 font-semibold text-ink">{mesAno(r.mes)}</th>
                  <td className="num px-3 py-3.5 text-right font-semibold text-success">{brl(r.entrou)}</td>
                  <td className="num px-3 py-3.5 text-right font-semibold text-danger">{brl(r.saiu)}</td>
                  <td className={`num px-5 py-3.5 text-right font-bold ${r.sobrou < 0 ? 'text-danger' : 'text-ink'}`}>{brl(r.sobrou)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-gradient-to-r from-[#f1f6fe] to-[#f8fafd]">
                <th scope="row" className="px-5 py-3 font-semibold text-ink">Total</th>
                <td className="num px-3 py-3 text-right font-semibold text-success">{brl(totalE)}</td>
                <td className="num px-3 py-3 text-right font-semibold text-danger">{brl(totalS)}</td>
                <td className="num px-5 py-3 text-right font-bold text-ink">{brl(totalE - totalS)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  )
}
