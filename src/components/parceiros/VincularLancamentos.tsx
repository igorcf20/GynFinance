import { ArrowDown, ArrowUpRight, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { candidatosAVincular, normalizarNome } from '../../domain/parceiros'
import type { Parceiro } from '../../domain/types'
import { useStore } from '../../data/store'
import { brl, dataBR } from '../../lib/format'
import { Button } from '../ui/Button'
import { Modal, useToast } from '../ui/Modal'

/** Escolher lançamentos já feitos (sem ficha ou de outra) para atribuir a este cliente ou fornecedor. */
export function VincularLancamentos({ parceiro, aberto, onFechar }: { parceiro: Parceiro; aberto: boolean; onFechar: () => void }) {
  const { dados, vincularLancamentos } = useStore()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const nomes = useMemo(() => new Map((dados.parceiros ?? []).map((p) => [p.id, p.nome])), [dados.parceiros])
  const candidatos = useMemo(() => candidatosAVincular(dados.lancamentos, parceiro), [dados.lancamentos, parceiro])
  const termo = normalizarNome(busca)
  const lista = candidatos.filter((l) => !termo || normalizarNome(`${l.descricao ?? ''} ${l.contraparte ?? ''} ${l.numeroFatura ?? ''}`).includes(termo)).slice(0, 80)
  const mesmoNome = candidatos.filter((l) => !l.parceiroId && normalizarNome(l.contraparte ?? '') === normalizarNome(parceiro.nome))

  useEffect(() => {
    if (aberto) {
      setBusca('')
      setMarcados(new Set())
    }
  }, [aberto])

  const alternar = (id: string) =>
    setMarcados((m) => {
      const n = new Set(m)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const total = candidatos.filter((l) => marcados.has(l.id)).reduce((t, l) => t + l.valor, 0)

  const confirmar = () => {
    const desfazer = vincularLancamentos([...marcados], parceiro.id)
    onFechar()
    toast(`${marcados.size} ${marcados.size === 1 ? 'lançamento atribuído' : 'lançamentos atribuídos'} a ${parceiro.nome}.`, { desfazer })
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      larga
      titulo={`Atribuir lançamentos a ${parceiro.nome}`}
      rodape={
        <>
          <span className="num mr-auto self-center text-[13px] text-ink-2">{marcados.size ? `${marcados.size} escolhidos · ${brl(total)}` : 'Nenhum escolhido'}</span>
          <Button variante="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!marcados.size}>
            Atribuir
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[13px]">
        {parceiro.tipo === 'cliente' ? 'Recebimentos e contas a receber' : parceiro.tipo === 'fornecedor' ? 'Despesas, faturas e contas a pagar' : 'Entradas e saídas'} que ainda não estão nesta ficha.
      </p>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-navy" aria-hidden />
          <input
            type="search"
            aria-label="Buscar lançamento"
            placeholder="Buscar por descrição, nome ou nº da fatura…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-11 w-full rounded-[12px] border border-line bg-surface pr-3 pl-10 text-[14px] text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>
        {mesmoNome.length > 0 && (
          <Button variante="contorno" tamanho="sm" className="sm:h-11" onClick={() => setMarcados(new Set(mesmoNome.map((l) => l.id)))}>
            Marcar os {mesmoNome.length} com o nome {parceiro.nome}
          </Button>
        )}
      </div>
      {lista.length === 0 ? (
        <p className="py-6 text-center text-[13px]">Nenhum lançamento para atribuir.</p>
      ) : (
        <ul className="max-h-[48dvh] divide-y divide-line overflow-y-auto rounded-[14px] border border-line">
          {lista.map((l) => {
            const entrada = l.natureza === 'entrada'
            const outra = l.parceiroId ? nomes.get(l.parceiroId) : undefined
            return (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-hover">
                  <input type="checkbox" checked={marcados.has(l.id)} onChange={() => alternar(l.id)} className="size-[18px] shrink-0 accent-[#3478F6]" />
                  <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${entrada ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
                    {entrada ? <ArrowUpRight size={15} aria-hidden /> : <ArrowDown size={15} aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{l.descricao || l.contraparte || (entrada ? 'Entrada' : 'Saída')}</span>
                    <span className="block truncate text-[12px] text-ink-2">
                      {dataBR(l.dataPagamento ?? l.dataVencimento ?? l.dataCompetencia)}
                      {l.situacao === 'previsto' ? (entrada ? ' · a receber' : ' · a pagar') : ''}
                      {l.contraparte ? ` · ${l.contraparte}` : ''}
                      {outra ? ` · hoje na ficha de ${outra}` : ''}
                      {l.numeroFatura ? ` · Fatura ${l.numeroFatura}` : ''}
                    </span>
                  </span>
                  <span className={`num shrink-0 text-[14px] font-bold ${entrada ? 'text-success' : 'text-ink'}`}>{brl(l.valor, { centavos: l.valor % 100 !== 0 })}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
