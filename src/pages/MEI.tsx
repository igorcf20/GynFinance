import { CalendarClock, CheckCircle2, ChevronRight, Circle, Clock, ExternalLink, FileText, Info, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardTitulo, EstadoVazio, IconeBox } from '../components/ui/Card'
import { Modal, useToast } from '../components/ui/Modal'
import { estadoDas, situacaoMei, type EstadoDas } from '../domain/calc'
import { LINKS, parametroDoAno } from '../domain/parametros'
import { useStore } from '../data/store'
import { brl, capitalizar, nomeMes, pct } from '../lib/format'

const ESTADO: Record<EstadoDas, { texto: string; tom: 'verde' | 'ambar' | 'vermelho' | 'neutro' }> = {
  pago: { texto: 'Pago', tom: 'verde' },
  pendente: { texto: 'Não pago', tom: 'ambar' },
  atrasado: { texto: 'Atrasado', tom: 'vermelho' },
  futuro: { texto: 'A vencer', tom: 'neutro' },
}

function RevenueLimit() {
  const { dados, hoje } = useStore()
  const s = situacaoMei(dados, hoje)
  const cor = s.usado >= 0.9 ? 'bg-danger' : s.usado >= 0.7 ? 'bg-warning-base' : 'bg-primary'
  return (
    <Card>
      <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
        Faturamento do ano
        <span title="Soma das vendas e serviços do ano, pela data da venda. É assim que a Receita conta." className="text-slate">
          <Info size={15} aria-label="Como é calculado" />
        </span>
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="num">
          <span className="text-[30px] font-bold text-ink md:text-[34px]">{brl(s.faturado)}</span>
          <span className="ml-1.5 text-[13px] text-ink-2">de {brl(s.limite)}</span>
        </p>
        <span className="num text-[18px] font-bold text-ink">{pct(s.usado)}</span>
      </div>
      <div
        className="mt-3 h-2.5 rounded-full bg-[#eef2f6]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(s.usado * 100)}
        aria-label="Limite anual do MEI usado"
      >
        <div className={`h-2.5 rounded-full ${cor}`} style={{ width: `${Math.min(100, s.usado * 100)}%` }} />
      </div>
      <p className="mt-3 text-[13px] text-ink-2">
        {s.restante > 0 ? `Ainda pode faturar ${brl(s.restante)} este ano.` : 'Você passou o limite do MEI. Fale com um contador.'}
      </p>
      <div className="mt-5 flex items-center gap-3 rounded-[12px] bg-[#f8fafc] px-4 py-3.5">
        <IconeBox tom="neutro" className="!size-9">
          <TrendingUp size={18} strokeWidth={1.7} />
        </IconeBox>
        <div>
          <p className="text-[12px] text-ink-2">No ritmo atual, você fecha o ano com</p>
          <p className={`num text-[18px] font-bold ${s.projecao > s.limite ? 'text-danger' : 'text-ink'}`}>{brl(s.projecao)}</p>
        </div>
      </div>
    </Card>
  )
}

