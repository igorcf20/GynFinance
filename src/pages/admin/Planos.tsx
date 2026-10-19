import { Check, CreditCard, Pencil, Plus, Sparkles, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, EstadoVazio, Skeleton } from '../../components/ui/Card'
import { Input, Label, Toggle } from '../../components/ui/Field'
import { Modal, useToast } from '../../components/ui/Modal'
import type { DadosPlano, FonteAdmin, PlanoAdmin } from '../../data/admin'
import { MODULOS, type IdModulo } from '../../domain/planos'
import { brl, centavosParaTexto, lerValor } from '../../lib/format'
import { Texto } from './comum'

const VAZIO: DadosPlano = { nome: '', descricao: '', precoCentavos: 0, modulos: ['financeiro'], temIa: false, destaque: false, ativo: true, ordem: 1 }

export function AbaPlanos({ fonte, planos, onMudou }: { fonte: FonteAdmin; planos: PlanoAdmin[] | null; onMudou: () => Promise<void> }) {
  const [editando, setEditando] = useState<PlanoAdmin | 'novo' | null>(null)
  if (!planos) return <Skeleton className="h-64" />
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[14px] text-ink-2">
          Cada plano define o preço e os módulos que o cliente vê no sistema. Os planos ativos aparecem na página de preços do site, na ordem abaixo.
        </p>
        <Button icone={<Plus size={17} strokeWidth={2.4} />} onClick={() => setEditando('novo')}>
          Novo plano
        </Button>
      </div>
      {planos.length === 0 ? (
        <Card>
          <EstadoVazio icone={<CreditCard size={24} />} titulo="Nenhum plano" texto="Crie o primeiro plano para os clientes assinarem." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {planos.map((p) => (
            <Card key={p.id} interativo className={`relative flex flex-col ${p.destaque ? '!border-primary-line' : ''} ${p.ativo ? '' : 'opacity-75'}`}>
              {p.destaque && <span className="absolute inset-x-0 top-0 h-1 rounded-t-[18px] grad-primario" aria-hidden />}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[18px] font-bold text-ink">{p.nome}</h3>
                  <p className="mt-0.5 text-[13px] text-ink-2">{p.descricao || 'Sem descrição'}</p>
                </div>
                <button onClick={() => setEditando(p)} aria-label={`Alterar o plano ${p.nome}`} className="rounded-lg p-2 text-slate after:absolute after:inset-0 hover:bg-hover hover:text-ink">
                  <Pencil size={16} />
                </button>
              </div>
              <p className="valor-grande mt-3 text-[30px] text-ink">
                {p.precoCentavos ? brl(p.precoCentavos) : 'Grátis'}
                {p.precoCentavos > 0 && <span className="text-[14px] font-medium text-ink-2"> /mês</span>}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {!p.ativo && <Badge>Inativo: fora do site</Badge>}
                {p.destaque && (
                  <Badge tom="azul" icone={<Star size={12} />}>
                    Destaque no site
                  </Badge>
                )}
                {p.temIa && (
                  <Badge tom="verde" icone={<Sparkles size={12} />}>
                    Com IA
                  </Badge>
                )}
              </div>
              <ul className="mt-4 flex flex-col gap-1.5 text-[13px]">
                {MODULOS.map((m) => {
                  const tem = p.modulos.includes(m.id)
                  return (
                    <li key={m.id} className={`flex items-center gap-2 ${tem ? 'text-ink' : 'text-muted line-through'}`}>
                      <Check size={14} className={tem ? 'text-success' : 'opacity-0'} aria-hidden />
                      {m.nome}
                      {!m.pronto && tem && <span className="text-[11px] font-semibold text-warning no-underline">em breve</span>}
                    </li>
                  )
                })}
              </ul>
              <p className="mt-auto pt-4 text-[12px] text-ink-2">
                {p.assinantes} cliente{p.assinantes === 1 ? '' : 's'} neste plano
              </p>
            </Card>
          ))}
        </div>
      )}
      {editando && <FormPlano fonte={fonte} plano={editando === 'novo' ? null : editando} ordem={planos.length + 1} onFechar={() => setEditando(null)} onMudou={onMudou} />}
    </div>
  )
}

