import { ArrowDownLeft, ArrowUpRight, Calendar, Check, ChevronDown, CreditCard, ExternalLink, ImagePlus, Repeat, UserRound, Wallet, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input, Label, Select, Toggle } from '../components/ui/Field'
import { Modal, useToast } from '../components/ui/Modal'
import { Chips, Segmentado } from '../components/ui/Tabs'
import { LINKS } from '../domain/parametros'
import type { FormaPagamento, Lancamento, NotaEmitida } from '../domain/types'
import { useStore, type NovoLancamento } from '../data/store'
import { addDias, brl, lerValor } from '../lib/format'

export const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'debito', rotulo: 'Débito' },
  { valor: 'credito', rotulo: 'Crédito' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'outro', rotulo: 'Outro' },
]

type Tipo = 'entrada' | 'saida'
type Modo = 'normal' | 'retirada'

// Categorias mais usadas no topo; o resto fica em "Outra categoria".
const RAPIDAS: Record<Tipo, string[]> = {
  entrada: ['vendas', 'servicos', 'outras-entradas'],
  saida: ['mercadoria', 'aluguel', 'embalagem', 'transporte'],
}

function valorInicial(l?: Lancamento) {
  if (!l) return ''
  return l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function NewTransaction() {
  const { dados, hoje, salvarLancamento, excluirLancamento } = useStore()
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editando = dados.lancamentos.find((l) => l.id === params.get('id'))
  const contaNova = params.get('conta') // "pagar" | "receber"

  const [tipo, setTipo] = useState<Tipo>(editando?.natureza === 'entrada' || contaNova === 'receber' ? 'entrada' : editando || contaNova ? 'saida' : 'entrada')
  const [modo, setModo] = useState<Modo>(editando?.natureza === 'retirada' || params.get('atalho') === 'retirada' ? 'retirada' : 'normal')
  const [valorTxt, setValorTxt] = useState(valorInicial(editando))
  const [categoriaId, setCategoriaId] = useState(editando?.categoriaId ?? (tipo === 'entrada' ? 'vendas' : ''))
  const [data, setData] = useState(editando?.dataCompetencia ?? hoje)
  const [escolherData, setEscolherData] = useState(!!editando && editando.dataCompetencia !== hoje)
  const [forma, setForma] = useState<FormaPagamento>(editando?.formaPagamento ?? 'pix')
  const [aPrazo, setAPrazo] = useState(editando ? editando.situacao === 'previsto' : !!contaNova)
  const [vencimento, setVencimento] = useState(editando?.dataVencimento ?? addDias(hoje, 7))
  const [repetir, setRepetir] = useState(!!editando?.recorrente)
  const [descricao, setDescricao] = useState(editando?.descricao ?? '')
  const [contraparte, setContraparte] = useState(editando?.contraparte ?? '')
  const [nota, setNota] = useState<NotaEmitida>(editando?.notaEmitida === 'sim' ? 'sim' : 'nao')
  const [pessoal, setPessoal] = useState(!!editando?.pagoComDinheiroPessoal)
  const [comprovante, setComprovante] = useState<string>('')
  const [detalhes, setDetalhes] = useState(!!(editando?.descricao || editando?.contraparte || contaNova))
  const [erro, setErro] = useState<{ valor?: string; categoria?: string }>({})
  const [salvando, setSalvando] = useState(false)
  const refValor = useRef<HTMLInputElement>(null)
  const refArquivo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    refValor.current?.focus()
  }, [])

  const categoriasDoTipo = useMemo(
    () => dados.categorias.filter((c) => c.ativa && (tipo === 'entrada' ? c.grupo === 'receita' : c.grupo !== 'receita' && c.grupo !== 'retirada')),
    [dados.categorias, tipo],
  )
  const rapidas = RAPIDAS[tipo].map((id) => categoriasDoTipo.find((c) => c.id === id)).filter((c) => !!c)
  const outras = categoriasDoTipo.filter((c) => !RAPIDAS[tipo].includes(c.id))
  const categoriaEhOutra = outras.some((c) => c.id === categoriaId)

  const mudarTipo = (t: Tipo) => {
    setTipo(t)
    setModo('normal')
    setPessoal(false)
    setCategoriaId(t === 'entrada' ? 'vendas' : '')
    setErro({})
  }

  const valor = lerValor(valorTxt)
  const portalNota = dados.empresa.atividade === 'servico' ? LINKS.nfse : dados.empresa.atividade === 'misto' && categoriaId === 'servicos' ? LINKS.nfse : LINKS.nfe

  const salvar = () => {
    const e: typeof erro = {}
    if (valor <= 0) e.valor = 'Digite o valor do lançamento.'
    if (modo === 'normal' && !categoriaId) e.categoria = 'Escolha uma categoria.'
    setErro(e)
    if (Object.keys(e).length) {
      if (e.valor) refValor.current?.focus()
      return
    }
    const natureza = modo === 'retirada' ? 'retirada' : tipo
    const previsto = aPrazo && modo === 'normal'
    const contaFinanceiraId = forma === 'dinheiro' ? (dados.contas.find((c) => c.tipo === 'caixa')?.id ?? dados.contas[0].id) : (dados.contas.find((c) => c.tipo === 'banco')?.id ?? dados.contas[0].id)
    const l: NovoLancamento = {
      natureza,
      valor,
      categoriaId: modo === 'retirada' ? 'prolabore' : categoriaId,
      contaFinanceiraId,
      situacao: previsto ? 'previsto' : 'realizado',
      dataCompetencia: data,
      dataVencimento: previsto ? vencimento : undefined,
      dataPagamento: previsto ? undefined : data,
      formaPagamento: forma,
      descricao: descricao.trim() || (modo === 'retirada' ? 'Pró-labore' : undefined),
      contraparte: contraparte.trim() || undefined,
      notaEmitida: natureza === 'entrada' ? nota : 'nao_se_aplica',
      recorrente: previsto && repetir,
      pagoComDinheiroPessoal: natureza === 'saida' && !previsto && pessoal,
    }
    setSalvando(true)
    // Feedback de processamento antes de confirmar (DESIGN.md, seção 10).
    setTimeout(() => {
      salvarLancamento(l, editando?.id)
      setSalvando(false)
      const oque = modo === 'retirada' ? 'Retirada' : previsto ? (tipo === 'entrada' ? 'Conta a receber' : 'Conta a pagar') : 'Lançamento'
      toast(`${oque} de ${brl(valor)} ${oque === 'Lançamento' ? 'salvo' : 'salva'}.`)
      if (editando || contaNova) {
        navigate(-1)
        return
      }
      setValorTxt('')
      setDescricao('')
      setContraparte('')
      setComprovante('')
      setPessoal(false)
      refValor.current?.focus()
    }, 450)
  }

  return (
    <>
      <Header
        titulo={editando ? 'Editar lançamento' : contaNova ? (contaNova === 'receber' ? 'Nova conta a receber' : 'Nova conta a pagar') : 'Novo lançamento'}
        subtitulo="Só o valor e a categoria são obrigatórios."
      />

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="flex flex-col gap-6">
          <Segmentado
            rotulo="Tipo de lançamento"
            grande
            className="w-full sm:w-auto sm:self-start"
            valor={tipo}
            onChange={mudarTipo}
            opcoes={[
              { valor: 'entrada', rotulo: 'Entrou dinheiro', icone: <ArrowUpRight size={17} className="text-success" /> },
              { valor: 'saida', rotulo: 'Saiu dinheiro', icone: <ArrowDownLeft size={17} className="text-danger" /> },
            ]}
          />

          {modo === 'retirada' && (
            <div className="flex items-start gap-3 rounded-[12px] border border-[#d6e4fb] bg-primary-soft px-4 py-3 text-[13px] text-ink">
              <UserRound size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <p className="flex-1">
                <span className="font-semibold">Retirada para mim (pró-labore).</span> Fica fora das despesas do negócio, para você ver quanto tirou para você.
              </p>
              <button onClick={() => setModo('normal')} className="text-slate hover:text-ink" aria-label="Desfazer retirada">
                <X size={16} />
              </button>
            </div>
          )}

          <div>
            <label htmlFor="valor" className="mb-1 block text-[13px] font-semibold text-ink">
              Valor
            </label>
            <div className="flex items-baseline gap-2 border-b border-line pb-2 focus-within:border-primary">
              <span className="text-[24px] font-bold text-ink-2 md:text-[28px]">R$</span>
              <input
                id="valor"
                ref={refValor}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={valorTxt}
                aria-invalid={!!erro.valor}
                onChange={(e) => {
                  setValorTxt(e.target.value.replace(/[^\d.,]/g, ''))
                  setErro((x) => ({ ...x, valor: undefined }))
                }}
                onBlur={() => valor > 0 && setValorTxt(valorInicial({ valor } as Lancamento))}
                className="num w-full bg-transparent text-[36px] font-bold text-ink placeholder:text-[#c5cfdb] focus:outline-none md:text-[40px]"
              />
            </div>
            {erro.valor && <p className="mt-1 text-[12px] text-danger">{erro.valor}</p>}
          </div>

          {modo === 'normal' && (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-ink">Categoria</p>
              <Chips
                rotulo="Categoria"
                valor={categoriaEhOutra ? '' : categoriaId}
                onChange={(v) => {
                  setCategoriaId(v)
                  setErro((x) => ({ ...x, categoria: undefined }))
                }}
                opcoes={rapidas.map((c) => ({ valor: c.id, rotulo: c.nome, icone: categoriaId === c.id ? <Check size={14} /> : undefined }))}
              />
              {outras.length > 0 && (
                <Select
                  className="mt-3 max-w-xs"
                  aria-label="Outra categoria"
                  value={categoriaEhOutra ? categoriaId : ''}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  opcoes={[{ valor: '', rotulo: 'Outra categoria…' }, ...outras.map((c) => ({ valor: c.id, rotulo: c.nome }))]}
                />
              )}
              {erro.categoria && <p className="mt-1 text-[12px] text-danger">{erro.categoria}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              {escolherData ? (
                <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value || hoje)} icone={<Calendar size={16} />} />
              ) : (
                <Select
                  label="Data"
                  icone={<Calendar size={16} />}
                  value={data === hoje ? 'hoje' : data === addDias(hoje, -1) ? 'ontem' : 'outra'}
                  onChange={(e) => {
                    if (e.target.value === 'hoje') setData(hoje)
                    else if (e.target.value === 'ontem') setData(addDias(hoje, -1))
                    else setEscolherData(true)
                  }}
                  opcoes={[
                    { valor: 'hoje', rotulo: 'Hoje' },
                    { valor: 'ontem', rotulo: 'Ontem' },
                    { valor: 'outra', rotulo: 'Outra data…' },
                  ]}
                />
              )}
            </div>
            <Select label="Forma de pagamento" icone={<CreditCard size={16} />} value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)} opcoes={FORMAS} />
            {modo === 'normal' ? (
              <Select
                label="Situação"
                icone={<Wallet size={16} />}
                value={aPrazo ? 'prazo' : 'feito'}
                onChange={(e) => setAPrazo(e.target.value === 'prazo')}
                opcoes={
                  tipo === 'entrada'
                    ? [
                        { valor: 'feito', rotulo: 'Recebido' },
                        { valor: 'prazo', rotulo: 'A receber' },
                      ]
                    : [
                        { valor: 'feito', rotulo: 'Pago' },
                        { valor: 'prazo', rotulo: 'A pagar' },
                      ]
                }
              />
            ) : (
              <div />
            )}
          </div>

          {aPrazo && modo === 'normal' && (
            <div className="anim-subir grid grid-cols-1 items-end gap-4 rounded-[12px] bg-[#f8fafc] p-4 sm:grid-cols-2">
              <Input label="Vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value || hoje)} />
              <label className="flex h-[42px] cursor-pointer items-center gap-2.5 text-[13px] font-medium text-ink">
                <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} className="size-4 accent-[#3478F6]" />
                <Repeat size={15} className="text-slate" aria-hidden />
                Repetir todo mês
              </label>
            </div>
          )}

          <div>
            <button
              onClick={() => setDetalhes((v) => !v)}
              aria-expanded={detalhes}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
            >
              {detalhes ? 'Menos detalhes' : 'Adicionar descrição ou cliente'}
              <ChevronDown size={15} className={`transition-transform duration-150 ${detalhes ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {detalhes && (
              <div className="anim-subir mt-4 grid grid-cols-1 gap-4">
                <Input label="Descrição (opcional)" placeholder="Ex.: Pedido de bolos" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                <Input
                  label={tipo === 'entrada' ? 'Cliente (opcional)' : 'Fornecedor (opcional)'}
                  placeholder={tipo === 'entrada' ? 'Ex.: João Silva' : 'Ex.: Atacadão'}
                  value={contraparte}
                  onChange={(e) => setContraparte(e.target.value)}
                />
              </div>
            )}
          </div>

          <Button tamanho="lg" onClick={salvar} carregando={salvando} className="w-full">
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar lançamento'}
          </Button>
          {editando && (
            <Button variante="discreto" onClick={() => setConfirmarExclusao(true)} className="-mt-3 self-center !text-danger hover:!bg-danger-soft">
              Excluir lançamento
            </Button>
          )}
        </Card>

        <div className="flex flex-col gap-4 md:gap-5">
          {tipo === 'entrada' && modo === 'normal' && (
            <Card>
              <p className="mb-3 text-[14px] font-semibold text-ink">Nota emitida?</p>
              <Segmentado
                rotulo="Nota emitida"
                className="w-full"
                valor={nota === 'sim' ? 'sim' : 'nao'}
                onChange={(v) => setNota(v as NotaEmitida)}
                opcoes={[
                  { valor: 'sim', rotulo: 'Sim' },
                  { valor: 'nao', rotulo: 'Não' },
                ]}
              />
              <a href={portalNota} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline">
                Emitir nota no portal
                <ExternalLink size={14} aria-hidden />
              </a>
              <p className="mt-1 text-[12px] text-ink-2">Abre o portal oficial em outra aba. Depois, marque "Sim" aqui.</p>
            </Card>
          )}

          <Card>
            <Label>Comprovante (opcional)</Label>
            <input
              ref={refArquivo}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="sr-only"
              onChange={(e) => setComprovante(e.target.files?.[0]?.name ?? '')}
            />
            {comprovante ? (
              <div className="flex items-center gap-3 rounded-[12px] border border-line bg-[#f8fafc] px-3 py-3 text-[13px]">
                <ImagePlus size={18} className="text-primary" aria-hidden />
                <span className="flex-1 truncate text-ink">{comprovante}</span>
                <button onClick={() => setComprovante('')} aria-label="Remover comprovante" className="text-slate hover:text-ink">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => refArquivo.current?.click()}
                className="flex w-full flex-col items-center gap-1.5 rounded-[12px] border border-dashed border-[#d3dce7] px-4 py-6 text-[13px] text-ink-2 transition-colors hover:border-primary hover:bg-primary-soft/40 hover:text-primary"
              >
                <ImagePlus size={22} strokeWidth={1.6} aria-hidden />
                Adicionar foto do comprovante
              </button>
            )}
          </Card>

          {tipo === 'saida' && (
            <Card className="flex flex-col gap-1">
              <p className="mb-1 text-[14px] font-semibold text-ink">Atalhos</p>
              <button
                onClick={() => {
                  setModo(modo === 'retirada' ? 'normal' : 'retirada')
                  setPessoal(false)
                  setAPrazo(false)
                }}
                aria-pressed={modo === 'retirada'}
                className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] transition-colors ${modo === 'retirada' ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-hover'}`}
              >
                <UserRound size={18} className="shrink-0 text-slate" aria-hidden />
                <span className="flex-1">
                  <span className="block font-semibold">Retirada para mim</span>
                  <span className="block text-[12px] text-ink-2">Lança como pró-labore, fora das despesas.</span>
                </span>
                {modo === 'retirada' && <Check size={16} />}
              </button>
              {modo === 'normal' && !aPrazo && (
                <div className="px-3">
                  <Toggle checked={pessoal} onChange={setPessoal} label="Paguei com dinheiro pessoal" descricao="Registra também um aporte seu, para o caixa não ficar errado." />
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      <Modal
        aberto={confirmarExclusao}
        onFechar={() => setConfirmarExclusao(false)}
        titulo="Excluir lançamento?"
        rodape={
          <>
            <Button variante="secundario" onClick={() => setConfirmarExclusao(false)}>
              Cancelar
            </Button>
            <Button
              variante="perigo"
              onClick={() => {
                if (!editando) return
                excluirLancamento(editando.id)
                toast('Lançamento excluído.')
                navigate(-1)
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>Ele sai dos totais do mês. Não dá para desfazer.</p>
      </Modal>
    </>
  )
}