function DASCard() {
  const { dados, hoje, marcarDasPago } = useStore()
  const toast = useToast()
  const [confirmar, setConfirmar] = useState(false)
  const mes = hoje.slice(0, 7)
  const p = dados.pagamentosDas.find((x) => x.competencia === mes)
  const estado = estadoDas(p, mes, hoje)
  const valor = parametroDoAno(Number(mes.slice(0, 4))).dasValorPorAtividade[dados.empresa.atividade]
  return (
    <Card>
      <div className="flex items-start gap-3">
        <IconeBox tom={estado === 'pago' ? 'verde' : estado === 'atrasado' ? 'vermelho' : 'ambar'}>
          <FileText size={19} strokeWidth={1.7} />
        </IconeBox>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">DAS de {nomeMes(mes)}</p>
          <p className="text-[13px] text-ink-2">
            Vence dia {parametroDoAno(Number(mes.slice(0, 4))).dasDiaVencimento} de {nomeMes(mes)} · <span className="num">{brl(valor, { centavos: true })}</span>
          </p>
        </div>
        <Badge tom={ESTADO[estado].tom}>{ESTADO[estado].texto}</Badge>
      </div>
      {estado !== 'pago' ? (
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a
            href={LINKS.pgmei}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Pagar no portal
            <ExternalLink size={15} aria-hidden />
          </a>
          <Button variante="secundario" onClick={() => setConfirmar(true)}>
            Marcar como pago
          </Button>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-success">
          <CheckCircle2 size={16} aria-hidden /> Pago e lançado nas saídas do mês.
        </p>
      )}
      <Modal
        aberto={confirmar}
        onFechar={() => setConfirmar(false)}
        titulo={`Marcar DAS de ${nomeMes(mes)} como pago`}
        rodape={
          <>
            <Button variante="secundario" onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                marcarDasPago(mes)
                setConfirmar(false)
                toast(`DAS de ${nomeMes(mes)} marcado como pago.`)
              }}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <p>Vamos lançar uma saída de {brl(valor, { centavos: true })} na categoria DAS e impostos, com a data de hoje.</p>
      </Modal>
    </Card>
  )
}

function DASTimeline() {
  const { dados, hoje } = useStore()
  const ano = hoje.slice(0, 4)
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`)
  const abertura = dados.empresa.dataAbertura.slice(0, 7)
  return (
    <Card>
      <CardTitulo>Pagamentos do DAS em {ano}</CardTitulo>
      <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-1">
        {meses.map((m) => {
          if (m < abertura) return null
          const estado = estadoDas(
            dados.pagamentosDas.find((p) => p.competencia === m),
            m,
            hoje,
          )
          const Icone = estado === 'pago' ? CheckCircle2 : estado === 'futuro' ? Circle : Clock
          const cor = estado === 'pago' ? 'text-success' : estado === 'pendente' ? 'text-warning' : estado === 'atrasado' ? 'text-danger' : 'text-[#c5cfdb]'
          return (
            <li key={m} className="flex items-center gap-3 border-b border-line py-2 text-[13px] last:border-0">
              <span className="w-20 text-ink-2">{capitalizar(nomeMes(m))}</span>
              <Icone size={16} className={cor} aria-hidden />
              <span className={estado === 'futuro' ? 'text-muted' : 'font-medium text-ink'}>{estado === 'futuro' ? 'A vencer' : ESTADO[estado].texto === 'Não pago' ? 'Pendente' : ESTADO[estado].texto}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

export function MEI() {
  const { dados, hoje } = useStore()
  if (!dados.empresa.ehMei) {
    return (
      <>
        <Header titulo="Meu MEI" />
        <Card>
          <EstadoVazio icone={<Info size={22} />} titulo="Esta tela é para MEI" texto="Se a sua empresa é MEI, marque isso em Configurações, Empresa, para acompanhar o limite e o DAS." />
        </Card>
      </>
    )
  }
  const anoQueVem = Number(hoje.slice(0, 4)) + 1
  return (
    <>
      <Header titulo="Meu MEI" subtitulo="Limite do ano, DAS e declaração, sem precisar fazer conta." />
      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-4 md:gap-5">
          <RevenueLimit />
          <DASCard />
        </div>
        <div className="flex flex-col gap-4 md:gap-5">
          <DASTimeline />
          <a href={LINKS.dasn} target="_blank" rel="noreferrer">
            <Card interativo className="flex items-center gap-3 !py-4">
              <IconeBox tom="neutro" className="!size-9">
                <CalendarClock size={18} strokeWidth={1.7} />
              </IconeBox>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-ink">Declaração anual (DASN-SIMEI)</p>
                <p className="text-[12px] text-ink-2">Até 31 de maio de {anoQueVem}, com o faturamento deste ano.</p>
              </div>
              <ChevronRight size={18} className="text-slate" aria-hidden />
            </Card>
          </a>
        </div>
      </div>
    </>
  )
}
