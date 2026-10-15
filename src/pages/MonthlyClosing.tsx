import { AlertTriangle, ChevronRight, MessageCircle, PiggyBank } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BarrasHorizontais } from '../components/financial/charts'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card, CardTitulo, IconeBox } from '../components/ui/Card'
import { Select } from '../components/ui/Field'
import { Modal, useToast } from '../components/ui/Modal'
import { gastosPorCategoria, reservaPendente, resumoMes, vendasSemNota } from '../domain/calc'
import { useStore } from '../data/store'
import { addMeses, brl, capitalizar, mesAno, nomeMes } from '../lib/format'

/** Resumo de um mês que já terminou. Abre no mês anterior ao atual. */
export function MonthlyClosing() {
  const { dados, hoje, separarReserva } = useStore()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [confirmar, setConfirmar] = useState(false)
  const mesAtual = hoje.slice(0, 7)
  const mes = params.get('mes') ?? addMeses(mesAtual, -1)
  const r = resumoMes(dados.lancamentos, mes)
  const gastos = gastosPorCategoria(dados.lancamentos, dados.categorias, mes).slice(0, 3)
  const semNota = vendasSemNota(dados.lancamentos, mes)
  const reserva = reservaPendente(dados.lancamentos, mes)
  const opcoes = Array.from({ length: 11 }, (_, i) => addMeses(mesAtual, -1 - i))

  const textoWhats = [
    `Resumo de ${nomeMes(mes)} da ${dados.empresa.nomeFantasia}`,
    `Entrou: ${brl(r.entrou)}`,
    `Saiu: ${brl(r.saiu)}`,
    `Sobrou: ${brl(r.sobrou)}`,
    `Retirei: ${brl(r.retirei)}`,
    `Ficou na empresa: ${brl(r.ficou)}`,
    'Feito com o Gynfinance',
  ].join('\n')

  const itens = [
    { rotulo: 'Entrou', valor: r.entrou, cor: 'text-success' },
    { rotulo: 'Saiu', valor: r.saiu, cor: 'text-danger' },
    { rotulo: 'Retirei', valor: r.retirei, cor: 'text-primary' },
    { rotulo: 'Ficou na empresa', valor: r.ficou, cor: r.ficou < 0 ? 'text-danger' : 'text-ink' },
  ]

  return (
    <>
      <Header
        titulo={`${capitalizar(nomeMes(mes))} fechou`}
        subtitulo="O resumo do mês que terminou."
        acoes={
          <Select
            aria-label="Mês"
            className="w-44"
            value={mes}
            onChange={(e) => setParams({ mes: e.target.value })}
            opcoes={opcoes.map((m) => ({ valor: m, rotulo: mesAno(m) }))}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-4 md:gap-5">
          <Card>
            <p className="text-[14px] font-semibold text-ink">Sobrou</p>
            <p className={`num text-[34px] font-bold md:text-[36px] ${r.sobrou < 0 ? 'text-danger' : 'text-ink'}`}>{brl(r.sobrou)}</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
              {itens.map((i) => (
                <div key={i.rotulo}>
                  <dt className="text-[12px] text-ink-2">{i.rotulo}</dt>
                  <dd className={`num text-[18px] font-bold ${i.cor}`}>{brl(i.valor)}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardTitulo>Onde mais gastou</CardTitulo>
            {gastos.length ? <BarrasHorizontais itens={gastos} /> : <p className="text-[13px] text-ink-2">Nenhuma saída lançada neste mês.</p>}
          </Card>

          {semNota > 0 && (
            <Link to="/lancamentos" className="flex items-center gap-3 rounded-[14px] border border-[#f3e0bf] bg-warning-soft px-4 py-3.5">
              <AlertTriangle size={19} className="text-warning" aria-hidden />
              <p className="flex-1 text-[13px] font-medium text-ink">
                {semNota} {semNota === 1 ? 'venda do mês está' : 'vendas do mês estão'} sem nota.
              </p>
              <ChevronRight size={18} className="text-slate" aria-hidden />
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-4 md:gap-5">
          {reserva > 0 ? (
            <Card className="!border-[#d6e4fb] !bg-[#f4f8ff] text-center">
              <IconeBox tom="azul" className="mx-auto mb-3">
                <PiggyBank size={20} strokeWidth={1.7} />
              </IconeBox>
              <p className="text-[16px] font-semibold text-ink">Separe {brl(reserva)} para a reserva.</p>
              <p className="mt-1 text-[13px] text-ink-2">É metade do que ficou na empresa. Ajuda nos meses mais fracos.</p>
              <Button className="mt-4 w-full" onClick={() => setConfirmar(true)}>
                Separar
              </Button>
            </Card>
          ) : (
            <Card className="text-center">
              <IconeBox tom="neutro" className="mx-auto mb-3">
                <PiggyBank size={20} strokeWidth={1.7} />
              </IconeBox>
              <p className="font-semibold text-ink">{r.ficou > 0 ? 'Reserva deste mês já separada.' : 'Sem sobra para reserva neste mês.'}</p>
            </Card>
          )}

          <a
            href={`https://wa.me/?text=${encodeURIComponent(textoWhats)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-line bg-surface px-4 text-[13px] font-semibold text-ink transition-colors hover:border-[#d6dee8] hover:bg-[#fbfcfe]"
          >
            <MessageCircle size={17} className="text-success" aria-hidden />
            Compartilhar resumo no WhatsApp
          </a>
        </div>
      </div>

      <Modal
        aberto={confirmar}
        onFechar={() => setConfirmar(false)}
        titulo="Separar para a reserva"
        rodape={
          <>
            <Button variante="secundario" onClick={() => setConfirmar(false)}>
              Agora não
            </Button>
            <Button
              onClick={() => {
                separarReserva(reserva, mes)
                setConfirmar(false)
                toast(`${brl(reserva)} separados para a reserva.`)
              }}
            >
              Separar {brl(reserva)}
            </Button>
          </>
        }
      >
        <p>Vamos registrar hoje uma transferência de {brl(reserva)} da conta da empresa para a reserva.</p>
      </Modal>
    </>
  )
}
