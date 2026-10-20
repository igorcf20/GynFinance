// Peças do suporte usadas pelo cliente (Ajuda e suporte) e pela equipe (painel de superadmin):
// conversa, envio de fotos, resposta e o selo da situação do chamado.
import { Camera, ImagePlus, Loader2, Lock, SendHorizontal, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { prepararFoto, type FotoPronta } from '../../data/suporte'
import { MAX_FOTOS, rotuloSituacao, type MensagemTicket, type NovaMensagem, type SituacaoTicket } from '../../domain/suporte'
import { uid } from '../../lib/format'
import { LogoMarca } from '../layout/Logo'
import { Badge, type TomBadge } from '../ui/Badge'
import { Modal } from '../ui/Modal'

export const TOM_SITUACAO_TICKET: Record<SituacaoTicket, TomBadge> = { aberto: 'azul', em_andamento: 'ambar', aguardando_cliente: 'verde', resolvido: 'neutro' }

export function SeloTicket({ situacao, paraCliente }: { situacao: SituacaoTicket; paraCliente?: boolean }) {
  return <Badge tom={TOM_SITUACAO_TICKET[situacao]}>{rotuloSituacao(situacao, paraCliente)}</Badge>
}

/** "agora", "há 5 min", "hoje às 14:32", "ontem às 09:10", "12/10 às 16:00". */
export function quando(iso: string): string {
  const d = new Date(iso)
  const min = Math.round((Date.now() - d.getTime()) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const hoje = new Date()
  const ontem = new Date(Date.now() - 864e5)
  if (d.toDateString() === hoje.toDateString()) return `hoje às ${hora}`
  if (d.toDateString() === ontem.toDateString()) return `ontem às ${hora}`
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', ...(d.getFullYear() !== hoje.getFullYear() && { year: 'numeric' }) })
  return `${dia} às ${hora}`
}

export const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?'

/** Foto aberta em tamanho grande. */
export function VerFoto({ url, nome, onFechar }: { url: string | null; nome?: string; onFechar: () => void }) {
  return (
    <Modal aberto={!!url} onFechar={onFechar} titulo={nome ?? 'Foto'} larga>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img src={url} alt={nome ?? 'Foto enviada no chamado'} className="mx-auto max-h-[70dvh] w-auto rounded-[12px] border border-line object-contain" />
        </a>
      )}
    </Modal>
  )
}

/**
 * Conversa do chamado. O lado de quem está olhando fica à direita (cliente na tela de Ajuda,
 * equipe no painel); notas internas aparecem em amarelo e só no painel.
 */
