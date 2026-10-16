import { CalendarCheck, MessageCircle, PiggyBank, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Aviso } from '../components/financial/Aviso'
import { BarrasHorizontais, SobrouMesesChart } from '../components/financial/charts'
import { Header } from '../components/layout/Header'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card, CardTitulo, EstadoVazio, IconeBox } from '../components/ui/Card'
import { Select } from '../components/ui/Field'
import { Explica } from '../components/ui/Explica'
import { Modal, useToast } from '../components/ui/Modal'
import { gastosPorCategoria, reservaPendente, resumoMes, serieMensal, vendasSemNota } from '../domain/calc'
import { useStore } from '../data/store'
import { addMeses, brl, capitalizar, mesAno, nomeMes } from '../lib/format'
import { ValorAnimado } from '../components/ui/ValorAnimado'

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
  const temLancamentos = dados.lancamentos.some((l) => l.situacao === 'realizado' && l.dataPagamento?.startsWith(mes))

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
            className="hidden w-48 sm:block"
            value={mes}
            onChange={(e) => setParams({ mes: e.target.value })}
            opcoes={opcoes.map((m) => ({ valor: m, rotulo: mesAno(m) }))}
          />
        }
      />
      <Select
        aria-label="Mês"
        className="-mt-2 mb-4 sm:hidden"
        value={mes}
        onChange={(e) => setParams({ mes: e.target.value })}
        opcoes={opcoes.map((m) => ({ valor: m, rotulo: mesAno(m) }))}
      />

      {!temLancamentos && (
        <Card>
          <EstadoVazio
            icone={<CalendarCheck size={22} />}
            titulo={`Nada lançado em ${nomeMes(mes)}`}
            texto={`O fechamento resume um mês que já terminou. O de ${nomeMes(mesAtual)} aparece aqui no dia 1º, com o que você lançar até lá.`}
            acao={
              <ButtonLink to="/lancar" icone={<Plus size={16} strokeWidth={2.4} />}>
                Novo lançamento
              </ButtonLink>
            }
          />
        </Card>
      )}
      <div className={`grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[1.5fr_1fr] ${temLancamentos ? '' : 'hidden'}`}>
        <div className="flex flex-col gap-4 md:gap-5">
          <Card className="flex items-end gap-5 md:!p-7">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[16px] font-bold text-ink">
                Sobrou
                <Explica titulo="Sobrou" conta={<>Entrou {brl(r.entrou)} − Saiu {brl(r.saiu)} = <b className="text-ink">{brl(r.sobrou)}</b></>}>
                  O resultado do mês: tudo o que entrou menos tudo o que saiu, sem contar o que você retirou.
                </Explica>
              </p>
              <p className={`valor-grande mt-1.5 text-[40px] md:text-[46px] ${r.sobrou < 0 ? 'text-danger' : 'text-ink'}`}><ValorAnimado centavos={r.sobrou} /></p>
            </div>
            <div className="hidden w-[150px] sm:block">
              <SobrouMesesChart serie={serieMensal(dados.lancamentos, mes, 4)} altura={90} discreto />
            </div>
          </Card>

          <Card className="!p-0">
            <dl className="grid grid-cols-2 sm:grid-cols-4">
              {itens.map((i, idx) => (
                <div key={i.rotulo} className={`px-5 py-4 ${idx > 0 ? 'sm:border-l' : ''} ${idx % 2 ? 'border-l' : ''} ${idx > 1 ? 'border-t sm:border-t-0' : ''} border-line`}>
                  <dt className="flex items-center gap-1 text-[13px] font-medium text-[#3d5170]">
                    {i.rotulo}
                    {i.rotulo === 'Ficou na empresa' && (
                      <Explica titulo="Ficou na empresa" lado="direita" conta={<>Sobrou {brl(r.sobrou)} − Retirei {brl(r.retirei)} = <b className="text-ink">{brl(r.ficou)}</b></>}>
                        O que sobrou depois de você tirar o seu pró-labore. É esse dinheiro que pode virar reserva ou investimento no negócio.
                      </Explica>
                    )}
                  </dt>
                  <dd className={`valor-grande mt-1 text-[21px] ${i.cor}`}><ValorAnimado centavos={i.valor} /></dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardTitulo>Onde mais gastou</CardTitulo>
            {gastos.length ? <BarrasHorizontais itens={gastos} /> : <p className="text-[13px] text-ink-2">Nenhuma saída lançada neste mês.</p>}
          </Card>

          {semNota > 0 && (
            <Aviso nivel="atencao" para={`/lancamentos?situacao=semnota&mes=${mes}`}>
              {semNota} {semNota === 1 ? 'venda do mês está' : 'vendas do mês estão'} sem nota.
            </Aviso>
          )}
        </div>

        <div className="flex flex-col gap-4 md:gap-5">
          {reserva > 0 ? (
            <Card className="!border-[#d3e2fc] !bg-gradient-to-b !from-[#e3edfd] !to-[#f1f6ff] text-center md:!p-7">
              <IconeBox tom="solido" tamanho="lg" className="mx-auto mb-4">
                <PiggyBank size={26} strokeWidth={2} />
              </IconeBox>
              <p className="text-[19px] leading-snug font-bold tracking-[-0.01em] text-ink">Separe {brl(reserva)} para a reserva.</p>
              <p className="mt-1.5 text-[14px] text-ink-2">
                É metade do que ficou na empresa, arredondada. Ajuda nos meses mais fracos e evita pegar empréstimo quando aperta.
              </p>
              <Button tamanho="lg" className="mt-5 w-full" onClick={() => setConfirmar(true)}>
                Separar
              </Button>
            </Card>
          ) : (
            <Card className="text-center">
              <IconeBox tom="neutro" tamanho="lg" className="mx-auto mb-3">
                <PiggyBank size={24} strokeWidth={1.9} />
              </IconeBox>
              <p className="font-semibold text-ink">{r.ficou > 0 ? 'Reserva deste mês já separada.' : 'Sem sobra para reserva neste mês.'}</p>
            </Card>
          )}

          <a
            href={`https://wa.me/?text=${encodeURIComponent(textoWhats)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-[#d8e1ec] bg-surface px-4 text-[14px] font-semibold text-ink shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[#9fdcb9]"
          >
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#25d366] text-white">
              <MessageCircle size={16} strokeWidth={2.4} aria-hidden />
            </span>
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
                const desfazer = separarReserva(reserva, mes)
                setConfirmar(false)
                toast(`${brl(reserva)} separados para a reserva.`, { desfazer })
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
