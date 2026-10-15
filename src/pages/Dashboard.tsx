import { AlertTriangle, ArrowUpRight, ArrowDownRight, ChevronRight, CalendarClock, Info, PiggyBank, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SaldoSparkline, SobrouMesesChart } from '../components/financial/charts'
import { ContaItem } from '../components/financial/ContaItem'
import { FinancialSummary } from '../components/financial/FinancialSummary'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardTitulo, EstadoVazio, IconeBox } from '../components/ui/Card'
import { Modal, useToast } from '../components/ui/Modal'
import { alertas, fraseSobrou, gastosPorCategoria, proximos7Dias, reservaPendente, resumoMes, saldoCaixa, serieMensal, variacao } from '../domain/calc'
import { useStore } from '../data/store'
import { addDias, addMeses, brl, nomeMes, pct } from '../lib/format'

export function Dashboard() {
  const { dados, hoje, mes, separarReserva } = useStore()
  const toast = useToast()
  const [confirmarReserva, setConfirmarReserva] = useState(false)

  const r = resumoMes(dados.lancamentos, mes)
  const anterior = resumoMes(dados.lancamentos, addMeses(mes, -1))
  const v = variacao(r.sobrou, anterior.sobrou)
  const maiores = gastosPorCategoria(dados.lancamentos, dados.categorias, mes).map((g) => g.nome)
  const serie = serieMensal(dados.lancamentos, mes, 5)
  const saldo = saldoCaixa(dados)
  const proximos = proximos7Dias(dados.lancamentos, hoje)
  const avisos = alertas(dados, hoje)
  const reserva = reservaPendente(dados.lancamentos, mes)
  const ehMesAtual = mes === hoje.slice(0, 7)
  const pontosSaldo = Array.from({ length: 31 }, (_, i) => {
    const dia = addDias(hoje, (i - 30) * 3)
    return { dia, saldo: saldoCaixa(dados, dia) }
  })

  return (
    <>
      <Header titulo={`Olá, ${dados.empresa.nomeDono}`} subtitulo={`${dados.empresa.nomeFantasia} · ${dados.empresa.ehMei ? 'MEI' : 'Empresa'}`} periodo />

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-4 md:gap-5">
          {/* Cartão principal */}
          <Card className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                Sobrou no mês
                <span title="Entradas menos saídas do negócio no mês, sem contar o que você retirou." className="text-slate">
                  <Info size={15} aria-label="O que é" />
                </span>
              </p>
              <p className={`num mt-1 text-[34px] leading-tight font-bold md:text-[36px] ${r.sobrou < 0 ? 'text-danger' : 'text-ink'}`}>{brl(r.sobrou)}</p>
              {v !== null && (
                <div className="mt-2">
                  <Badge tom={v >= 0 ? 'verde' : 'vermelho'} icone={v >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}>
                    {v >= 0 ? '+' : ''}
                    {pct(v)} vs. {nomeMes(addMeses(mes, -1))}
                  </Badge>
                </div>
              )}
              <p className="mt-3 text-[13px] text-ink-2">{fraseSobrou(r, maiores)}</p>
            </div>
            <div className="w-full sm:w-[220px]">
              <SobrouMesesChart serie={serie} />
            </div>
          </Card>

          <FinancialSummary r={r} />

          <Link to="/relatorios" className="block">
            <Card interativo className="flex items-center gap-4">
              <IconeBox tom="azul">
                <Wallet size={20} strokeWidth={1.7} />
              </IconeBox>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">Saldo do caixa hoje</p>
                <p className="num text-[23px] font-bold text-ink">{brl(saldo)}</p>
              </div>
              <div className="ml-auto hidden w-48 sm:block">
                <SaldoSparkline pontos={pontosSaldo} />
              </div>
              <ChevronRight size={18} className="shrink-0 text-slate" aria-hidden />
            </Card>
          </Link>
        </div>

        <div className="flex flex-col gap-4 md:gap-5">
          <Card>
            <CardTitulo
              acao={
                <Link to="/contas" className="text-[13px] font-semibold text-primary hover:underline">
                  Ver todos
                </Link>
              }
            >
              Próximos 7 dias
            </CardTitulo>
            {proximos.length === 0 ? (
              <EstadoVazio icone={<CalendarClock size={22} />} titulo="Nada vencendo esta semana" texto="Quando você lançar contas a pagar ou a receber, elas aparecem aqui." />
            ) : (
              <ul className="-my-3.5 divide-y divide-line">
                {proximos.slice(0, 3).map((c) => (
                  <ContaItem key={c.id} conta={c} compacto />
                ))}
              </ul>
            )}
          </Card>

          {avisos.map((a) => (
            <div
              key={a.id}
              className={`flex items-center gap-3 rounded-[14px] border px-4 py-3.5 ${
                a.nivel === 'perigo' ? 'border-[#f6d3d8] bg-danger-soft' : a.nivel === 'atencao' ? 'border-[#f3e0bf] bg-warning-soft' : 'border-[#d6e4fb] bg-primary-soft'
              }`}
            >
              <span className={a.nivel === 'perigo' ? 'text-danger' : a.nivel === 'atencao' ? 'text-warning' : 'text-primary'}>
                <AlertTriangle size={19} strokeWidth={1.8} aria-hidden />
              </span>
              <p className="flex-1 text-[13px] font-medium text-ink">{a.texto}</p>
              {a.acao && (
                <Link to={a.acao.para} className="rounded-[9px] bg-white/70 px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-white">
                  {a.acao.rotulo}
                </Link>
              )}
            </div>
          ))}

          {ehMesAtual && reserva > 0 && (
            <button onClick={() => setConfirmarReserva(true)} className="text-left">
              <Card interativo className="flex items-center gap-4 !border-[#d6e4fb] !bg-[#f4f8ff]">
                <IconeBox tom="azul">
                  <PiggyBank size={20} strokeWidth={1.7} />
                </IconeBox>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">Separe {brl(reserva)} para a reserva.</p>
                  <p className="text-[13px] text-ink-2">É metade do que ficou na empresa este mês.</p>
                </div>
                <ChevronRight size={18} className="text-slate" aria-hidden />
              </Card>
            </button>
          )}
        </div>
      </div>

      <Modal
        aberto={confirmarReserva}
        onFechar={() => setConfirmarReserva(false)}
        titulo="Separar para a reserva"
        rodape={
          <>
            <Button variante="secundario" onClick={() => setConfirmarReserva(false)}>
              Agora não
            </Button>
            <Button
              onClick={() => {
                separarReserva(reserva, mes)
                setConfirmarReserva(false)
                toast(`${brl(reserva)} separados para a reserva.`)
              }}
            >
              Separar {brl(reserva)}
            </Button>
          </>
        }
      >
        <p>
          Vamos registrar uma transferência de {brl(reserva)} da conta da empresa para a reserva. O dinheiro continua seu, só fica guardado à parte do caixa do dia a dia.
        </p>
      </Modal>
    </>
  )
}
