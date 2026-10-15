import { CalendarCheck, ChevronRight, LineChart, PieChart, TrendingDown, TrendingUp, UserRound, AlertCircle, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarrasHorizontais } from '../components/financial/charts'
import { Header } from '../components/layout/Header'
import { Card, CardTitulo, EstadoVazio, IconeBox } from '../components/ui/Card'
import { contasAbertas, gastosPorCategoria, receitasPorCategoria, resumoMes, serieMensal } from '../domain/calc'
import { useStore } from '../data/store'
import { brl, mesAno, nomeMes } from '../lib/format'
import { Badge } from '../components/ui/Badge'
import { ContaItem } from '../components/financial/ContaItem'

interface Relatorio {
  id: string
  titulo: string
  pergunta: string
  icone: LucideIcon
  para?: string
}

const RELATORIOS: Relatorio[] = [
  { id: 'fluxo', titulo: 'Fluxo de caixa', pergunta: 'Meu negócio está crescendo?', icone: LineChart, para: '/fluxo' },
  { id: 'fechamento', titulo: 'Fechamento mensal', pergunta: 'Como foi o mês passado?', icone: CalendarCheck, para: '/fechamento' },
  { id: 'despesas', titulo: 'Despesas por categoria', pergunta: 'Para onde está indo o dinheiro?', icone: TrendingDown },
  { id: 'receitas', titulo: 'Receitas por categoria', pergunta: 'O que mais vende?', icone: TrendingUp },
  { id: 'prolabore', titulo: 'Pró-labore e retiradas', pergunta: 'Quanto eu tirei para mim?', icone: UserRound },
  { id: 'atraso', titulo: 'Contas em atraso', pergunta: 'O que está vencido?', icone: AlertCircle },
]

export function Reports() {
  const { dados, mes, hoje } = useStore()
  const [aberto, setAberto] = useState<string>('despesas')
  const r = resumoMes(dados.lancamentos, mes)
  const despesas = gastosPorCategoria(dados.lancamentos, dados.categorias, mes)
  const receitas = receitasPorCategoria(dados.lancamentos, dados.categorias, mes)
  const retiradas = serieMensal(dados.lancamentos, mes, 6)
  const atrasadas = [...contasAbertas(dados.lancamentos, 'pagar'), ...contasAbertas(dados.lancamentos, 'receber')].filter((l) => l.dataVencimento! < hoje)

  return (
    <>
      <Header titulo="Relatórios" subtitulo="Cada relatório responde a uma pergunta sobre o seu dinheiro." periodo />

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card className="!p-2">
          <ul>
            {RELATORIOS.map((rel) => {
              const ativo = aberto === rel.id
              const conteudo = (
                <>
                  <IconeBox tom={ativo ? 'azul' : 'neutro'} className="!size-9">
                    <rel.icone size={18} strokeWidth={1.7} />
                  </IconeBox>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{rel.titulo}</span>
                    <span className="block text-[12px] text-ink-2">{rel.pergunta}</span>
                  </span>
                  <ChevronRight size={17} className="text-slate" aria-hidden />
                </>
              )
              const cls = `flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left transition-colors ${ativo ? 'bg-primary-soft/60' : 'hover:bg-hover'}`
              return (
                <li key={rel.id}>
                  {rel.para ? (
                    <Link to={rel.para} className={cls}>
                      {conteudo}
                    </Link>
                  ) : (
                    <button onClick={() => setAberto(rel.id)} aria-pressed={ativo} className={cls}>
                      {conteudo}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>

        <div className="flex flex-col gap-4 md:gap-5">
          <Card>
            <CardTitulo>Resumo de {nomeMes(mes)}</CardTitulo>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ['Entrou', r.entrou, 'text-success'],
                ['Saiu', r.saiu, 'text-danger'],
                ['Sobrou', r.sobrou, 'text-ink'],
                ['Retirei', r.retirei, 'text-primary'],
              ].map(([k, v, c]) => (
                <div key={k as string}>
                  <dt className="text-[12px] text-ink-2">{k}</dt>
                  <dd className={`num text-[18px] font-bold ${c}`}>{brl(v as number)}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {aberto === 'despesas' && (
            <Card className="anim-aparecer">
              <CardTitulo>Despesas por categoria</CardTitulo>
              {despesas.length ? <BarrasHorizontais itens={despesas} /> : <p className="text-[13px] text-ink-2">Nenhuma saída em {mesAno(mes)}.</p>}
            </Card>
          )}
          {aberto === 'receitas' && (
            <Card className="anim-aparecer">
              <CardTitulo>Receitas por categoria</CardTitulo>
              {receitas.length ? <BarrasHorizontais itens={receitas} /> : <p className="text-[13px] text-ink-2">Nenhuma entrada em {mesAno(mes)}.</p>}
            </Card>
          )}
          {aberto === 'prolabore' && (
            <Card className="anim-aparecer">
              <CardTitulo>Pró-labore e retiradas</CardTitulo>
              <ul className="divide-y divide-line">
                {[...retiradas].reverse().map((m) => (
                  <li key={m.mes} className="flex items-center justify-between gap-3 py-3 text-[13px]">
                    <span className="text-ink">{mesAno(m.mes)}</span>
                    <span className="flex items-center gap-3">
                      {m.retirei > m.sobrou && m.retirei > 0 && <Badge tom="ambar">Acima do que sobrou</Badge>}
                      <span className="num font-semibold text-ink">{brl(m.retirei)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {aberto === 'atraso' && (
            <Card className="anim-aparecer">
              <CardTitulo>Contas em atraso</CardTitulo>
              {atrasadas.length ? (
                <ul className="-my-3.5 divide-y divide-line">
                  {atrasadas.map((c) => (
                    <ContaItem key={c.id} conta={c} compacto mostrarCobrar />
                  ))}
                </ul>
              ) : (
                <EstadoVazio icone={<PieChart size={22} />} titulo="Nada em atraso" texto="Todas as contas estão em dia." />
              )}
            </Card>
          )}
          <p className="text-[12px] text-ink-2">
            Exportar em PDF chega numa próxima versão. Para planilha, use "Exportar CSV" em Lançamentos.
          </p>
        </div>
      </div>
    </>
  )
}
