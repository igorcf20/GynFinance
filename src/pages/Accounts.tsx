import { CheckCircle2, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { ContaItem } from '../components/financial/ContaItem'
import { Header } from '../components/layout/Header'
import { ButtonLink } from '../components/ui/Button'
import { Card, EstadoVazio } from '../components/ui/Card'
import { Segmentado } from '../components/ui/Tabs'
import { contasAbertas, grupoPrazo, type GrupoPrazo } from '../domain/calc'
import { useStore } from '../data/store'
import { brl } from '../lib/format'

const GRUPOS: { id: GrupoPrazo; titulo: string }[] = [
  { id: 'atrasadas', titulo: 'Atrasadas' },
  { id: 'semana', titulo: 'Vencem esta semana' },
  { id: 'depois', titulo: 'Mais para frente' },
]

export function Accounts() {
  const { dados, hoje } = useStore()
  const [aba, setAba] = useState<'pagar' | 'receber'>('pagar')
  const [busca, setBusca] = useState('')
  const pagar = contasAbertas(dados.lancamentos, 'pagar')
  const receber = contasAbertas(dados.lancamentos, 'receber')
  const termo = busca.trim().toLowerCase()
  const lista = (aba === 'pagar' ? pagar : receber).filter(
    (l) => !termo || `${l.descricao ?? ''} ${l.contraparte ?? ''}`.toLowerCase().includes(termo),
  )
  const total = lista.reduce((t, l) => t + l.valor, 0)

  return (
    <>
      <Header
        titulo="Contas"
        subtitulo="O que você tem para pagar e para receber."
        acoes={
          <span className="hidden sm:inline-flex">
            <ButtonLink to={`/lancar?conta=${aba}`} variante="secundario" icone={<Plus size={16} />}>
              Nova conta
            </ButtonLink>
          </span>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmentado
          rotulo="Tipo de conta"
          valor={aba}
          onChange={setAba}
          className="w-full sm:w-auto"
          opcoes={[
            { valor: 'pagar', rotulo: 'A pagar', contagem: pagar.length },
            { valor: 'receber', rotulo: 'A receber', contagem: receber.length },
          ]}
        />
        <div className="relative sm:ml-auto sm:w-64">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate" aria-hidden />
          <input
            type="search"
            aria-label="Buscar conta"
            placeholder="Buscar conta…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-10 w-full rounded-[10px] border border-line bg-surface pr-3 pl-9 text-[14px] placeholder:text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <span className="sm:hidden">
          <ButtonLink to={`/lancar?conta=${aba}`} variante="secundario" icone={<Plus size={16} />} className="w-full">
            Nova conta {aba === 'pagar' ? 'a pagar' : 'a receber'}
          </ButtonLink>
        </span>
      </div>

      {lista.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={<CheckCircle2 size={22} />}
            titulo={termo ? 'Nenhuma conta encontrada' : aba === 'pagar' ? 'Nenhuma conta a pagar' : 'Nada a receber'}
            texto={
              termo
                ? 'Tente buscar por outro nome.'
                : aba === 'pagar'
                  ? 'Cadastre contas como aluguel e internet para o sistema lembrar você antes do vencimento.'
                  : 'Quando um cliente comprar para pagar depois, lance aqui para não esquecer de cobrar.'
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4 md:gap-5">
          {GRUPOS.map((g) => {
            const itens = lista.filter((l) => grupoPrazo(l.dataVencimento!, hoje) === g.id)
            if (!itens.length) return null
            return (
              <Card key={g.id} className="!py-4">
                <div className="flex items-center justify-between">
                  <h2 className={`text-[15px] font-semibold ${g.id === 'atrasadas' ? 'text-danger' : 'text-ink'}`}>{g.titulo}</h2>
                  <span className="num text-[13px] text-ink-2">{brl(itens.reduce((t, l) => t + l.valor, 0))}</span>
                </div>
                <ul className="divide-y divide-line">
                  {itens.map((c) => (
                    <ContaItem key={c.id} conta={c} mostrarCobrar />
                  ))}
                </ul>
              </Card>
            )
          })}
          <p className="num text-right text-[13px] text-ink-2">
            Total {aba === 'pagar' ? 'a pagar' : 'a receber'}: <span className="font-semibold text-ink">{brl(total)}</span>
          </p>
        </div>
      )}
    </>
  )
}
