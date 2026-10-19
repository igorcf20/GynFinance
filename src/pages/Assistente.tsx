// Assistente: o cliente escreve, fala (ditado do próprio celular ou navegador), tira uma foto na
// hora ou escolhe uma do celular. O assistente devolve o que entendeu em cartões, e nada é gravado
// sem o toque em Confirmar.
import { ArrowUp, CalendarClock, Camera, Check, CircleCheck, FileText, ImagePlus, Lock, Mic, PencilLine, Sparkles, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconeCategoria } from '../components/financial/categoriaVisual'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card, EstadoVazio, IconeBox } from '../components/ui/Card'
import { Input, Select } from '../components/ui/Field'
import { useToast } from '../components/ui/Modal'
import { LIMITE_ANEXOS, perguntarAoAssistente, prepararAnexo, type Anexo } from '../data/assistente'
import { FORMAS } from '../data/formas'
import { useStore } from '../data/store'
import { detalhesDoItem, itemParaAtendimento, itemParaLancamento, montarContexto, tituloDoItem, type ItemAssistente } from '../domain/assistente'
import { temModulo } from '../domain/planos'
import type { Lancamento } from '../domain/types'
import { centavosParaTexto, lerValor, uid } from '../lib/format'

type EstadoItem = 'pendente' | 'salvando' | 'salvo' | 'descartado'

interface CartaoItem {
  id: string
  item: ItemAssistente
  estado: EstadoItem
  desfazer?: () => void
}

interface Mensagem {
  id: string
  de: 'cliente' | 'assistente'
  texto: string
  anexos?: Anexo[]
  /** Fotos da mensagem do cliente a que os itens desta resposta se referem. */
  fotos?: Anexo[]
  itens?: CartaoItem[]
  erro?: boolean
}

// A conversa fica na memória enquanto o app está aberto: sair para ver um lançamento e voltar
// não apaga nada. Recarregar a página começa do zero (fotos não ficam guardadas).
let conversaGuardada: Mensagem[] = []

const EXEMPLOS = ['Gastei 45 de gasolina hoje', 'Vendi 3 bolos por 120 no Pix', 'Boleto de 300 do fornecedor vence dia 25', 'Quanto sobrou este mês?']

/** Assistente disponível para esta conta: no plano com IA e com a IA ligada. Na demonstração, sempre. */
export function useTemAssistente(): boolean {
  const { servidor, conta } = useStore()
  return servidor !== 'com' || !conta || !!conta.assinatura?.temIa
}

// ---------- Ditado (voz para texto) do próprio navegador ----------
interface Reconhecimento {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
const Reconhecedor = (window as unknown as { SpeechRecognition?: new () => Reconhecimento; webkitSpeechRecognition?: new () => Reconhecimento }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => Reconhecimento }).webkitSpeechRecognition

function useDitado(aoOuvir: (texto: string, final: boolean) => void, aoErro: (m: string) => void) {
  const [ouvindo, setOuvindo] = useState(false)
  const rec = useRef<Reconhecimento | null>(null)
  const parar = () => rec.current?.stop()
  const comecar = () => {
    if (!Reconhecedor) return
    const r = new Reconhecedor()
    r.lang = 'pt-BR'
    r.interimResults = true
    r.continuous = false
    let dito = ''
    r.onresult = (e) => {
      let parcial = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) dito += t
        else parcial += t
      }
      aoOuvir((dito + parcial).trim(), false)
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') aoErro('O microfone está bloqueado. Libere o microfone para este site nas configurações do navegador.')
      else if (e.error !== 'no-speech' && e.error !== 'aborted') aoErro('Não deu para ouvir agora. Tente de novo ou use o microfone do teclado.')
    }
    r.onend = () => {
      setOuvindo(false)
      rec.current = null
      if (dito.trim()) aoOuvir(dito.trim(), true)
    }
    rec.current = r
    setOuvindo(true)
    r.start()
  }
  useEffect(() => () => rec.current?.stop(), [])
  return { disponivel: !!Reconhecedor, ouvindo, comecar, parar }
}

