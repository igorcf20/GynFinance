import { Mail, MapPin, Phone, Plus, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { parceiroPeloNome, TIPOS_PARCEIRO, type NovoParceiro } from '../../domain/parceiros'
import type { ContatoParceiro, Parceiro, TipoParceiro } from '../../domain/types'
import { useStore } from '../../data/store'
import { uid } from '../../lib/format'
import { Button } from '../ui/Button'
import { Input, Label } from '../ui/Field'
import { Modal, useToast } from '../ui/Modal'
import { Chips } from '../ui/Tabs'

export interface PedidoParceiro {
  editando?: Parceiro
  tipo?: TipoParceiro
  nome?: string
}

/** Cadastrar ou alterar um cliente ou fornecedor. Ao salvar um novo, devolve o id em onSalvo. */
export function FormParceiro({ pedido, onFechar, onSalvo }: { pedido: PedidoParceiro | null; onFechar: () => void; onSalvo?: (id: string) => void }) {
  const { dados, salvarParceiro } = useStore()
  const toast = useToast()
  const e = pedido?.editando
  const [tipo, setTipo] = useState<TipoParceiro>('cliente')
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [observacao, setObservacao] = useState('')
  const [contatos, setContatos] = useState<ContatoParceiro[]>([])
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!pedido) return
    setTipo(e?.tipo ?? pedido.tipo ?? 'cliente')
    setNome(e?.nome ?? pedido.nome ?? '')
    setDocumento(e?.documento ?? '')
    setTelefone(e?.telefone ?? '')
    setEmail(e?.email ?? '')
    setEndereco(e?.endereco ?? '')
    setObservacao(e?.observacao ?? '')
    setContatos(e?.contatos ?? [])
    setErro('')
  }, [pedido, e])

  const mudaContato = (id: string, campo: keyof ContatoParceiro, valor: string) => setContatos((cs) => cs.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)))

  const salvar = () => {
    const n = nome.trim()
    if (!n) return setErro('Digite o nome.')
    const repetido = parceiroPeloNome(dados.parceiros, n)
    if (repetido && repetido.id !== e?.id) return setErro(`Já existe uma ficha com o nome ${repetido.nome}.`)
    const limpo = (s: string) => s.trim() || undefined
    const p: NovoParceiro = {
      ...e,
      tipo,
      nome: n,
      documento: limpo(documento),
      telefone: limpo(telefone),
      email: limpo(email),
      endereco: limpo(endereco),
      observacao: limpo(observacao),
      contatos: contatos
        .filter((c) => c.nome.trim())
        .map((c) => ({ id: c.id, nome: c.nome.trim(), cargo: limpo(c.cargo ?? ''), telefone: limpo(c.telefone ?? ''), email: limpo(c.email ?? '') })),
      ativo: e?.ativo ?? true,
    }
    const id = salvarParceiro(p, e?.id)
    onFechar()
    toast(e ? 'Ficha atualizada.' : `${n} cadastrado${tipo === 'fornecedor' ? ' como fornecedor' : ''}.`)
    onSalvo?.(id)
  }

  return (
    <Modal
      aberto={!!pedido}
      onFechar={onFechar}
      larga
      titulo={e ? `Editar ${e.nome}` : 'Novo cliente ou fornecedor'}
      rodape={
        <>
          <Button variante="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{e ? 'Salvar' : 'Cadastrar'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label>É um</Label>
          <Chips rotulo="Tipo" valor={tipo} onChange={setTipo} opcoes={TIPOS_PARCEIRO} />
        </div>
        <Input
          label="Nome"
          icone={<UserRound size={17} />}
          value={nome}
          erro={erro}
          onChange={(ev) => {
            setNome(ev.target.value)
            setErro('')
          }}
          placeholder={tipo === 'fornecedor' ? 'Ex.: Atacadão' : 'Ex.: Maria Souza'}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="CPF ou CNPJ (opcional)" inputMode="numeric" value={documento} onChange={(ev) => setDocumento(ev.target.value)} placeholder="000.000.000-00" />
          <Input label="WhatsApp ou telefone (opcional)" icone={<Phone size={16} />} inputMode="tel" value={telefone} onChange={(ev) => setTelefone(ev.target.value)} placeholder="(62) 99999-0000" />
          <Input label="E-mail (opcional)" icone={<Mail size={16} />} type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="nome@exemplo.com" />
          <Input label="Endereço (opcional)" icone={<MapPin size={16} />} value={endereco} onChange={(ev) => setEndereco(ev.target.value)} placeholder="Rua, número, bairro" />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Pessoas de contato</Label>
            <button
              type="button"
              onClick={() => setContatos((cs) => [...cs, { id: uid(), nome: '' }])}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
            >
              <Plus size={15} aria-hidden /> Adicionar contato
            </button>
          </div>
          {contatos.length === 0 && <p className="text-[12px] text-ink-2">Ex.: a vendedora do fornecedor ou quem paga as contas no cliente.</p>}
          <ul className="flex flex-col gap-3">
            {contatos.map((c, i) => (
              <li key={c.id} className="anim-subir grid grid-cols-2 gap-2.5 rounded-[14px] border border-line bg-hover/50 p-3 sm:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]">
                <Input label="Nome" value={c.nome} autoFocus={i === contatos.length - 1 && !c.nome} onChange={(ev) => mudaContato(c.id, 'nome', ev.target.value)} placeholder="Rita" />
                <Input label="Função" value={c.cargo ?? ''} onChange={(ev) => mudaContato(c.id, 'cargo', ev.target.value)} placeholder="Vendedora" />
                <Input label="Telefone" inputMode="tel" value={c.telefone ?? ''} onChange={(ev) => mudaContato(c.id, 'telefone', ev.target.value)} />
                <Input label="E-mail" type="email" value={c.email ?? ''} onChange={(ev) => mudaContato(c.id, 'email', ev.target.value)} />
                <button
                  type="button"
                  onClick={() => setContatos((cs) => cs.filter((x) => x.id !== c.id))}
                  aria-label={`Tirar o contato ${c.nome || ''}`}
                  className="col-span-2 inline-flex h-11 items-center justify-center gap-1.5 self-end rounded-[12px] text-[13px] text-danger hover:bg-danger-soft sm:col-span-1 sm:w-11"
                >
                  <Trash2 size={16} aria-hidden />
                  <span className="sm:hidden">Tirar contato</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Label htmlFor="obs-parceiro">Observação fixa (opcional)</Label>
          <textarea
            id="obs-parceiro"
            rows={2}
            maxLength={500}
            value={observacao}
            onChange={(ev) => setObservacao(ev.target.value)}
            placeholder="Ex.: paga sempre no dia 10; prefere Pix."
            className="w-full rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/12"
          />
        </div>
      </div>
    </Modal>
  )
}
