import { ArrowDown, ArrowUpRight, CircleCheck, Calendar, Check, ChevronDown, CreditCard, ExternalLink, ImagePlus, Repeat, UserRound, Wallet, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input, Label, Select, Toggle } from '../components/ui/Field'
import { Modal, useToast } from '../components/ui/Modal'
import { Chips, Segmentado } from '../components/ui/Tabs'
import { LINKS } from '../domain/parametros'
import type { FormaPagamento, Lancamento, NotaEmitida, SeFimDeSemana } from '../domain/types'
import { FORMAS } from '../data/formas'
import { useStore, type NovoLancamento } from '../data/store'
import { addDias, brl, centavosParaTexto, diasEntre, lerValor } from '../lib/format'


type Tipo = 'entrada' | 'saida'
type Modo = 'normal' | 'retirada'

// Ordem padrão das categorias rápidas, usada quando ainda não há histórico.
const PADRAO_RAPIDAS: Record<Tipo, string[]> = {
  entrada: ['vendas', 'servicos', 'outras-entradas'],
  saida: ['mercadoria', 'aluguel', 'embalagem', 'transporte'],
}

/** As categorias mais usadas nos últimos 90 dias vão para o topo. */
export function categoriasMaisUsadas(lancamentos: Lancamento[], tipo: Tipo, hoje: string, quantas: number): string[] {
  const uso = new Map<string, number>()
  for (const l of lancamentos) {
    if (l.natureza !== tipo || !l.categoriaId || l.recorrenciaId) continue
    const d = diasEntre(l.dataCompetencia, hoje)
    if (d < 0 || d > 90) continue
    uso.set(l.categoriaId, (uso.get(l.categoriaId) ?? 0) + 1)
  }
  const porUso = [...uso.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  return [...new Set([...porUso, ...PADRAO_RAPIDAS[tipo]])].slice(0, quantas)
}

/** Último lançamento do mesmo tipo com a mesma descrição ou contraparte. */
function ultimoParecido(lancamentos: Lancamento[], tipo: Tipo, campo: 'descricao' | 'contraparte', texto: string): Lancamento | undefined {
  const alvo = texto.trim().toLowerCase()
  if (!alvo) return undefined
  let melhor: Lancamento | undefined
  for (const l of lancamentos) {
    if (l.natureza !== tipo || l.espelhoDe || (l[campo] ?? '').toLowerCase() !== alvo) continue
    if (!melhor || l.dataCompetencia > melhor.dataCompetencia) melhor = l
  }
  return melhor
}

function valorInicial(l?: Pick<Lancamento, 'valor'>) {
  return l ? centavosParaTexto(l.valor) : ''
}

export function NewTransaction() {
  const { dados, hoje, salvarLancamento, excluirLancamento, recorrenciaDe } = useStore()
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
  const recEditando = editando ? recorrenciaDe(editando) : undefined
  const [repetir, setRepetir] = useState(!!recEditando?.ativa)
  const [seFimDeSemana, setSeFimDeSemana] = useState<SeFimDeSemana>(recEditando?.seFimDeSemana ?? 'manter')
  const [valorVaria, setValorVaria] = useState(!!recEditando?.valorVaria)
  const [sugerido, setSugerido] = useState('')
  const [descricao, setDescricao] = useState(editando?.descricao ?? '')
  const [contraparte, setContraparte] = useState(editando?.contraparte ?? '')
  const [nota, setNota] = useState<NotaEmitida>(editando?.notaEmitida === 'sim' ? 'sim' : 'nao')
  const [pessoal, setPessoal] = useState(!!editando?.pagoComDinheiroPessoal)
  const [comprovante, setComprovante] = useState<string>('')
  const [detalhes, setDetalhes] = useState(true)
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
  const idsRapidas = useMemo(() => categoriasMaisUsadas(dados.lancamentos, tipo, hoje, tipo === 'entrada' ? 3 : 4), [dados.lancamentos, tipo, hoje])
  const rapidas = idsRapidas.map((id) => categoriasDoTipo.find((c) => c.id === id)).filter((c) => !!c)
  const outras = categoriasDoTipo.filter((c) => !idsRapidas.includes(c.id))

  // Textos já usados pela empresa, do mais recente para o mais antigo (sugestões do autocompletar).
  const historico = useMemo(() => {
    const ordenados = dados.lancamentos.filter((l) => l.natureza === tipo && !l.espelhoDe).sort((a, b) => b.dataCompetencia.localeCompare(a.dataCompetencia))
    const unicos = (campo: 'descricao' | 'contraparte') => [...new Set(ordenados.map((l) => l[campo]?.trim()).filter((t): t is string => !!t))].slice(0, 30)
    return { descricoes: unicos('descricao'), contrapartes: unicos('contraparte') }
  }, [dados.lancamentos, tipo])

  /** Ao escolher um texto já usado, traz a categoria e a forma de pagamento da última vez. */
  const aplicarHistorico = (campo: 'descricao' | 'contraparte', texto: string) => {
    if (editando || modo !== 'normal') return
    const ultimo = ultimoParecido(dados.lancamentos, tipo, campo, texto)
    if (!ultimo?.categoriaId) return
    setCategoriaId(ultimo.categoriaId)
    setForma(ultimo.formaPagamento)
    setErro((x) => ({ ...x, categoria: undefined }))
    const nome = dados.categorias.find((c) => c.id === ultimo.categoriaId)?.nome
    setSugerido(nome ? `Categoria e forma de pagamento da última vez: ${nome}, ${FORMAS.find((f) => f.valor === ultimo.formaPagamento)?.rotulo}.` : '')
  }
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
      pagoComDinheiroPessoal: natureza === 'saida' && !previsto && pessoal,
    }
    setSalvando(true)
    // Feedback de processamento antes de confirmar (DESIGN.md, seção 10).
    setTimeout(() => {
      salvarLancamento(l, editando?.id, previsto ? { repetir, seFimDeSemana, valorVaria } : undefined)
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
      setSugerido('')
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
            estilo="azul"
            className="w-full sm:w-auto sm:self-start"
            valor={tipo}
            onChange={mudarTipo}
            opcoes={[
              { valor: 'entrada', rotulo: 'Entrou dinheiro', icone: <ArrowUpRight size={18} strokeWidth={2.3} className={tipo === 'entrada' ? 'text-white' : 'text-success'} /> },
              { valor: 'saida', rotulo: 'Saiu dinheiro', icone: <ArrowDown size={18} strokeWidth={2.3} className={tipo === 'saida' ? 'text-white' : 'text-danger'} /> },
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
            <label htmlFor="valor" className="mb-1 block text-[15px] font-bold text-ink">
              Valor
            </label>
            <div className="flex items-baseline gap-2.5 border-b-2 border-transparent pb-1 transition-colors focus-within:border-primary/40">
              <span className={`valor-grande text-[36px] md:text-[46px] ${valorTxt ? 'text-ink' : 'text-[#c5cfdb]'}`}>R$</span>
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
                className="valor-grande w-full bg-transparent text-[36px] text-ink placeholder:text-[#c5cfdb] focus:outline-none md:text-[46px]"
              />
            </div>
            {erro.valor && <p className="mt-1 text-[12px] text-danger">{erro.valor}</p>}
          </div>

          {modo === 'normal' && (
            <div>
              <p className="mb-2.5 text-[15px] font-bold text-ink">Categoria</p>
              <Chips
                rotulo="Categoria"
                valor={categoriaEhOutra ? '' : categoriaId}
                onChange={(v) => {
                  setCategoriaId(v)
                  setErro((x) => ({ ...x, categoria: undefined }))
                }}
                opcoes={rapidas.map((c) => ({ valor: c.id, rotulo: c.nome }))}
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
            <div className="anim-subir grid grid-cols-1 items-end gap-4 rounded-[16px] border border-[#e3ebf6] bg-gradient-to-b from-[#f7faff] to-[#f1f6fd] p-4 sm:grid-cols-2">
              <Input label="Vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value || hoje)} />
              <label className="flex h-11 cursor-pointer items-center gap-2.5 text-[14px] font-medium text-ink">
                <input id="repetir" type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} className="size-[18px] accent-[#3478F6]" />
                <Repeat size={15} className="text-slate" aria-hidden />
                Repetir todo mês
              </label>
              {repetir && (
                <>
                  <Select
                    label="Se vencer no sábado ou domingo"
                    value={seFimDeSemana}
                    onChange={(e) => setSeFimDeSemana(e.target.value as SeFimDeSemana)}
                    opcoes={[
                      { valor: 'manter', rotulo: 'Manter a data' },
                      { valor: 'antecipar', rotulo: 'Antecipar para sexta' },
                      { valor: 'adiar', rotulo: 'Adiar para segunda' },
                    ]}
                  />
                  <label className="flex h-11 cursor-pointer items-center gap-2.5 text-[14px] font-medium text-ink">
                    <input id="valor-varia" type="checkbox" checked={valorVaria} onChange={(e) => setValorVaria(e.target.checked)} className="size-[18px] accent-[#3478F6]" />
                    O valor muda todo mês (luz, água)
                  </label>
                </>
              )}
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
                <Input
                  label="Descrição (opcional)"
                  placeholder="Ex.: Pedido de bolos"
                  list="hist-descricao"
                  autoComplete="off"
                  value={descricao}
                  onChange={(e) => {
                    setDescricao(e.target.value)
                    if (historico.descricoes.some((t) => t.toLowerCase() === e.target.value.toLowerCase())) aplicarHistorico('descricao', e.target.value)
                  }}
                />
                <datalist id="hist-descricao">
                  {historico.descricoes.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <Input
                  label={tipo === 'entrada' ? 'Cliente (opcional)' : 'Fornecedor (opcional)'}
                  placeholder={tipo === 'entrada' ? 'Ex.: João Silva' : 'Ex.: Atacadão'}
                  list="hist-contraparte"
                  autoComplete="off"
                  value={contraparte}
                  onChange={(e) => {
                    setContraparte(e.target.value)
                    if (historico.contrapartes.some((t) => t.toLowerCase() === e.target.value.toLowerCase())) aplicarHistorico('contraparte', e.target.value)
                  }}
                />
                <datalist id="hist-contraparte">
                  {historico.contrapartes.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                {sugerido && <p className="anim-aparecer -mt-1 text-[12px] text-primary">{sugerido}</p>}
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
              <p className="mb-3 text-[15px] font-bold text-ink">Nota emitida?</p>
              <div role="radiogroup" aria-label="Nota emitida" className="grid grid-cols-2 gap-2.5">
                {(['sim', 'nao'] as const).map((o) => {
                  const ativo = (nota === 'sim' ? 'sim' : 'nao') === o
                  return (
                    <button
                      key={o}
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => setNota(o as NotaEmitida)}
                      className={`inline-flex h-12 items-center justify-center gap-2 rounded-[12px] text-[14px] font-semibold transition-all ${
                        ativo ? 'grad-primario text-white' : 'border border-line bg-surface text-ink shadow-[0_1px_2px_rgba(16,32,64,0.04)] hover:border-primary-line'
                      }`}
                    >
                      {ativo && <CircleCheck size={17} fill="white" className="text-primary" aria-hidden />}
                      {o === 'sim' ? 'Sim' : 'Não'}
                    </button>
                  )
                })}
              </div>
              <a href={portalNota} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary">
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
                className="flex w-full flex-col items-center gap-2.5 rounded-[16px] border-[1.5px] border-dashed border-[#cfdae8] bg-[#fafcff] px-4 py-8 text-[14px] text-ink-2 transition-colors hover:border-primary hover:bg-primary-soft/40 hover:text-primary"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-gradient-to-b from-[#eef4ff] to-[#dde9fd] text-primary">
                  <ImagePlus size={22} strokeWidth={1.9} aria-hidden />
                </span>
                Adicionar foto do comprovante
              </button>
            )}
          </Card>

          {tipo === 'saida' && (
            <Card className="flex flex-col gap-1">
              <p className="mb-1 text-[15px] font-bold text-ink">Atalhos</p>
              <button
                onClick={() => {
                  setModo(modo === 'retirada' ? 'normal' : 'retirada')
                  setPessoal(false)
                  setAPrazo(false)
                }}
                aria-pressed={modo === 'retirada'}
                className={`-mx-2 flex items-center gap-3 rounded-[12px] px-2 py-2.5 text-left text-[14px] transition-colors ${modo === 'retirada' ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-hover'}`}
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#f3f6fa] to-[#e5ecf4] text-[#2f4a72]">
                  <UserRound size={18} strokeWidth={2} aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">Retirada para mim</span>
                  <span className="block text-[12px] text-ink-2">Lança como pró-labore, fora das despesas.</span>
                </span>
                {modo === 'retirada' && <Check size={16} />}
              </button>
              {modo === 'normal' && !aPrazo && (
                <div className="border-t border-line">
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