function FormPlano({ fonte, plano, ordem, onFechar, onMudou }: { fonte: FonteAdmin; plano: PlanoAdmin | null; ordem: number; onFechar: () => void; onMudou: () => Promise<void> }) {
  const toast = useToast()
  const [d, setD] = useState<DadosPlano>(() => (plano ? { ...plano } : { ...VAZIO, ordem }))
  const [precoTxt, setPrecoTxt] = useState(plano ? centavosParaTexto(plano.precoCentavos) : '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmarApagar, setConfirmarApagar] = useState(false)
  const muda = <K extends keyof DadosPlano>(k: K, v: DadosPlano[K]) => setD((x) => ({ ...x, [k]: v }))
  const alterna = (m: IdModulo) => muda('modulos', d.modulos.includes(m) ? d.modulos.filter((x) => x !== m) : [...d.modulos, m])

  const salvar = async () => {
    if (!d.nome.trim()) return setErro('Dê um nome ao plano.')
    setSalvando(true)
    try {
      const dados = { ...d, nome: d.nome.trim(), descricao: d.descricao.trim(), precoCentavos: lerValor(precoTxt) }
      if (plano) await fonte.salvarPlano(plano.id, dados)
      else await fonte.criarPlano(dados)
      await onMudou()
      toast(plano ? 'Plano salvo. Os clientes dele já veem os módulos novos.' : 'Plano criado.')
      onFechar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  const apagar = async () => {
    try {
      await fonte.apagarPlano(plano!.id)
      await onMudou()
      toast('Plano apagado.')
      onFechar()
    } catch (e) {
      setErro((e as Error).message)
      setConfirmarApagar(false)
    }
  }

  return (
    <Modal
      aberto
      larga
      onFechar={onFechar}
      titulo={plano ? `Plano ${plano.nome}` : 'Novo plano'}
      rodape={
        <>
          {plano &&
            (confirmarApagar ? (
              <Button variante="perigo" className="mr-auto" onClick={apagar}>
                Apagar mesmo
              </Button>
            ) : (
              <Button variante="discreto" className="mr-auto !px-3 text-danger" icone={<Trash2 size={16} />} onClick={() => setConfirmarApagar(true)}>
                Apagar
              </Button>
            ))}
          <Button variante="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} carregando={salvando}>
            {plano ? 'Salvar' : 'Criar plano'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr_0.6fr]">
          <Input label="Nome" value={d.nome} onChange={(e) => (muda('nome', e.target.value), setErro(''))} placeholder="Ex.: Essencial" />
          <Input label="Preço por mês" inputMode="decimal" value={precoTxt} onChange={(e) => setPrecoTxt(e.target.value)} placeholder="R$ 0,00 (grátis)" />
          <Input label="Ordem" type="number" min={0} value={d.ordem} onChange={(e) => muda('ordem', Number(e.target.value) || 0)} />
        </div>
        <Texto label="Descrição (aparece no site)" rows={2} value={d.descricao} onChange={(e) => muda('descricao', e.target.value)} placeholder="Ex.: Tudo para organizar o dinheiro do negócio e o MEI." />
        <div>
          <Label>Módulos liberados</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODULOS.map((m) => {
              const tem = m.base || d.modulos.includes(m.id)
              return (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-[12px] border p-3 transition-colors ${tem ? 'border-primary-line bg-primary-soft/50' : 'border-line hover:bg-hover'} ${m.base ? 'cursor-default' : ''}`}
                >
                  <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-primary)]" checked={tem} disabled={m.base} onChange={() => alterna(m.id)} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                      {m.nome}
                      {m.base && <span className="text-[11px] font-semibold text-ink-2">sempre incluído</span>}
                      {!m.pronto && <span className="text-[11px] font-semibold text-warning">em breve</span>}
                    </span>
                    <span className="block text-[12px] text-ink-2">{m.descricao}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <p className="mt-2 text-[12px] text-ink-2">Módulos "em breve" ainda não existem no sistema. Marcar agora já deixa o plano pronto para quando chegarem.</p>
        </div>
        <div className="divide-y divide-line rounded-[12px] border border-line px-4">
          <Toggle checked={d.temIa} onChange={(v) => muda('temIa', v)} label="Assistente (inteligência artificial)" descricao="Libera o assistente, que lê fotos de recibos e entende o que o cliente escreve ou fala, para este plano (quando ele estiver ligado em Sistema)." />
          <Toggle checked={d.ativo} onChange={(v) => muda('ativo', v)} label="Ativo" descricao="Aparece no site e pode ser escolhido para novos clientes." />
          <Toggle checked={d.destaque} onChange={(v) => muda('destaque', v)} label="Destaque no site" descricao='Ganha o selo "Mais escolhido" na página de preços.' />
        </div>
        {erro && (
          <p role="alert" className="rounded-[12px] bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
