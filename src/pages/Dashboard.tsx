import { ArrowUpRight, ArrowDownRight, Camera, ChevronRight, CalendarClock, FileUp, PiggyBank, Sparkles, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SaldoSparkline, SobrouMesesChart } from '../components/financial/charts'
import { Aviso, iconeDoAviso } from '../components/financial/Aviso'
import { ContaItem } from '../components/financial/ContaItem'
import { FinancialSummary } from '../components/financial/FinancialSummary'
import { ReceberEAtraso } from '../components/financial/ReceberEAtraso'
import { Header } from '../components/layout/Header'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card, CardTitulo, EstadoVazio, IconeBox } from '../components/ui/Card'
import { Explica } from '../components/ui/Explica'
import { Modal, useToast } from '../components/ui/Modal'
import { alertas, fraseSobrou, gastosPorCategoria, proximos7Dias, reservaPendente, resumoMes, saldoCaixa, serieMensal, variacao } from '../domain/calc'
import { useStore } from '../data/store'
import { addDias, addMeses, brl, nomeMes, pct } from '../lib/format'
import { ValorAnimado } from '../components/ui/ValorAnimado'
import { temModulo } from '../domain/planos'
import { useTemAssistente } from './Assistente'

function saudacao(): string {
  const h = new Date().getHours()
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export function Dashboard() {
  const { dados, hoje, mes, separarReserva, dispensarAviso, modulos } = useStore()
  const toast = useToast()
  const temAssistente = useTemAssistente()
  const [confirmarReserva, setConfirmarReserva] = useState(false)

  const r = resumoMes(dados.lancamentos, mes)
  const anterior = resumoMes(dados.lancamentos, addMeses(mes, -1))
  const v = variacao(r.sobrou, anterior.sobrou)
  const maiores = gastosPorCategoria(dados.lancamentos, dados.categorias, mes).map((g) => g.nome)
  const serie = serieMensal(dados.lancamentos, mes, 5)
  const saldo = saldoCaixa(dados)
  const proximos = proximos7Dias(dados.lancamentos, hoje)
  // Conta atrasada que já aparece em "Próximos 7 dias" não vira uma faixa repetida.
  const naLista = new Set(proximos.slice(0, 3).map((c) => `atrasada:${c.id}`))
  const avisos = alertas(dados, hoje).filter((a) => a.painel && !naLista.has(a.id))
  const reserva = reservaPendente(dados.lancamentos, mes)
  const ehMesAtual = mes === hoje.slice(0, 7)
  // Um ponto por semana deixa a linha suave, como na imagem de referência.
  const pontosSaldo = Array.from({ length: 14 }, (_, i) => {
    const dia = addDias(hoje, (i - 13) * 7)
    return { dia, saldo: saldoCaixa(dados, dia) }
  })

  return (
    <>
      <Header
        titulo={`${saudacao()}, ${dados.empresa.nomeDono.split(' ')[0]}`}
        subtitulo={`${dados.empresa.nomeFantasia} · ${dados.empresa.ehMei ? 'MEI' : 'Empresa'}`}
        periodo
        acoes={
          temModulo(modulos, 'extrato') && (
          <span className="hidden lg:inline-flex">
            <ButtonLink to="/importar" variante="secundario" icone={<FileUp size={16} />}>
              Importar extrato
            </ButtonLink>
          </span>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-4 md:gap-5">
          {/* Cartão principal */}
          <Card className="relative flex flex-col gap-5 sm:flex-row sm:items-end md:!p-7">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[15px] font-bold text-ink">
                Sobrou no mês
                <Explica
                  titulo="Sobrou no mês"
                  conta={
                    <>
                      Entrou {brl(r.entrou)} − Saiu {brl(r.saiu)} = <b className="text-ink">{brl(r.sobrou)}</b>
                    </>
                  }
                >
                  É o que o negócio gerou no mês: tudo o que entrou menos tudo o que saiu. O que você tirou para você (pró-labore) fica de fora, para mostrar se o negócio
                  se paga sozinho.
                </Explica>
              </p>
              <p className={`valor-grande mt-2 text-[40px] md:text-[46px] ${r.sobrou < 0 ? 'text-danger' : 'text-ink'}`}><ValorAnimado centavos={r.sobrou} /></p>
              {v !== null && (
                <span
                  className={`mt-3.5 inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${
                    v >= 0 ? 'bg-gradient-to-r from-[#d9f3e5] to-[#e8f8ef] text-success' : 'bg-gradient-to-r from-[#fcdfe4] to-[#fdeef1] text-danger'
                  }`}
                >
                  {v >= 0 ? <ArrowUpRight size={16} strokeWidth={2.4} aria-hidden /> : <ArrowDownRight size={16} strokeWidth={2.4} aria-hidden />}
                  {v >= 0 ? '+' : ''}
                  {pct(v)} vs. {nomeMes(addMeses(mes, -1))}
                </span>
              )}
              <p className="mt-4 text-[14px] text-ink-2">{fraseSobrou(r, maiores)}</p>
            </div>
            {/* Sem nenhum mês com movimento, o gráfico só ocuparia espaço. */}
            {serie.some((m) => m.entrou || m.saiu) && (
              <div className="w-full sm:w-[230px]">
                <SobrouMesesChart serie={serie} />
              </div>
            )}
          </Card>

          <FinancialSummary r={r} />

          {temAssistente && (
            <Link
              to="/assistente"
              className="card group relative flex items-center gap-4 overflow-hidden !py-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
            >
              <span className="grad-primario inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-[var(--shadow-primary)]">
                <Sparkles size={20} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">Lançar com o assistente</span>
                <span className="block text-[13px] text-ink-2">Mande a foto do recibo, fale ou escreva. Ele preenche tudo e você só confirma.</span>
              </span>
              <Camera size={20} className="hidden shrink-0 text-primary sm:block" aria-hidden />
              <ChevronRight size={18} className="shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}

          <ReceberEAtraso lancamentos={dados.lancamentos} hoje={hoje} />

          <Card interativo className="relative flex items-center gap-4 md:gap-5">
              <IconeBox tom="azul" tamanho="lg">
                <Wallet size={24} strokeWidth={1.9} />
              </IconeBox>
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[14px] font-bold text-ink">
                  {/* Link esticado: o cartão inteiro abre os relatórios, e o "?" continua clicável por cima. */}
                  <Link to="/relatorios" className="after:absolute after:inset-0 after:rounded-[18px]">
                    Saldo do caixa hoje
                  </Link>
                  <span className="relative z-10">
                    <Explica titulo="Saldo do caixa hoje">
                      Quanto a empresa tem agora, somando dinheiro em espécie e conta bancária. Não inclui a reserva, que fica guardada à parte. A linha mostra como o saldo
                      andou nos últimos três meses.
                    </Explica>
                  </span>
                </p>
                <p className="valor-grande mt-1 text-[28px] text-ink"><ValorAnimado centavos={saldo} /></p>
              </div>
              <div className="ml-auto hidden w-56 sm:block xl:w-64">
                <SaldoSparkline pontos={pontosSaldo} />
              </div>
              <ChevronRight size={20} className="shrink-0 text-navy transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </Card>
        </div>

        <div className="flex flex-col gap-4 md:gap-5">
          <Card>
            <CardTitulo
              explica={
                <Explica titulo="Próximos 7 dias">
                  Contas a pagar e a receber que vencem nesta semana, e as que já passaram do dia. Toque em Paguei ou Recebi quando o dinheiro sair ou entrar: o
                  saldo e o painel se atualizam na hora.
                </Explica>
              }
              acao={
                <Link to="/contas" className="text-[14px] font-semibold text-primary hover:underline">
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
            <Aviso key={a.id} nivel={a.nivel} icone={iconeDoAviso(a.id)} acao={a.acao} onDispensar={a.dispensavel ? () => dispensarAviso(a.id) : undefined}>
              {a.texto}
            </Aviso>
          ))}

          {ehMesAtual && reserva > 0 && (
            <button onClick={() => setConfirmarReserva(true)} className="text-left">
              <Card interativo className="flex items-center gap-4 !border-[#d3e2fc] !bg-gradient-to-r !from-[#dfeafd] !to-[#eef4ff]">
                <IconeBox tom="solido" tamanho="lg">
                  <PiggyBank size={24} strokeWidth={2} />
                </IconeBox>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold text-ink">Separe {brl(reserva)} para a reserva.</p>
                  <p className="text-[14px] text-ink-2">É metade do que ficou na empresa este mês.</p>
                </div>
                <ChevronRight size={20} className="text-navy" aria-hidden />
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
                const desfazer = separarReserva(reserva, mes)
                setConfirmarReserva(false)
                toast(`${brl(reserva)} separados para a reserva.`, { desfazer })
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
