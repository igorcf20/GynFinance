import { AlertTriangle, Phone, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { parceiroPeloNome } from '../../domain/parceiros'
import { temModulo } from '../../domain/planos'
import { conflitos, somarMinutos, SITUACOES, type NovoAtendimento } from '../../domain/agenda'
import type { Atendimento, DataISO, SituacaoAtendimento } from '../../domain/types'
import { useStore } from '../../data/store'
import { brl, centavosParaTexto, lerValor } from '../../lib/format'
import { Button } from '../ui/Button'
import { Input, Label, Select, Toggle } from '../ui/Field'
import { Modal, useToast } from '../ui/Modal'
import { Chips } from '../ui/Tabs'

const DURACOES = [15, 30, 45, 60, 90, 120, 180, 240].map((m) => ({
  valor: String(m),
  rotulo: m < 60 ? `${m} minutos` : m % 60 ? `${Math.floor(m / 60)}h${m % 60}` : `${m / 60} hora${m > 60 ? 's' : ''}`,
}))

export interface PedidoForm {
  editando?: Atendimento
  data?: DataISO
  inicio?: string
}

/** Marcar ou alterar um atendimento. Com valor, a conta a receber nasce junto (e aparece em Contas). */
export function FormAtendimento({ pedido, onFechar }: { pedido: PedidoForm | null; onFechar: () => void }) {
  const { dados, hoje, salvarAtendimento, salvarParceiro, modulos } = useStore()
  const comFichas = temModulo(modulos, 'clientes')
  const [cadastrar, setCadastrar] = useState(true)
  const toast = useToast()
  const e = pedido?.editando
  const [cliente, setCliente] = useState('')
  const [telefone, setTelefone] = useState('')
  const [servico, setServico] = useState('')
  const [data, setData] = useState(hoje)
  const [inicio, setInicio] = useState('09:00')
  const [duracao, setDuracao] = useState('60')
  const [valorTxt, setValorTxt] = useState('')
  const [gerarConta, setGerarConta] = useState(true)
  const [situacao, setSituacao] = useState<SituacaoAtendimento>('agendado')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<{ cliente?: string }>({})

  // Cada abertura começa com os dados do atendimento (ou do horário clicado).
  useEffect(() => {
    if (!pedido) return
    setCliente(e?.cliente ?? '')
    setTelefone(e?.telefone ?? '')
    setServico(e?.servico ?? '')
    setData(e?.data ?? pedido.data ?? hoje)
    setInicio(e?.inicio ?? pedido.inicio ?? '09:00')
    setDuracao(String(e?.duracaoMin ?? 60))
    setValorTxt(e?.valor ? centavosParaTexto(e.valor) : '')
    setGerarConta(e ? !!e.lancamentoId || !e.valor : true)
    setSituacao(e?.situacao ?? 'agendado')
    setObservacao(e?.observacao ?? '')
    setErro({})
  }, [pedido, e, hoje])

  // Clientes de antes (agenda e contas a receber) para completar o nome e o telefone.
  const clientes = useMemo(() => {
    const m = new Map<string, string | undefined>()
    for (const p of dados.parceiros ?? []) if (p.ativo && p.tipo !== 'fornecedor') m.set(p.nome, p.telefone)
    for (const a of [...dados.atendimentos].reverse()) if (!m.has(a.cliente)) m.set(a.cliente, a.telefone)
    for (const l of dados.lancamentos) if (l.natureza === 'entrada' && l.contraparte && !m.has(l.contraparte)) m.set(l.contraparte, undefined)
    return m
  }, [dados.atendimentos, dados.lancamentos, dados.parceiros])
  const servicos = useMemo(() => [...new Set(dados.atendimentos.map((a) => a.servico).filter((s): s is string => !!s))].slice(-30), [dados.atendimentos])

  const valor = lerValor(valorTxt)
  const duracaoMin = Number(duracao)
  const choques = conflitos(dados.atendimentos, { id: e?.id ?? '', data, inicio, duracaoMin })
  const ligada = e?.lancamentoId ? dados.lancamentos.find((l) => l.id === e.lancamentoId) : undefined
  const jaRecebido = ligada?.situacao === 'realizado'

  const salvar = () => {
    if (!cliente.trim()) {
      setErro({ cliente: 'Digite o nome do cliente.' })
      return
    }
    // Cliente com ficha: o atendimento e a conta a receber vão para ela.
    let parceiroId = comFichas ? parceiroPeloNome(dados.parceiros, cliente, 'cliente')?.id : e?.cliente === cliente.trim() ? e?.parceiroId : undefined
    if (comFichas && !parceiroId && cadastrar) parceiroId = salvarParceiro({ tipo: 'cliente', nome: cliente.trim(), telefone: telefone.trim() || undefined, ativo: true })
    const a: NovoAtendimento = {
      parceiroId,
      cliente: cliente.trim(),
      telefone: telefone.trim() || undefined,
      servico: servico.trim() || undefined,
      data,
      inicio,
      duracaoMin,
      valor: valor > 0 ? valor : undefined,
      situacao,
      observacao: observacao.trim() || undefined,
    }
    const desfazer = salvarAtendimento(a, e?.id, gerarConta)
    onFechar()
    const conta = gerarConta && valor > 0 && !e?.lancamentoId && situacao !== 'cancelado' && situacao !== 'faltou' ? ` A conta de ${brl(valor)} a receber foi criada.` : ''
    toast(e ? 'Atendimento alterado.' : `Atendimento marcado para ${data.slice(8, 10)}/${data.slice(5, 7)} às ${inicio}.${conta}`, { desfazer })
  }

  return (
    <Modal
      aberto={!!pedido}
      onFechar={onFechar}
      titulo={e ? 'Alterar atendimento' : 'Novo atendimento'}
      rodape={
        <>
          <Button variante="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{e ? 'Salvar' : 'Marcar'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Cliente"
          icone={<UserRound size={17} />}
          value={cliente}
          list="gyn-clientes"
          autoComplete="off"
          erro={erro.cliente}
          onChange={(ev) => {
            setCliente(ev.target.value)
            setErro({})
            const tel = clientes.get(ev.target.value)
            if (tel && !telefone) setTelefone(tel)
          }}
          placeholder="Nome de quem vem"
        />
        {comFichas && cliente.trim() && (parceiroPeloNome(dados.parceiros, cliente, 'cliente') ? (
          <p className="-mt-2 text-[12px] text-success">Vai para a ficha de {parceiroPeloNome(dados.parceiros, cliente, 'cliente')!.nome}.</p>
        ) : (
          <label className="-mt-2 flex cursor-pointer items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={cadastrar} onChange={(ev) => setCadastrar(ev.target.checked)} className="size-4 accent-[#3478F6]" />
            Cadastrar {cliente.trim()} em Clientes
          </label>
        ))}
        <datalist id="gyn-clientes">
          {[...clientes.keys()].slice(0, 50).map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="WhatsApp (opcional)" icone={<Phone size={16} />} inputMode="tel" value={telefone} onChange={(ev) => setTelefone(ev.target.value)} placeholder="(62) 99999-0000" />
          <Input label="Serviço (opcional)" value={servico} list="gyn-servicos" onChange={(ev) => setServico(ev.target.value)} placeholder="O que vai ser feito" />
          <datalist id="gyn-servicos">
            {servicos.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1.35fr_1fr_1.15fr]">
          <Input label="Dia" type="date" value={data} onChange={(ev) => ev.target.value && setData(ev.target.value)} />
          <Input label="Horário" type="time" step={300} value={inicio} onChange={(ev) => ev.target.value && setInicio(ev.target.value)} />
          <Select label="Duração" className="col-span-2 sm:col-span-1" value={duracao} onChange={(ev) => setDuracao(ev.target.value)} opcoes={DURACOES} />
        </div>
        <p className="-mt-2 text-[12px] text-ink-2">
          Das {inicio} às {somarMinutos(inicio, duracaoMin)}.
        </p>
        {choques.length > 0 && (
          <p role="alert" className="flex items-start gap-2 rounded-[12px] bg-warning-soft px-3 py-2.5 text-[13px] text-[#8a4b06]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            Já tem {choques.map((c) => `${c.cliente} às ${c.inicio}`).join(' e ')} neste horário. Dá para marcar assim mesmo.
          </p>
        )}
        <Input label="Valor (opcional)" inputMode="decimal" value={valorTxt} onChange={(ev) => setValorTxt(ev.target.value)} placeholder="R$ 0,00" disabled={jaRecebido} />
        {valor > 0 && !jaRecebido && (
          <div className="-my-2">
            <Toggle
              checked={gerarConta}
              onChange={setGerarConta}
              label="Lançar como conta a receber"
              descricao={`Aparece em Contas e no painel, com vencimento no dia do atendimento.`}
            />
          </div>
        )}
        {jaRecebido && <p className="-mt-2 text-[12px] text-success">Este atendimento já foi recebido. O valor fica como está.</p>}
        {e && (
          <div>
            <Label>Situação</Label>
            <Chips rotulo="Situação do atendimento" valor={situacao} onChange={setSituacao} opcoes={SITUACOES} />
          </div>
        )}
        <Input label="Observação (opcional)" value={observacao} onChange={(ev) => setObservacao(ev.target.value)} placeholder="Ex.: trazer o sinal de 50%" />
      </div>
    </Modal>
  )
}
