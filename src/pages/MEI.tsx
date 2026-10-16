import { CalendarClock, ChartColumnIncreasing, CheckCircle2, ChevronRight, CircleAlert, CircleCheck, CircleDashed, ExternalLink, FileText, Info } from 'lucide-react'
import { useState } from 'react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/ui/Badge'
import { Button, classesBotao } from '../components/ui/Button'
import { Card, CardTitulo, EstadoVazio, IconeBox } from '../components/ui/Card'
import { Explica } from '../components/ui/Explica'
import { Modal, useToast } from '../components/ui/Modal'
import { estadoDas, situacaoMei, type EstadoDas } from '../domain/calc'
import { LINKS, parametroDoAno } from '../domain/parametros'
import { useStore } from '../data/store'
import { brl, capitalizar, nomeMes, pct } from '../lib/format'
import { ValorAnimado } from '../components/ui/ValorAnimado'

const ESTADO: Record<EstadoDas, { texto: string; tom: 'verde' | 'ambar' | 'vermelho' | 'neutro' }> = {
  pago: { texto: 'Pago', tom: 'verde' },
  pendente: { texto: 'Não pago', tom: 'ambar' },
  atrasado: { texto: 'Atrasado', tom: 'vermelho' },
  futuro: { texto: 'A vencer', tom: 'neutro' },
}

function RevenueLimit() {
  const { dados, hoje } = useStore()
  const s = situacaoMei(dados, hoje)
  const cor = s.usado >= 0.9 ? 'linear-gradient(90deg,#f26b7e,#e0324a)' : s.usado >= 0.7 ? 'linear-gradient(90deg,#ffb066,#f08a24)' : 'linear-gradient(90deg,#3478f6,#6aa6ff)'
  return (
    <Card>
      <p className="flex items-center gap-1.5 text-[15px] font-bold text-ink">
        Faturamento do ano
        <Explica
          titulo="Faturamento do ano"
          conta={
            <>
              {brl(s.faturado)} de {brl(s.limite)} = <b className="text-ink">{pct(s.usado)}</b> do limite
            </>
          }
        >
          Soma das vendas e serviços do ano, pela data da venda, como a Receita conta. O MEI pode faturar até {brl(s.limite)} por ano; no ano em que a empresa abre, o
          limite é proporcional aos meses de atividade.
          {dados.empresa.faturadoAntes?.ano === s.ano && ` Inclui ${brl(dados.empresa.faturadoAntes.valor)} vendidos antes de você começar a usar o Gynfinance.`}
        </Explica>
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p>
          <span className="valor-grande text-[32px] text-ink md:text-[38px]"><ValorAnimado centavos={s.faturado} /></span>
          <span className="num ml-2 text-[15px] font-medium text-ink-2">de {brl(s.limite)}</span>
        </p>
        <span className="num text-[20px] font-extrabold text-ink">{pct(s.usado)}</span>
      </div>
      <div
        className="mt-4 h-3 rounded-full bg-[#e9eef5]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(s.usado * 100)}
        aria-label="Limite anual do MEI usado"
      >
        <div className="anim-encher h-3 rounded-full shadow-[0_4px_10px_-4px_rgba(37,99,235,0.6)]" style={{ width: `${Math.min(100, s.usado * 100)}%`, backgroundImage: cor }} />
      </div>
      <p className="mt-3 text-[14px] text-ink-2">
        {s.restante > 0 ? `Ainda pode faturar ${brl(s.restante)} este ano.` : 'Você passou o limite do MEI. Fale com um contador.'}
      </p>
      <div className="mt-5 flex items-center gap-4 rounded-[16px] bg-gradient-to-r from-[#f1f5fa] to-[#f7f9fc] px-5 py-4">
        <span className="text-[#8aa0bf]">
          <ChartColumnIncreasing size={30} strokeWidth={2.2} aria-hidden />
        </span>
        <div>
          <p className="flex items-center gap-1 text-[14px] text-ink-2">
            No ritmo atual, você fecha o ano com
            <Explica titulo="Projeção do ano">
              Pegamos a média do que você faturou por mês até agora e multiplicamos pelos meses do ano. Se passar do limite, o aviso aparece aqui antes de acontecer.
            </Explica>
          </p>
          <p className={`valor-grande text-[22px] ${s.projecao > s.limite ? 'text-danger' : 'text-ink'}`}><ValorAnimado centavos={s.projecao} /></p>
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
        <IconeBox tom={estado === 'pago' ? 'verde' : estado === 'atrasado' ? 'vermelho' : 'azul'}>
          <FileText size={20} strokeWidth={2} />
        </IconeBox>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[16px] font-bold text-ink">
            DAS de {nomeMes(mes)}
            <Explica titulo="O que é o DAS">
              É o imposto mensal fixo do MEI, que já inclui o INSS (sua aposentadoria) e o ICMS ou ISS. Vence todo dia 20. Pague no portal do Simples e depois toque em
              Marcar como pago para o sistema lançar a saída.
            </Explica>
          </p>
          <p className={`text-[14px] font-medium ${estado === 'pago' ? 'text-ink-2' : estado === 'atrasado' ? 'text-danger' : 'text-[#e8640c]'}`}>
            Vence dia {parametroDoAno(Number(mes.slice(0, 4))).dasDiaVencimento} de {nomeMes(mes)} · <span className="num">{brl(valor, { centavos: true })}</span>
          </p>
        </div>
        <Badge tom={ESTADO[estado].tom}>{ESTADO[estado].texto}</Badge>
      </div>
      {estado !== 'pago' ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <a href={LINKS.pgmei} target="_blank" rel="noreferrer" className={classesBotao('primario', 'lg')}>
            Pagar no portal
            <ExternalLink size={16} aria-hidden />
          </a>
          <Button variante="contorno" tamanho="lg" onClick={() => setConfirmar(true)}>
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
          const Icone = estado === 'pago' ? CircleCheck : estado === 'futuro' ? CircleDashed : CircleAlert
          const cor =
            estado === 'pago' ? 'text-[#1fa463]' : estado === 'pendente' ? 'text-warning-base' : estado === 'atrasado' ? 'text-danger' : 'text-[#c5cfdb]'
          return (
            <li key={m} className="flex items-center gap-3 border-b border-line py-2.5 text-[14px] last:border-0">
              <span className="w-28 text-[#3d5170]">{capitalizar(nomeMes(m))}</span>
              {/* Ícone cheio com o desenho em branco, como na imagem de referência. */}
              <Icone size={19} className={cor} fill={estado === 'futuro' ? 'none' : 'currentColor'} stroke={estado === 'futuro' ? 'currentColor' : 'white'} strokeWidth={2.2} aria-hidden />
              <span className={`whitespace-nowrap ${estado === 'futuro' ? 'text-muted' : estado === 'pendente' ? 'font-semibold text-warning' : 'font-medium text-ink'}`}>{estado === 'futuro' ? 'A vencer' : ESTADO[estado].texto === 'Não pago' ? 'Pendente' : ESTADO[estado].texto}</span>
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
            <Card interativo className="flex items-center gap-3.5 !py-4">
              <IconeBox tom="azul">
                <CalendarClock size={20} strokeWidth={2} />
              </IconeBox>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-ink">Declaração anual (DASN-SIMEI)</p>
                <p className="text-[13px] text-ink-2">Até 31 de maio de {anoQueVem}, com o faturamento deste ano.</p>
              </div>
              <ChevronRight size={20} className="text-navy" aria-hidden />
            </Card>
          </a>
        </div>
      </div>
    </>
  )
}