export function Assistente() {
  const store = useStore()
  const { dados, hoje, servidor, conta, modulos, bloqueio } = store
  const toast = useToast()
  const temAssistente = useTemAssistente()
  const [msgs, setMsgsEstado] = useState<Mensagem[]>(conversaGuardada)
  const setMsgs = (f: (m: Mensagem[]) => Mensagem[]) =>
    setMsgsEstado((m) => {
      conversaGuardada = f(m)
      return conversaGuardada
    })
  const [texto, setTexto] = useState('')
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [pensando, setPensando] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const camera = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)
  const fim = useRef<HTMLDivElement>(null)
  const antesDoDitado = useRef('')
  const ditado = useDitado(
    (t) => setTexto(`${antesDoDitado.current}${antesDoDitado.current && t ? ' ' : ''}${t}`),
    (m) => toast(m, { segundos: 5 }),
  )

  useEffect(() => {
    if (msgs.length) fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs.length, pensando])

  // Caixa de texto cresce com o que a pessoa escreve (até 6 linhas).
  useEffect(() => {
    const c = campo.current
    if (!c) return
    c.style.height = 'auto'
    c.style.height = `${Math.min(c.scrollHeight, 160)}px`
  }, [texto])

  if (!temAssistente) {
    const desligado = conta?.sistema && !conta.sistema.iaLigada
    return (
      <>
        <Header titulo="Assistente" />
        <Card>
          <EstadoVazio
            icone={<Lock size={24} />}
            titulo={desligado ? 'O assistente está desligado no momento' : 'O assistente não faz parte do seu plano'}
            texto={desligado ? 'Enquanto isso, lance pela tela de sempre. Avisamos quando ele voltar.' : `Seu plano atual é o ${conta?.assinatura?.planoNome ?? 'básico'}. Fale com a gente para liberar o assistente, que lê fotos de recibos e entende o que você escreve ou fala.`}
          />
        </Card>
      </>
    )
  }

  const adicionarArquivos = async (lista: FileList | null) => {
    if (!lista?.length) return
    const arquivos = [...lista].slice(0, LIMITE_ANEXOS - anexos.length)
    if (lista.length > arquivos.length) toast(`Dá para mandar até ${LIMITE_ANEXOS} fotos de cada vez.`)
    setPreparando(true)
    try {
      const prontos: Anexo[] = []
      for (const a of arquivos) prontos.push(await prepararAnexo(a))
      setAnexos((x) => [...x, ...prontos].slice(0, LIMITE_ANEXOS))
    } catch (e) {
      toast((e as Error).message, { segundos: 5 })
    } finally {
      setPreparando(false)
    }
  }

  const enviar = async (conteudo = texto) => {
    const t = conteudo.trim()
    if ((!t && !anexos.length) || pensando) return
    if (ditado.ouvindo) ditado.parar()
    const fotos = anexos
    const historico = msgs.filter((m) => !m.erro && m.texto).map((m) => ({ de: m.de, texto: m.texto }))
    setMsgs((m) => [...m, { id: uid(), de: 'cliente', texto: t, anexos: fotos }])
    setTexto('')
    setAnexos([])
    setPensando(true)
    try {
      const r = await perguntarAoAssistente(servidor === 'com' && conta ? 'servidor' : 'demo', {
        texto: t,
        anexos: fotos,
        historico,
        contexto: montarContexto(dados, hoje, temModulo(modulos, 'agenda')),
        dados,
        hoje,
      })
      setMsgs((m) => [...m, { id: uid(), de: 'assistente', texto: r.resposta, fotos, itens: r.acoes.map((item) => ({ id: uid(), item, estado: 'pendente' })) }])
    } catch (e) {
      setMsgs((m) => [...m, { id: uid(), de: 'assistente', texto: (e as Error).message, erro: true }])
    } finally {
      setPensando(false)
    }
  }

  const mudarItem = (msgId: string, itemId: string, f: (c: CartaoItem) => CartaoItem) =>
    setMsgs((m) => m.map((x) => (x.id === msgId ? { ...x, itens: x.itens?.map((c) => (c.id === itemId ? f(c) : c)) } : x)))

  /** Grava um item do jeito que as outras telas gravam (e com Desfazer). */
  const confirmar = async (msg: Mensagem, cartao: CartaoItem) => {
    if (bloqueio) return toast(bloqueio, { segundos: 5 })
    const { item } = cartao
    mudarItem(msg.id, cartao.id, (c) => ({ ...c, estado: 'salvando' }))
    try {
      const foto = item.fotoComprovante !== null ? msg.fotos?.[item.fotoComprovante] : undefined
      const comprovante =
        foto && temModulo(modulos, 'comprovantes')
          ? await store.anexarComprovante(foto.arquivo).catch(() => {
              toast('A foto não foi anexada como comprovante, mas o lançamento foi salvo.', { segundos: 5 })
              return undefined
            })
          : undefined
      let desfazer: () => void
      if (item.tipo === 'baixa') {
        const conta = dados.lancamentos.find((l) => l.id === item.lancamentoId)
        if (!conta || conta.situacao !== 'previsto') throw new Error('Essa conta já não está mais em aberto.')
        desfazer = store.registrarPagamento(conta.id, {
          modo: 'total',
          valorPago: item.valorCentavos,
          dataPagamento: item.data,
          contaFinanceiraId: item.contaId && dados.contas.some((c) => c.id === item.contaId) ? item.contaId : conta.contaFinanceiraId,
          formaPagamento: item.formaPagamento,
          comprovante,
        })
      } else if (item.tipo === 'atendimento') {
        const a = itemParaAtendimento(item)
        desfazer = store.salvarAtendimento(a, undefined, !!a.valor)
      } else {
        const id = store.salvarLancamento({ ...itemParaLancamento(item, dados), comprovante })
        desfazer = () => store.excluirLancamento(id)
      }
      mudarItem(msg.id, cartao.id, (c) => ({ ...c, estado: 'salvo', desfazer }))
    } catch (e) {
      mudarItem(msg.id, cartao.id, (c) => ({ ...c, estado: 'pendente' }))
      toast((e as Error).message, { segundos: 5 })
    }
  }

  const confirmarTodos = async (msg: Mensagem) => {
    for (const c of msg.itens ?? []) if (c.estado === 'pendente') await confirmar(msg, c)
    toast('Tudo salvo.')
  }

  const desfazer = (msg: Mensagem, c: CartaoItem) => {
    c.desfazer?.()
    mudarItem(msg.id, c.id, (x) => ({ ...x, estado: 'pendente', desfazer: undefined }))
  }

  const vazio = msgs.length === 0
  const podeEnviar = (!!texto.trim() || anexos.length > 0) && !pensando && !preparando

  return (
    <>
      <Header
        titulo="Assistente"
        subtitulo="Escreva, fale ou mande a foto do recibo. Eu organizo e você só confere."
        acoes={
          !vazio && (
            <Button variante="secundario" tamanho="sm" onClick={() => setMsgs(() => [])} disabled={pensando}>
              Nova conversa
            </Button>
          )
        }
      />

      <div className="mx-auto flex max-w-[860px] flex-col gap-4">
        {vazio ? (
          <Boasvindas
            demo={servidor !== 'com' || !conta}
            aoExemplo={(e) => void enviar(e)}
            aoCamera={() => camera.current?.click()}
            aoGaleria={() => galeria.current?.click()}
            aoFalar={
              ditado.disponivel
                ? () => {
                    antesDoDitado.current = ''
                    ditado.comecar()
                  }
                : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-4" aria-live="polite">
            {msgs.map((m) =>
              m.de === 'cliente' ? (
                <BalaoCliente key={m.id} m={m} />
              ) : (
                <BalaoAssistente key={m.id} m={m}>
                  {m.itens && m.itens.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2.5">
                      {m.itens.map((c) => (
                        <CartaoDoItem
                          key={c.id}
                          c={c}
                          foto={c.item.fotoComprovante !== null ? m.fotos?.[c.item.fotoComprovante] : undefined}
                          aoConfirmar={() => void confirmar(m, c)}
                          aoDescartar={() => mudarItem(m.id, c.id, (x) => ({ ...x, estado: 'descartado' }))}
                          aoDesfazer={() => desfazer(m, c)}
                          aoAjustar={(item) => mudarItem(m.id, c.id, (x) => ({ ...x, item }))}
                        />
                      ))}
                      {m.itens.filter((c) => c.estado === 'pendente').length > 1 && (
                        <Button className="self-start" icone={<Check size={16} />} onClick={() => void confirmarTodos(m)}>
                          Confirmar todos
                        </Button>
                      )}
                    </div>
                  )}
                </BalaoAssistente>
              ),
            )}
            {pensando && <Digitando />}
          </div>
        )}
        <div ref={fim} />

        {/* Caixa de mensagem: fica presa embaixo, acima do menu do celular. */}
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 -mx-4 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-5 pb-3 md:bottom-0 md:mx-0 md:px-0 md:pb-4">
          <div className="card !p-2.5 md:!p-3">
            {(anexos.length > 0 || preparando) && (
              <div className="mb-2.5 flex gap-2 overflow-x-auto px-1 pt-1">
                {anexos.map((a) => (
                  <span key={a.id} className="anim-subir relative shrink-0">
                    {a.previa ? (
                      <img src={a.previa} alt="Foto anexada" className="size-16 rounded-[12px] border border-line object-cover" />
                    ) : (
                      <span className="flex size-16 flex-col items-center justify-center gap-1 rounded-[12px] border border-line bg-primary-soft text-[10px] font-semibold text-primary">
                        <FileText size={20} aria-hidden />
                        PDF
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setAnexos((x) => x.filter((y) => y.id !== a.id))}
                      aria-label="Tirar esta foto"
                      className="absolute -top-1.5 -right-1.5 inline-flex size-6 items-center justify-center rounded-full bg-ink text-surface shadow-md transition-transform active:scale-90"
                    >
                      <X size={13} strokeWidth={2.6} />
                    </button>
                  </span>
                ))}
                {preparando && <span className="size-16 shrink-0 animate-pulse rounded-[12px] bg-hover" aria-label="Preparando a foto" />}
              </div>
            )}
            <div className="flex items-end gap-1.5">
              <BotaoIcone rotulo="Tirar foto agora" onClick={() => camera.current?.click()} disabled={anexos.length >= LIMITE_ANEXOS}>
                <Camera size={20} />
              </BotaoIcone>
              <BotaoIcone rotulo="Escolher foto do celular" onClick={() => galeria.current?.click()} disabled={anexos.length >= LIMITE_ANEXOS}>
                <ImagePlus size={20} />
              </BotaoIcone>
              <label className="sr-only" htmlFor="assistente-texto">
                Mensagem para o assistente
              </label>
              <textarea
                id="assistente-texto"
                ref={campo}
                rows={1}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
                    e.preventDefault()
                    void enviar()
                  }
                }}
                maxLength={2000}
                placeholder={ditado.ouvindo ? 'Pode falar, estou ouvindo...' : anexos.length ? 'Quer dizer algo sobre a foto? (opcional)' : 'Ex.: paguei 180 de luz no Pix'}
                className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] text-ink placeholder:text-muted focus:outline-none"
              />
              {ditado.disponivel && (
                <BotaoIcone
                  rotulo={ditado.ouvindo ? 'Parar de ouvir' : 'Falar'}
                  ativo={ditado.ouvindo}
                  onClick={() => {
                    if (ditado.ouvindo) return ditado.parar()
                    antesDoDitado.current = texto.trim()
                    ditado.comecar()
                  }}
                >
                  <Mic size={20} />
                </BotaoIcone>
              )}
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={!podeEnviar}
                aria-label="Enviar"
                className="grad-primario inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-all duration-200 hover:-translate-y-px active:scale-90 disabled:opacity-40 disabled:hover:translate-y-0"
              >
                <ArrowUp size={20} strokeWidth={2.4} />
              </button>
            </div>
            {!ditado.disponivel && vazio && (
              <p className="px-2 pt-1.5 text-[12px] text-ink-2">Para falar, toque no microfone do teclado do celular e dite a mensagem.</p>
            )}
          </div>
          <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void adicionarArquivos(e.target.files).finally(() => (e.target.value = ''))} />
          <input ref={galeria} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => void adicionarArquivos(e.target.files).finally(() => (e.target.value = ''))} />
        </div>
      </div>
    </>
  )
}

