import { ExternalLink, ImageUp, RotateCcw, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, Skeleton } from '../../components/ui/Card'
import { Input } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Modal'
import type { FonteAdmin } from '../../data/admin'
import { SECOES_SITE, type CampoSite } from '../../domain/conteudoSite'
import { Texto, useCarregar } from './comum'

const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

export function AbaSite({ fonte }: { fonte: FonteAdmin }) {
  const toast = useToast()
  const buscar = useCallback(() => fonte.site(), [fonte])
  const { dados, recarregar } = useCarregar(buscar)
  const [secao, setSecao] = useState(SECOES_SITE[0].id)
  // Só o que a pessoa mexeu e ainda não salvou.
  const [rascunho, setRascunho] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const conteudo = useMemo(() => ({ ...(dados?.conteudo ?? {}), ...rascunho }), [dados, rascunho])
  const mudancas = Object.keys(rascunho).filter((k) => (rascunho[k] ?? '') !== (dados?.conteudo[k] ?? ''))
  const s = SECOES_SITE.find((x) => x.id === secao)!

  // Sair com mudança sem salvar: o navegador pergunta antes.
  useEffect(() => {
    if (!mudancas.length) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [mudancas.length])

  if (!dados) return <Skeleton className="h-96" />
  const salvar = async () => {
    setSalvando(true)
    try {
      await fonte.salvarSite(Object.fromEntries(mudancas.map((k) => [k, rascunho[k]])))
      await recarregar()
      setRascunho({})
      toast(fonte.demonstracao ? 'Salvo na demonstração (no sistema de verdade, o site muda na hora).' : 'Site atualizado. Quem abrir o site já vê as mudanças.')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  const editadas = (id: string) => SECOES_SITE.find((x) => x.id === id)!.campos.filter((c) => conteudo[c.chave]?.trim()).length

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-[240px_1fr]">
      {/* Seções: lista ao lado no computador, rolagem na horizontal no celular. */}
      <nav aria-label="Partes do site" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
        {SECOES_SITE.map((x) => {
          const n = editadas(x.id)
          return (
            <button
              key={x.id}
              onClick={() => setSecao(x.id)}
              aria-current={x.id === secao}
              className={`flex shrink-0 items-center justify-between gap-3 rounded-[12px] px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors ${
                x.id === secao ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-hover hover:text-ink'
              }`}
            >
              {x.titulo}
              {n > 0 && <span className="num rounded-full bg-white/80 px-1.5 text-[11px] text-primary">{n}</span>}
            </button>
          )
        })}
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <div className="mb-4">
            <h2 className="text-[17px] font-bold text-ink">{s.titulo}</h2>
            {s.descricao && <p className="text-[13px] text-ink-2">{s.descricao}</p>}
          </div>
          <div className="flex flex-col gap-5">
            {s.campos.map((c) => (
              <Campo key={c.chave} campo={c} valor={conteudo[c.chave] ?? ''} fonte={fonte} onChange={(v) => setRascunho((r) => ({ ...r, [c.chave]: v }))} />
            ))}
          </div>
        </Card>
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center gap-3 rounded-[16px] border border-line bg-surface/95 p-3 shadow-[var(--shadow-pop)] backdrop-blur md:bottom-4">
          <p className="min-w-0 flex-1 text-[13px] text-ink-2">
            {mudancas.length ? `${mudancas.length} mudança${mudancas.length === 1 ? '' : 's'} sem salvar.` : 'Campo em branco usa o texto original do site.'}
          </p>
          {!fonte.demonstracao && (
            <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">
              Ver o site <ExternalLink size={14} aria-hidden />
            </a>
          )}
          {mudancas.length > 0 && (
            <Button variante="discreto" tamanho="sm" onClick={() => setRascunho({})}>
              Desfazer
            </Button>
          )}
          <Button tamanho="sm" onClick={salvar} carregando={salvando} disabled={!mudancas.length}>
            Salvar site
          </Button>
        </div>
      </div>
    </div>
  )
}

function Campo({ campo: c, valor, fonte, onChange }: { campo: CampoSite; valor: string; fonte: FonteAdmin; onChange: (v: string) => void }) {
  if (c.tipo === 'imagem') return <CampoImagem campo={c} valor={valor} fonte={fonte} onChange={onChange} />
  const ajuda = c.ajuda && <p className="mt-1 text-[12px] text-ink-2">{c.ajuda}</p>
  if (c.tipo === 'texto-longo')
    return (
      <div>
        <Texto label={c.rotulo} rows={3} value={valor} onChange={(e) => onChange(e.target.value)} placeholder={c.padrao} />
        {ajuda}
      </div>
    )
  return (
    <div>
      <Input
        label={c.rotulo}
        value={c.tipo === 'data' ? valor || c.padrao : valor}
        onChange={(e) => onChange(e.target.value)}
        type={c.tipo === 'data' ? 'date' : undefined}
        placeholder={c.padrao || (c.tipo === 'telefone' ? '62999990000' : c.tipo === 'email' ? 'contato@seudominio.com.br' : c.tipo === 'link' ? 'https://' : '')}
        inputMode={c.tipo === 'telefone' ? 'tel' : c.tipo === 'email' ? 'email' : c.tipo === 'link' ? 'url' : undefined}
      />
      {ajuda}
    </div>
  )
}

function CampoImagem({ campo: c, valor, fonte, onChange }: { campo: CampoSite; valor: string; fonte: FonteAdmin; onChange: (v: string) => void }) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const atual = valor || c.padrao
  // Imagem original fica na pasta do site (img/...); a enviada vem do servidor (ou da memória, na demonstração).
  const src = atual.startsWith('img/') ? (fonte.demonstracao ? '' : `/${atual}`) : atual
  const enviar = async (f: File | undefined) => {
    if (!f) return
    if (!TIPOS_IMAGEM.includes(f.type)) return toast('Use uma imagem JPG, PNG, WebP ou SVG.')
    if (f.size > 3 * 1024 * 1024) return toast('A imagem precisa ter até 3 MB.')
    setEnviando(true)
    try {
      const img = await fonte.enviarImagem(f)
      onChange(img.url)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setEnviando(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink-2">{c.rotulo}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex aspect-[16/10] w-full max-w-[260px] items-center justify-center overflow-hidden rounded-[12px] border border-line bg-[#f5f7fa]">
          {src ? <img src={src} alt="" className="size-full object-cover object-top" /> : <span className="flex flex-col items-center gap-1 text-[12px] text-ink-2"><ImageUp size={22} aria-hidden />Imagem original do site</span>}
        </div>
        <div className="flex flex-col items-start gap-2">
          <input ref={input} type="file" accept={TIPOS_IMAGEM.join(',')} className="sr-only" tabIndex={-1} onChange={(e) => enviar(e.target.files?.[0])} />
          <Button variante="secundario" tamanho="sm" icone={<Upload size={15} />} carregando={enviando} onClick={() => input.current?.click()}>
            Trocar imagem
          </Button>
          {valor && (
            <Button variante="discreto" tamanho="sm" icone={<RotateCcw size={15} />} onClick={() => onChange('')}>
              Voltar à original
            </Button>
          )}
          {c.ajuda && <p className="max-w-xs text-[12px] text-ink-2">{c.ajuda}</p>}
        </div>
      </div>
    </div>
  )
}
