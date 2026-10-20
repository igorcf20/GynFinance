// Cartões do Início que olham para a frente: quanto posso tirar, meta do mês, tetos de gasto e
// o resumo da semana. As contas ficam em domain/planejamento.ts.
import { CalendarRange, HandCoins, Lightbulb, Target, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../../data/store'
import { progressoMeta, prolaboreSugerido, resumoSemana, usoDosTetos } from '../../domain/planejamento'
import { brl } from '../../lib/format'
import { Card, CardTitulo, IconeBox } from '../ui/Card'
import { Explica } from '../ui/Explica'
import { ValorAnimado } from '../ui/ValorAnimado'

/** Barra de progresso: azul até 80%, âmbar até 100%, vermelha depois (ou verde, quando encher é bom). */
function Barra({ uso, bom }: { uso: number; bom?: boolean }) {
  const cor = bom
    ? uso >= 1
      ? 'linear-gradient(90deg,#22c55e,#16a34a)'
      : 'linear-gradient(90deg,#5B9BFD,#2563EB)'
    : uso >= 1
      ? 'linear-gradient(90deg,#f87171,#dc2626)'
      : uso >= 0.8
        ? 'linear-gradient(90deg,#fbbf24,#f59e0b)'
        : 'linear-gradient(90deg,#5B9BFD,#2563EB)'
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-[#e9eef5]" role="presentation">
      <div className="anim-encher h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, uso * 100))}%`, backgroundImage: cor }} />
    </div>
  )
}

export function QuantoPossoTirar() {
  const { dados, hoje } = useStore()
  const p = prolaboreSugerido(dados, hoje)
  const desejado = dados.empresa.prolaboreDesejado
  return (
    <Card>
      <div className="flex items-start gap-3.5">
        <IconeBox tom="azul">
          <HandCoins size={21} strokeWidth={2.1} />
        </IconeBox>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[14px] font-bold text-ink">
            Quanto posso tirar para mim
            <Explica
              titulo="Quanto posso tirar"
              conta={
                <>
                  Gera por mês {brl(p.geraPorMes)} − já tirou {brl(p.retirado)}; limite do caixa: {brl(p.saldo)} − a pagar {brl(p.aPagar30)} + a receber {brl(p.aReceber30)} ={' '}
                  {brl(p.folga)}
                </>
              }
            >
              É o que dá para tirar este mês sem apertar o negócio. Usa o que sobrou, em média, nos últimos meses{p.mesesUsados ? ` (${p.mesesUsados} ${p.mesesUsados === 1 ? 'mês' : 'meses'})` : ''}
              , menos o que você já tirou. E nunca passa do que fica no caixa depois de pagar as contas dos próximos 30 dias.
            </Explica>
          </p>
          <p className="valor-grande mt-1 text-[26px] text-ink">
            <ValorAnimado centavos={p.sugerido} />
          </p>
          <p className="mt-1 text-[13px] text-ink-2">
            {p.sugerido === 0
              ? p.limite === 'caixa'
                ? 'O caixa está apertado para as contas dos próximos 30 dias. Melhor esperar entrar dinheiro.'
                : p.retirado > 0
                  ? `Você já tirou ${brl(p.retirado)}, o que o negócio costuma gerar no mês.`
                  : 'O negócio ainda não gerou sobra para tirar este mês.'
              : p.limite === 'caixa'
                ? 'Limitado pelo caixa: há contas para pagar nos próximos 30 dias.'
                : desejado
                  ? p.sugerido >= desejado
                    ? `Cobre o pró-labore que você quer (${brl(desejado)}).`
                    : `Ainda falta ${brl(desejado - p.sugerido)} para o pró-labore que você quer.`
                  : p.retirado > 0
                    ? `Além dos ${brl(p.retirado)} que você já tirou este mês.`
                    : 'Lance como "Retirada" quando tirar.'}
          </p>
        </div>
      </div>
    </Card>
  )
}

export function MetaDoMes() {
  const { dados, hoje, mes } = useStore()
  const m = progressoMeta(dados, mes, hoje)
  if (!m) return null
  const bateu = m.vendido >= m.meta
  return (
    <Card>
      <CardTitulo
        explica={
          <Explica titulo="Meta do mês" conta={<>Vendido {brl(m.vendido)} de {brl(m.meta)}</>}>
            Soma as vendas e serviços do mês pela data da venda, mesmo as que o cliente ainda vai pagar. A meta muda em Configurações, Metas e tetos.
          </Explica>
        }
        acao={
          <Link to="/configuracoes/metas" className="text-[13px] font-semibold text-primary hover:underline">
            Mudar
          </Link>
        }
      >
        <span className="inline-flex items-center gap-2">
          <Target size={18} className="text-primary" aria-hidden /> Meta do mês
        </span>
      </CardTitulo>
      <div className="flex items-baseline justify-between gap-3">
        <p className="valor-grande text-[24px] text-ink">
          <ValorAnimado centavos={m.vendido} />
        </p>
        <p className="num text-[13px] font-semibold text-ink-2">de {brl(m.meta)}</p>
      </div>
      <div className="mt-2.5">
        <Barra uso={m.uso} bom />
      </div>
      <p className="mt-2.5 text-[13px] text-ink-2">
        {bateu
          ? `Meta batida! ${m.vendido > m.meta ? `Passou ${brl(m.vendido - m.meta)}.` : ''}`
          : m.diasRestantes > 0
            ? `Faltam ${brl(m.falta)}: ${brl(m.porDia)} por dia nos ${m.diasRestantes} ${m.diasRestantes === 1 ? 'dia que falta' : 'dias que faltam'}.`
            : `Ficaram faltando ${brl(m.falta)}.`}
      </p>
    </Card>
  )
}

export function TetosDoMes() {
  const { dados, mes } = useStore()
  const tetos = usoDosTetos(dados, mes)
  if (!tetos.length) return null
  return (
    <Card>
      <CardTitulo
        explica={
          <Explica titulo="Tetos de gasto">
            Quanto já saiu este mês em cada categoria com teto. Amarelo a partir de 80%, vermelho quando passa. Os tetos mudam em Configurações, Metas e tetos.
          </Explica>
        }
        acao={
          <Link to="/configuracoes/metas" className="text-[13px] font-semibold text-primary hover:underline">
            Mudar
          </Link>
        }
      >
        Tetos de gasto
      </CardTitulo>
      <ul className="flex flex-col gap-3.5">
        {tetos.slice(0, 4).map((t) => (
          <li key={t.categoriaId}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate font-semibold text-ink">{t.nome}</span>
              <span className={`num shrink-0 ${t.uso >= 1 ? 'font-bold text-danger' : 'text-ink-2'}`}>
                {brl(t.gasto)} de {brl(t.limite)}
              </span>
            </div>
            <Barra uso={t.uso} />
          </li>
        ))}
      </ul>
      {tetos.length > 4 && <p className="mt-3 text-[12px] text-ink-2">E mais {tetos.length - 4} em Relatórios.</p>}
    </Card>
  )
}

/** Segunda a quarta: como foi a semana passada e o que vem nos próximos 7 dias. Dá para fechar. */
export function ResumoDaSemana() {
  const { dados, hoje, dispensarAviso } = useStore()
  const r = resumoSemana(dados, hoje)
  const id = `semana:${r.segunda}`
  const diaSemana = (new Date(`${hoje}T12:00:00Z`).getUTCDay() + 6) % 7
  if (diaSemana > 2 || dados.avisosDispensados?.includes(id)) return null
  if (!r.entrou && !r.saiu && !r.aPagar.quantidade && !r.aReceber.quantidade) return null
  return (
    <Card className="relative !border-[#d3e2fc] !bg-gradient-to-br !from-[#f4f8ff] !to-[#ffffff]">
      <button
        type="button"
        onClick={() => dispensarAviso(id)}
        aria-label="Fechar o resumo da semana"
        className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-hover hover:text-ink"
      >
        <X size={16} aria-hidden />
      </button>
      <p className="flex items-center gap-2 text-[15px] font-bold text-ink">
        <CalendarRange size={18} className="text-primary" aria-hidden /> Sua semana
      </p>
      <dl className="num mt-3 grid grid-cols-2 gap-2 text-[13px]">
        <div className="rounded-[12px] bg-surface px-3 py-2 ring-1 ring-line">
          <dt className="text-ink-2">Entrou (7 dias)</dt>
          <dd className="font-bold text-success">{brl(r.entrou)}</dd>
        </div>
        <div className="rounded-[12px] bg-surface px-3 py-2 ring-1 ring-line">
          <dt className="text-ink-2">Saiu (7 dias)</dt>
          <dd className="font-bold text-ink">{brl(r.saiu)}</dd>
        </div>
        <div className="rounded-[12px] bg-surface px-3 py-2 ring-1 ring-line">
          <dt className="text-ink-2">Vence esta semana</dt>
          <dd className="font-bold text-ink">
            {brl(r.aPagar.total)} <span className="font-medium text-ink-2">· {r.aPagar.quantidade}</span>
          </dd>
        </div>
        <div className="rounded-[12px] bg-surface px-3 py-2 ring-1 ring-line">
          <dt className="text-ink-2">Vai entrar</dt>
          <dd className="font-bold text-ink">
            {brl(r.aReceber.total)} <span className="font-medium text-ink-2">· {r.aReceber.quantidade}</span>
          </dd>
        </div>
      </dl>
      <p className="mt-3 flex items-start gap-2 text-[13px] text-ink-2">
        <Lightbulb size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
        {r.dica}
      </p>
    </Card>
  )
}