function BotaoIcone({ rotulo, onClick, disabled, ativo, children }: { rotulo: string; onClick: () => void; disabled?: boolean; ativo?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rotulo}
      title={rotulo}
      aria-pressed={ativo}
      className={`relative inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-90 disabled:opacity-40 ${
        ativo ? 'bg-danger text-white anim-ouvindo' : 'text-navy hover:bg-hover'
      }`}
    >
      {children}
    </button>
  )
}

function Boasvindas({ demo, aoExemplo, aoCamera, aoGaleria, aoFalar }: { demo: boolean; aoExemplo: (t: string) => void; aoCamera: () => void; aoGaleria: () => void; aoFalar?: () => void }) {
  const atalhos = [
    { icone: Camera, titulo: 'Tirar foto', texto: 'Do recibo, nota ou boleto, na hora', acao: aoCamera },
    { icone: ImagePlus, titulo: 'Escolher foto', texto: 'Um print ou foto que já está no celular', acao: aoGaleria },
    ...(aoFalar ? [{ icone: Mic, titulo: 'Falar', texto: 'Conte o que aconteceu, como num áudio', acao: aoFalar }] : []),
  ]
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col items-center px-2 pt-4 pb-2 text-center">
        <span className="grad-primario mb-4 inline-flex size-16 items-center justify-center rounded-[20px] text-white shadow-[var(--shadow-primary)]">
          <Sparkles size={30} strokeWidth={1.9} aria-hidden />
        </span>
        <h2 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Me conte o que aconteceu</h2>
        <p className="mt-1.5 max-w-md text-[14px] text-ink-2">
          Eu transformo em lançamento, conta a pagar ou a receber, baixa de conta ou horário na agenda. Você confere e confirma com um toque: nada é salvo sem você.
        </p>
      </div>
      <div className={`mt-5 grid grid-cols-1 gap-2.5 ${atalhos.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {atalhos.map((a) => (
          <button
            key={a.titulo}
            type="button"
            onClick={a.acao}
            className="group flex items-center gap-3 rounded-[16px] border border-line bg-surface p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-line hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98] sm:flex-col sm:items-start"
          >
            <IconeBox tom="azul">
              <a.icone size={20} strokeWidth={1.9} />
            </IconeBox>
            <span>
              <span className="block font-semibold text-ink">{a.titulo}</span>
              <span className="block text-[13px] text-ink-2">{a.texto}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-5 mb-2 text-[12px] font-bold tracking-[0.08em] text-slate uppercase">Ou experimente escrever</p>
      <div className="flex flex-wrap gap-2">
        {EXEMPLOS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => aoExemplo(e)}
            className="rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-all duration-200 hover:border-primary-line hover:bg-primary-soft hover:text-primary active:scale-95"
          >
            {e}
          </button>
        ))}
      </div>
      {demo && <p className="mt-4 text-[12px] text-ink-2">Na demonstração o assistente entende frases simples. No sistema de verdade ele também lê fotos e entende o jeito que você fala.</p>}
    </Card>
  )
}

function BalaoCliente({ m }: { m: Mensagem }) {
  return (
    <div className="anim-subir flex flex-col items-end gap-1.5 pl-10">
      {m.anexos && m.anexos.length > 0 && (
        <div className="flex gap-1.5">
          {m.anexos.map((a) =>
            a.previa ? (
              <img key={a.id} src={a.previa} alt="Foto enviada" className="size-20 rounded-[14px] border border-line object-cover shadow-[var(--shadow-card)]" />
            ) : (
              <span key={a.id} className="flex size-20 flex-col items-center justify-center gap-1 rounded-[14px] border border-line bg-primary-soft text-[11px] font-semibold text-primary">
                <FileText size={22} aria-hidden />
                PDF
              </span>
            ),
          )}
        </div>
      )}
      {m.texto && <p className="grad-primario max-w-full rounded-[18px] rounded-br-[6px] px-4 py-2.5 text-[15px] whitespace-pre-wrap text-white shadow-[var(--shadow-primary)]">{m.texto}</p>}
    </div>
  )
}

function BalaoAssistente({ m, children }: { m: Mensagem; children?: ReactNode }) {
  return (
    <div className="anim-subir flex items-start gap-2.5 pr-2 md:pr-10">
      <span className="grad-primario mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-white">
        <Sparkles size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`inline-block max-w-full rounded-[18px] rounded-tl-[6px] border px-4 py-2.5 text-[15px] whitespace-pre-wrap shadow-[var(--shadow-card)] ${
            m.erro ? 'border-danger/30 bg-danger-soft text-danger' : 'border-line bg-surface text-ink'
          }`}
        >
          {m.texto}
        </p>
        {/* No celular os cartões usam a largura toda, sem o recuo do ícone. */}
        {children && <div className="-ml-[42px] md:ml-0">{children}</div>}
      </div>
    </div>
  )
}

function Digitando() {
  return (
    <div className="anim-subir flex items-center gap-2.5" aria-label="O assistente está lendo">
      <span className="grad-primario inline-flex size-8 shrink-0 items-center justify-center rounded-full text-white">
        <Sparkles size={16} aria-hidden />
      </span>
      <span className="inline-flex gap-1 rounded-[18px] rounded-tl-[6px] border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-card)]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="anim-digitando size-2 rounded-full bg-primary" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </span>
    </div>
  )
}

function CartaoDoItem({
  c,
  foto,
  aoConfirmar,
  aoDescartar,
  aoDesfazer,
  aoAjustar,
}: {
  c: CartaoItem
  foto?: Anexo
  aoConfirmar: () => void
  aoDescartar: () => void
  aoDesfazer: () => void
  aoAjustar: (item: ItemAssistente) => void
}) {
  const { dados, hoje } = useStore()
  const [editando, setEditando] = useState(false)
  const { item, estado } = c
  if (estado === 'descartado')
    return (
      <p className="flex items-center gap-2 px-1 text-[13px] text-muted line-through">
        <X size={14} aria-hidden /> {tituloDoItem(item)}
      </p>
    )
  const salvo = estado === 'salvo'
  const icone =
    item.tipo === 'atendimento' ? (
      <IconeBox tom="azul" className="!size-8">
        <CalendarClock size={15} strokeWidth={2.1} />
      </IconeBox>
    ) : item.tipo === 'baixa' ? (
      <IconeBox tom="verde" className="!size-8">
        <CircleCheck size={15} strokeWidth={2.1} />
      </IconeBox>
    ) : (
      <IconeCategoria l={{ ...itemParaLancamento(item, dados), id: c.id, empresaId: '' } as Lancamento} categorias={dados.categorias} />
    )
  const cor = item.tipo !== 'lancamento' ? 'text-ink' : item.natureza === 'entrada' || item.natureza === 'aporte' ? 'text-success' : 'text-ink'
  return (
    <div className={`anim-subir rounded-[16px] border bg-surface p-3.5 transition-all duration-300 ${salvo ? 'border-success/35 bg-success-soft/40' : 'border-line shadow-[var(--shadow-card)]'}`}>
      <div className="flex items-start gap-3">
        {icone}
        <div className="min-w-0 flex-1">
          <p className={`num font-bold ${cor}`}>{tituloDoItem(item)}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">{detalhesDoItem(item, dados, hoje).join(' · ')}</p>
          {foto && <p className="mt-1 text-[12px] font-medium text-primary">A foto vai junto como comprovante</p>}
        </div>
        {foto?.previa && <img src={foto.previa} alt="" className="size-11 shrink-0 rounded-[10px] border border-line object-cover" />}
      </div>
      {editando && !salvo && (
        <Ajustes item={item} aoMudar={aoAjustar} />
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {salvo ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
                <path className="anim-check" d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Salvo
            </span>
            <Link to={item.tipo === 'atendimento' ? '/agenda' : item.situacao === 'previsto' ? '/contas' : '/lancamentos'} className="text-[13px] font-semibold text-primary hover:underline">
              Ver
            </Link>
            <button type="button" onClick={aoDesfazer} className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-ink">
              <Undo2 size={14} aria-hidden /> Desfazer
            </button>
          </>
        ) : (
          <>
            <Button tamanho="sm" icone={<Check size={15} />} carregando={estado === 'salvando'} onClick={aoConfirmar}>
              Confirmar
            </Button>
            {item.tipo !== 'baixa' && (
              <Button tamanho="sm" variante="secundario" icone={<PencilLine size={15} />} onClick={() => setEditando((e) => !e)}>
                {editando ? 'Pronto' : 'Ajustar'}
              </Button>
            )}
            <button
              type="button"
              onClick={aoDescartar}
              aria-label="Descartar"
              title="Descartar"
              className="ml-auto inline-flex size-9 items-center justify-center rounded-full text-ink-2 transition-all hover:bg-hover hover:text-ink active:scale-90"
            >
              <X size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Campos para corrigir o que o assistente entendeu, sem sair da conversa. */
function Ajustes({ item, aoMudar }: { item: ItemAssistente; aoMudar: (i: ItemAssistente) => void }) {
  const { dados } = useStore()
  const [valor, setValor] = useState(centavosParaTexto(item.valorCentavos))
  const muda = (x: Partial<ItemAssistente>) => aoMudar({ ...item, ...x })
  const grupos = item.natureza === 'entrada' ? ['receita'] : item.natureza === 'retirada' ? ['retirada'] : ['custo', 'despesa_fixa', 'despesa_variavel', 'imposto']
  const categorias = dados.categorias.filter((c) => c.ativa && grupos.includes(c.grupo))
  const lanc = item.tipo === 'lancamento' ? itemParaLancamento(item, dados) : undefined
  return (
    <div className="anim-subir mt-3 grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-2">
      <Input
        label="Valor"
        inputMode="decimal"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => {
          const v = lerValor(valor)
          if (v > 0) muda({ valorCentavos: v })
          setValor(centavosParaTexto(v > 0 ? v : item.valorCentavos))
        }}
      />
      <Input label={item.tipo === 'atendimento' ? 'Dia' : 'Data'} type="date" value={item.data} onChange={(e) => e.target.value && muda({ data: e.target.value })} />
      {item.tipo === 'atendimento' ? (
        <>
          <Input label="Hora" type="time" value={item.hora ?? '09:00'} onChange={(e) => muda({ hora: e.target.value })} />
          <Input label="Cliente" value={item.contraparte ?? ''} onChange={(e) => muda({ contraparte: e.target.value })} />
          <Input label="Serviço" className="sm:col-span-2" value={item.descricao} onChange={(e) => muda({ descricao: e.target.value })} />
        </>
      ) : (
        <>
          <Select
            label="Tipo"
            value={item.situacao === 'previsto' ? `${item.natureza}-previsto` : item.natureza}
            onChange={(e) => {
              const [natureza, previsto] = e.target.value.split('-') as [ItemAssistente['natureza'], string | undefined]
              muda({ natureza, situacao: previsto ? 'previsto' : 'realizado', vencimento: previsto ? (item.vencimento ?? item.data) : null, categoriaId: natureza === item.natureza ? item.categoriaId : null })
            }}
            opcoes={[
              { valor: 'saida', rotulo: 'Saída (já paguei)' },
              { valor: 'entrada', rotulo: 'Entrada (já recebi)' },
              { valor: 'saida-previsto', rotulo: 'Conta a pagar' },
              { valor: 'entrada-previsto', rotulo: 'Conta a receber' },
              { valor: 'retirada', rotulo: 'Retirada para mim' },
              { valor: 'aporte', rotulo: 'Dinheiro meu no negócio' },
            ]}
          />
          {item.situacao === 'previsto' && <Input label="Vence em" type="date" value={item.vencimento ?? ''} onChange={(e) => e.target.value && muda({ vencimento: e.target.value })} />}
          {item.natureza !== 'aporte' && (
            <Select label="Categoria" value={lanc?.categoriaId ?? ''} onChange={(e) => muda({ categoriaId: e.target.value })} opcoes={categorias.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
          )}
          <Select label="Conta" value={lanc?.contaFinanceiraId ?? ''} onChange={(e) => muda({ contaId: e.target.value })} opcoes={dados.contas.filter((c) => c.ativa).map((c) => ({ valor: c.id, rotulo: c.nome }))} />
          <Select label="Forma" value={item.formaPagamento} onChange={(e) => muda({ formaPagamento: e.target.value as ItemAssistente['formaPagamento'] })} opcoes={FORMAS} />
          <Input label="Descrição" value={item.descricao} onChange={(e) => muda({ descricao: e.target.value })} />
        </>
      )}
    </div>
  )
}