export function Conversa({ mensagens, lado, nomeCliente }: { mensagens: MensagemTicket[]; lado: 'cliente' | 'suporte'; nomeCliente: string }) {
  const [foto, setFoto] = useState<{ url: string; nome: string } | null>(null)
  const fim = useRef<HTMLDivElement>(null)
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [mensagens.length])
  return (
    <ol className="flex flex-col gap-4" aria-label="Mensagens do chamado">
      {mensagens.map((m, i) => {
        const meu = m.autor === lado
        return (
          <li key={m.id} className={`anim-subir flex items-end gap-2.5 ${meu ? 'flex-row-reverse' : ''}`} style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
            {m.autor === 'suporte' ? (
              <span className="mb-5 inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface shadow-[var(--shadow-card)]">
                <LogoMarca size={20} />
              </span>
            ) : (
              <span className="mb-5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#eef3f9] to-[#dfe7f1] text-[12px] font-bold text-[#2f4a72]">
                {iniciais(m.autorNome || nomeCliente)}
              </span>
            )}
            <div className={`flex max-w-[min(560px,85%)] min-w-0 flex-col ${meu ? 'items-end' : 'items-start'}`}>
              <div
                className={`rounded-[18px] px-4 py-3 text-[14px] leading-relaxed break-words whitespace-pre-wrap ${
                  m.interna
                    ? 'rounded-bl-[6px] border border-dashed border-[#f3c58f] bg-warning-soft text-ink'
                    : meu
                      ? 'grad-primario rounded-br-[6px] text-white'
                      : 'rounded-bl-[6px] border border-line bg-surface text-ink shadow-[var(--shadow-card)]'
                }`}
              >
                {m.interna && (
                  <span className="mb-1 flex items-center gap-1 text-[11px] font-bold tracking-wide text-warning uppercase">
                    <Lock size={11} aria-hidden /> Nota interna, o cliente não vê
                  </span>
                )}
                {m.texto}
                {m.anexos.length > 0 && (
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    {m.anexos.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setFoto({ url: a.url, nome: a.nome })}
                        className="group relative aspect-square overflow-hidden rounded-[10px] bg-white/20 ring-1 ring-black/5"
                        aria-label={`Abrir foto ${a.nome}`}
                      >
                        <img src={a.url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="mt-1 px-1 text-[11px] text-muted">
                {m.autor === 'suporte' ? m.autorNome || 'Equipe Gynfinance' : m.autorNome || nomeCliente} · {quando(m.criadoEm)}
              </span>
            </div>
          </li>
        )
      })}
      <div ref={fim} />
      <VerFoto url={foto?.url ?? null} nome={foto?.nome} onFechar={() => setFoto(null)} />
    </ol>
  )
}

/** Escolher fotos (galeria ou câmera), com miniaturas e o limite de 5 por mensagem. */
export function useFotos() {
  const [fotos, setFotos] = useState<FotoPronta[]>([])
  const [preparando, setPreparando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  async function adicionar(lista: FileList | File[] | null) {
    if (!lista?.length) return
    setErro(null)
    const arquivos = Array.from(lista)
    const cabem = MAX_FOTOS - fotos.length
    if (cabem <= 0) return setErro(`Cabem até ${MAX_FOTOS} fotos por mensagem.`)
    if (arquivos.length > cabem) setErro(`Cabem até ${MAX_FOTOS} fotos por mensagem: ficaram as ${cabem} primeiras.`)
    setPreparando(true)
    const prontas: FotoPronta[] = []
    for (const a of arquivos.slice(0, cabem)) {
      try {
        prontas.push(await prepararFoto(a))
      } catch (e) {
        setErro((e as Error).message)
      }
    }
    setFotos((f) => [...f, ...prontas].slice(0, MAX_FOTOS))
    setPreparando(false)
  }
  return { fotos, preparando, erro, adicionar, tirar: (id: string) => setFotos((f) => f.filter((x) => x.anexo.id !== id)), limpar: () => setFotos([]), setErro }
}

export function EscolherFotos({ f, compacto }: { f: ReturnType<typeof useFotos>; compacto?: boolean }) {
  const id = useId()
  const camera = useId()
  const [arrastando, setArrastando] = useState(false)
  const cheio = f.fotos.length >= MAX_FOTOS
  return (
    <div>
      {!compacto && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setArrastando(true)
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastando(false)
            void f.adicionar(e.dataTransfer.files)
          }}
          className={`flex flex-col items-center gap-3 rounded-[16px] border-[1.5px] border-dashed px-4 py-5 text-center transition-colors duration-200 sm:flex-row sm:text-left ${
            arrastando ? 'border-primary bg-primary-soft' : 'border-[#d3dce8] bg-[#fafbfd]'
          }`}
        >
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#eef4ff] to-[#dde9fd] text-primary">
            <ImagePlus size={22} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink">Fotos ou prints da tela</p>
            <p className="text-[12px] text-ink-2">Mostre o que aparece para você. Até {MAX_FOTOS} imagens; a gente reduz o tamanho antes de enviar.</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <label
              htmlFor={id}
              aria-disabled={cheio}
              className={`inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-line bg-surface px-4 text-[13px] font-semibold text-ink shadow-[0_1px_2px_rgba(16,32,64,0.04)] transition-colors hover:border-primary-line hover:text-primary sm:flex-none ${cheio ? 'pointer-events-none opacity-50' : ''}`}
            >
              <ImagePlus size={16} aria-hidden /> Escolher
            </label>
            {/* No celular abre a câmera direto. */}
            <label
              htmlFor={camera}
              aria-disabled={cheio}
              className={`inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-line bg-surface px-4 text-[13px] font-semibold text-ink shadow-[0_1px_2px_rgba(16,32,64,0.04)] transition-colors hover:border-primary-line hover:text-primary sm:hidden ${cheio ? 'pointer-events-none opacity-50' : ''}`}
            >
              <Camera size={16} aria-hidden /> Câmera
            </label>
          </div>
        </div>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        disabled={cheio}
        onChange={(e) => {
          void f.adicionar(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        id={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={cheio}
        onChange={(e) => {
          void f.adicionar(e.target.files)
          e.target.value = ''
        }}
      />
      {(f.fotos.length > 0 || f.preparando) && (
        <ul className={`flex flex-wrap gap-2 ${compacto ? 'mb-2' : 'mt-3'}`} aria-label="Fotos escolhidas">
          {f.fotos.map((x) => (
            <li key={x.anexo.id} className="anim-aparecer relative size-[72px] overflow-hidden rounded-[12px] border border-line bg-[#f3f6fa]">
              <img src={x.previa} alt={x.anexo.nome} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => f.tirar(x.anexo.id)}
                aria-label={`Tirar ${x.anexo.nome}`}
                className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-full bg-ink/75 text-white backdrop-blur transition-transform hover:scale-110"
              >
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
          {f.preparando && (
            <li className="flex size-[72px] items-center justify-center rounded-[12px] border border-dashed border-line text-primary">
              <Loader2 size={20} className="animate-spin" aria-label="Preparando foto" />
            </li>
          )}
        </ul>
      )}
      {f.erro && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-danger">
          {f.erro}
        </p>
      )}
      {!compacto && f.fotos.length > 0 && (
        <p className="mt-1.5 text-[12px] text-muted">
          {f.fotos.length} de {MAX_FOTOS} fotos
        </p>
      )}
    </div>
  )
}

/** Caixa de resposta com fotos. Guarda o texto se o envio falhar. */
export function Responder({
  onEnviar,
  placeholder = 'Escreva sua mensagem',
  extra,
  rotuloEnviar = 'Enviar',
  bloqueado,
}: {
  onEnviar: (m: NovaMensagem) => Promise<void>
  placeholder?: string
  /** Controles a mais (nota interna, nova situação), à esquerda do botão. */
  extra?: ReactNode
  rotuloEnviar?: string
  bloqueado?: boolean
}) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const f = useFotos()
  const campoId = useId()
  const area = useRef<HTMLTextAreaElement>(null)
  // A caixa cresce com o texto até umas 8 linhas.
  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [texto])
  const vazio = !texto.trim()
  async function enviar() {
    if (vazio || enviando || f.preparando) return
    setEnviando(true)
    setErro(null)
    try {
      await onEnviar({ id: uid(), texto: texto.trim(), anexos: f.fotos.map((x) => x.anexo) })
      setTexto('')
      f.limpar()
    } catch (e) {
      setErro(navigator.onLine ? (e as Error).message : 'Você está sem internet. Sua mensagem continua aqui; envie quando a conexão voltar.')
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div className="rounded-[18px] border border-line bg-surface p-3 shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 focus-within:border-primary-line focus-within:shadow-[0_0_0_4px_rgba(52,120,246,0.10)]">
      <EscolherFotos f={f} compacto />
      <label htmlFor={campoId} className="sr-only">
        {placeholder}
      </label>
      <textarea
        id={campoId}
        ref={area}
        rows={2}
        value={texto}
        disabled={bloqueado}
        onChange={(e) => setTexto(e.target.value.slice(0, 5000))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void enviar()
        }}
        placeholder={placeholder}
        className="block w-full resize-none bg-transparent px-1 py-1 text-[14px] text-ink placeholder:text-muted focus:outline-none"
      />
      {erro && (
        <p role="alert" className="px-1 pb-1 text-[12px] font-medium text-danger">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <AnexarFoto f={f} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{extra}</div>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={vazio || enviando || f.preparando || bloqueado}
          className="reflexo grad-primario inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold text-white transition-all duration-200 hover:-translate-y-px active:scale-[0.97] disabled:translate-y-0 disabled:opacity-50"
        >
          {enviando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <SendHorizontal size={16} aria-hidden />}
          {rotuloEnviar}
        </button>
      </div>
    </div>
  )
}

function AnexarFoto({ f }: { f: ReturnType<typeof useFotos> }) {
  const id = useId()
  const cheio = f.fotos.length >= MAX_FOTOS
  return (
    <>
      <label
        htmlFor={id}
        title="Anexar foto"
        className={`inline-flex size-10 cursor-pointer items-center justify-center rounded-[12px] text-ink-2 transition-colors hover:bg-hover hover:text-primary ${cheio ? 'pointer-events-none opacity-40' : ''}`}
      >
        <ImagePlus size={19} aria-hidden />
        <span className="sr-only">Anexar foto</span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        disabled={cheio}
        onChange={(e) => {
          void f.adicionar(e.target.files)
          e.target.value = ''
        }}
      />
    </>
  )
}
