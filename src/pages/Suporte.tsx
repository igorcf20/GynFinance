// Ajuda e suporte: o cliente abre chamados com fotos, a tela onde estava e os erros recentes do
// app, e conversa com a equipe por aqui. Os dados do perfil vão junto sozinhos.
import { ArrowLeft, Bug, Check, ChevronDown, ChevronRight, CircleHelp, Clock, CreditCard, Inbox, Lightbulb, LifeBuoy, MessageCircle, MonitorSmartphone, Plus, RefreshCw, UserRound, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Conversa, EscolherFotos, quando, Responder, SeloTicket, useFotos } from '../components/suporte/comum'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, EstadoVazio, Skeleton } from '../components/ui/Card'
import { Input, Label, Select } from '../components/ui/Field'
import { useToast } from '../components/ui/Modal'
import { api } from '../data/api'
import { useStore } from '../data/store'
import { linkWhatsapp } from '../components/agenda/visual'
import { valorPadrao } from '../domain/conteudoSite'
import { definirNaoLidos, nomeDaPagina, PAGINAS_ESCOLHA, suporteDemo, suporteServidor, type FonteSuporte } from '../data/suporte'
import { CATEGORIAS_TICKET, SITUACOES_TICKET, type CategoriaTicket, type PerfilTicket, type ResumoTicket, type Ticket } from '../domain/suporte'
import { contextoTecnico, errosRecentes, ultimaPaginaAntesDoSuporte } from '../lib/erros'
import { uid } from '../lib/format'

const ICONE_CATEGORIA: Record<CategoriaTicket, typeof Bug> = { problema: Bug, duvida: CircleHelp, financeiro: CreditCard, sugestao: Lightbulb, outro: MessageCircle }
const ATIVIDADE: Record<string, string> = { comercio: 'Comércio', servico: 'Serviços', industria: 'Indústria', misto: 'Comércio e serviços' }

/** Perfil que vai no chamado. Com servidor, ele mesmo monta pela conta; aqui é para mostrar. */
function usePerfil(): PerfilTicket {
  const { conta, dados } = useStore()
  const e = dados.empresa
  return {
    nome: conta?.usuario.nome ?? e.nomeDono,
    email: conta?.usuario.email ?? 'voce@exemplo.com',
    negocio: { nome: e.nomeFantasia, cnpj: e.cnpj, ehMei: e.ehMei, uf: e.uf, municipio: e.municipio, atividade: e.atividade },
    plano: conta?.assinatura?.planoNome ?? 'Essencial',
    situacaoAssinatura: conta?.assinatura?.situacao,
  }
}

/** Horário e WhatsApp do atendimento, os mesmos do rodapé do site (editados no superadmin, em Site). */
function useAtendimento(): { horario: string; whatsapp: string; mensagem: string } {
  const { servidor } = useStore()
  const [conteudo, setConteudo] = useState<Record<string, string>>({})
  useEffect(() => {
    if (servidor !== 'com') return
    api<{ conteudo?: Record<string, string> }>('GET', 'publico/site').then(
      (r) => setConteudo(r.conteudo ?? {}),
      () => {},
    )
  }, [servidor])
  const valor = (chave: string) => conteudo[chave]?.trim() || valorPadrao(chave) || ''
  return { horario: valor('atendimento.horario'), whatsapp: valor('contato.whatsapp'), mensagem: 'Olá! Sou cliente do Gynfinance e preciso de ajuda.' }
}

export function Suporte() {
  const { servidor } = useStore()
  const fonte = servidor === 'com' ? suporteServidor : suporteDemo().cliente
  const [params, setParams] = useSearchParams()
  const aberto = params.get('chamado')
  const novo = params.get('novo') === '1'
  const [lista, setLista] = useState<ResumoTicket[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const r = await fonte.meus()
      setLista(r.tickets)
      definirNaoLidos(r.naoLidos)
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [fonte])
  useEffect(() => {
    void carregar()
  }, [carregar])

  const atendimento = useAtendimento()
  const abrir = (id: string) => setParams({ chamado: id })
  const voltar = () => setParams({}, { replace: true })
  const detalhe = novo || !!aberto

  return (
    <>
      <Header titulo="Ajuda e suporte" subtitulo="Fale com a equipe do Gynfinance. A resposta chega aqui e no aviso do topo." />
      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* No celular a lista some quando um chamado está aberto. */}
        <div className={`flex min-w-0 flex-col gap-4 ${detalhe ? 'hidden lg:flex' : ''}`}>
          <Card className="relative overflow-hidden">
            <span aria-hidden className="pointer-events-none absolute -top-16 -right-14 size-44 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex items-start gap-3.5">
              <span className="grad-primario inline-flex size-12 shrink-0 items-center justify-center rounded-[14px] text-white">
                <LifeBuoy size={23} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-ink">Precisa de ajuda?</p>
                <p className="mt-0.5 text-[13px] text-ink-2">Conte o que aconteceu e mande um print. Seus dados e a tela onde você estava vão junto, sem precisar digitar.</p>
              </div>
            </div>
            <Button className="relative mt-4 w-full" icone={<Plus size={17} aria-hidden />} onClick={() => setParams({ novo: '1' })}>
              Abrir um chamado
            </Button>
            <div className="relative mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line pt-3.5 text-[13px] text-ink-2">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Clock size={15} className="shrink-0 text-primary" aria-hidden />
                <span>{atendimento.horario}</span>
              </span>
              {atendimento.whatsapp && (
                <a
                  href={linkWhatsapp(atendimento.whatsapp, atendimento.mensagem)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-success hover:underline"
                >
                  <MessageCircle size={15} aria-hidden /> WhatsApp
                </a>
              )}
            </div>
          </Card>

          <Card className="!p-2">
            <p className="px-3 pt-2 pb-1 text-[13px] font-semibold text-ink-2">Meus chamados</p>
            {erro && <ErroCarregar texto={erro} onTentar={carregar} />}
            {!lista && !erro && (
              <div className="flex flex-col gap-2 p-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-[68px]" />
                ))}
              </div>
            )}
            {lista?.length === 0 && <EstadoVazio icone={<Inbox size={24} />} titulo="Nenhum chamado ainda" texto="Quando você abrir um, ele aparece aqui com as respostas da equipe." />}
            <ul className="flex flex-col">
              {lista?.map((t) => (
                <li key={t.id}>
                  <ItemChamado t={t} ativo={t.id === aberto} onAbrir={() => abrir(t.id)} />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className={`min-w-0 ${detalhe ? '' : 'hidden lg:block'}`}>
          {novo ? (
            <NovoChamado fonte={fonte} onVoltar={voltar} onCriado={(id) => {
                void carregar()
                setParams({ chamado: id }, { replace: true })
              }} />
          ) : aberto ? (
            <DetalheChamado key={aberto} fonte={fonte} id={aberto} onVoltar={voltar} onMudou={carregar} />
          ) : (
            <Card className="hidden h-full min-h-[420px] lg:flex lg:items-center lg:justify-center">
              <EstadoVazio
                icone={<MessageCircle size={24} />}
                titulo="Escolha um chamado ao lado"
                texto="Ou abra um novo. A equipe responde em horário comercial, geralmente no mesmo dia."
                acao={
                  <Button variante="contorno" icone={<Plus size={16} aria-hidden />} onClick={() => setParams({ novo: '1' })}>
                    Abrir um chamado
                  </Button>
                }
              />
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function ErroCarregar({ texto, onTentar }: { texto: string; onTentar: () => void }) {
  return (
    <div role="alert" className="m-2 flex items-center gap-3 rounded-[12px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
      {!navigator.onLine && <WifiOff size={16} aria-hidden />}
      <span className="flex-1">{navigator.onLine ? texto : 'Sem internet. Os chamados aparecem quando a conexão voltar.'}</span>
      <button type="button" onClick={onTentar} className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
        <RefreshCw size={14} aria-hidden /> Tentar de novo
      </button>
    </div>
  )
}

function ItemChamado({ t, ativo, onAbrir }: { t: ResumoTicket; ativo: boolean; onAbrir: () => void }) {
  const Icone = ICONE_CATEGORIA[t.categoria]
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-current={ativo ? 'true' : undefined}
      className={`group flex w-full items-start gap-3 rounded-[14px] px-3 py-3 text-left transition-all duration-200 ${ativo ? 'bg-primary-soft' : 'hover:bg-hover'}`}
    >
      <span className={`mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full ${ativo ? 'grad-primario text-white' : 'bg-gradient-to-b from-[#f3f6fa] to-[#e8eef5] text-[#4a6385]'}`}>
        <Icone size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`truncate text-[14px] text-ink ${t.naoLido ? 'font-bold' : 'font-semibold'}`}>{t.assunto}</span>
          {t.naoLido && <span className="anim-pulso size-2 shrink-0 rounded-full bg-primary" aria-label="Resposta nova" />}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-2">
          {t.ultimaMensagem ? `${t.ultimaMensagem.autor === 'suporte' ? 'Equipe: ' : 'Você: '}${t.ultimaMensagem.texto}` : ''}
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
          <SeloTicket situacao={t.situacao} paraCliente />
          <span className="num">#{t.numero}</span>
          <span>· {quando(t.atualizadoEm)}</span>
        </span>
      </span>
      <ChevronRight size={16} className="mt-3 shrink-0 text-slate transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  )
}

/** Recebido → Em análise → Respondido → Resolvido. */
function Etapas({ situacao }: { situacao: Ticket['situacao'] }) {
  const atual = SITUACOES_TICKET.findIndex((s) => s.valor === situacao)
  return (
    <ol className="flex items-center gap-1.5" aria-label="Andamento do chamado">
      {SITUACOES_TICKET.map((s, i) => (
        <li key={s.valor} className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="relative h-1.5 overflow-hidden rounded-full bg-[#e7ecf3]">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#4b8dfb] to-[#2b6ae9] transition-[width] duration-700 ease-[var(--curva)]"
              style={{ width: i <= atual ? '100%' : '0%', transitionDelay: `${i * 120}ms` }}
            />
          </span>
          <span className={`truncate text-[11px] ${i === atual ? 'font-bold text-ink' : 'text-muted'}`} aria-current={i === atual ? 'step' : undefined}>
            {s.paraCliente}
          </span>
        </li>
      ))}
    </ol>
  )
}

function DetalheChamado({ fonte, id, onVoltar, onMudou }: { fonte: FonteSuporte; id: string; onVoltar: () => void; onMudou: () => Promise<void> }) {
  const [t, setT] = useState<Ticket | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [resolvendo, setResolvendo] = useState(false)
  const avisar = useToast()
  const carregar = useCallback(async () => {
    try {
      setT(await fonte.ler(id))
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [fonte, id])
  useEffect(() => {
    // Abrir marca como lido: a lista e o aviso do topo atualizam.
    void carregar().then(onMudou)
  }, [carregar, onMudou])

  if (erro)
    return (
      <Card>
        <Voltar onVoltar={onVoltar} />
        <ErroCarregar texto={erro} onTentar={carregar} />
      </Card>
    )
  if (!t)
    return (
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-24 w-4/5" />
        <Skeleton className="ml-auto h-16 w-3/5" />
      </Card>
    )

  const resolvido = t.situacao === 'resolvido'
  return (
    <Card className="flex flex-col gap-5">
      <div>
        <Voltar onVoltar={onVoltar} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="num text-[12px] font-semibold text-muted">
              Chamado #{t.numero} · aberto {quando(t.criadoEm)}
            </p>
            <h2 className="mt-0.5 text-[19px] font-bold tracking-[-0.01em] text-ink">{t.assunto}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
              <Badge>{CATEGORIAS_TICKET.find((c) => c.valor === t.categoria)?.rotulo}</Badge>
              {t.paginaNome && <Badge icone={<MonitorSmartphone size={12} aria-hidden />}>{t.paginaNome}</Badge>}
            </p>
          </div>
          {!resolvido && (
            <Button
              variante="secundario"
              tamanho="sm"
              carregando={resolvendo}
              icone={<Check size={15} aria-hidden />}
              onClick={async () => {
                setResolvendo(true)
                try {
                  await fonte.resolver(t.id)
                  avisar('Que bom! Chamado marcado como resolvido.')
                  await carregar()
                  await onMudou()
                } catch (e) {
                  avisar((e as Error).message)
                } finally {
                  setResolvendo(false)
                }
              }}
            >
              Já foi resolvido
            </Button>
          )}
        </div>
        <div className="mt-4">
          <Etapas situacao={t.situacao} />
        </div>
      </div>

      <div className="rounded-[16px] bg-[#f7f9fc] p-3 sm:p-4">
        <Conversa mensagens={t.mensagens} lado="cliente" nomeCliente={t.perfil.nome} />
      </div>

      {resolvido && <p className="text-center text-[13px] text-ink-2">Este chamado foi resolvido. Se o problema voltou, escreva abaixo que ele é reaberto.</p>}
      <Responder
        placeholder={resolvido ? 'Escreva para reabrir o chamado' : 'Escreva sua resposta para a equipe'}
        rotuloEnviar={resolvido ? 'Reabrir' : 'Enviar'}
        onEnviar={async (m) => {
          await fonte.responder(t.id, m)
          await carregar()
          await onMudou()
        }}
      />
    </Card>
  )
}

function Voltar({ onVoltar }: { onVoltar: () => void }) {
  return (
    <button type="button" onClick={onVoltar} className="mb-3 -ml-1 inline-flex items-center gap-1 rounded-lg px-1 py-1 text-[13px] font-semibold text-ink-2 hover:text-primary lg:hidden">
      <ArrowLeft size={16} aria-hidden /> Meus chamados
    </button>
  )
}

const DICAS: Record<CategoriaTicket, string> = {
  problema: 'O que você estava fazendo, o que esperava acontecer e o que apareceu. Se tiver mensagem de erro, mande um print.',
  duvida: 'Conte o que você quer fazer no sistema. Explicamos o passo a passo.',
  financeiro: 'Conte o que aconteceu com a mensalidade (valor, data, forma de pagamento).',
  sugestao: 'Conte sua ideia e como ela ajudaria no dia a dia do seu negócio.',
  outro: 'Conte com suas palavras. Quanto mais detalhes, mais rápido ajudamos.',
}

const RASCUNHO = 'gynfinance:rascunho-suporte'
interface Rascunho {
  categoria: CategoriaTicket
  assunto: string
  texto: string
  contato: string
}

function NovoChamado({ fonte, onVoltar, onCriado }: { fonte: FonteSuporte; onVoltar: () => void; onCriado: (id: string) => void }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const perfil = usePerfil()
  const veioDeErro = params.get('erro') === '1'
  const de = params.get('de') ?? ultimaPaginaAntesDoSuporte
  const erros = useMemo(() => errosRecentes(), [])
  const [r, setR] = useState<Rascunho>(() => {
    try {
      const salvo = JSON.parse(sessionStorage.getItem(RASCUNHO) ?? 'null') as Rascunho | null
      if (salvo && !veioDeErro) return salvo
    } catch {
      /* sem rascunho */
    }
    return { categoria: 'problema', assunto: veioDeErro ? `A tela ${nomeDaPagina(de)} não abriu` : '', texto: '', contato: '' }
  })
  const [pagina, setPagina] = useState(PAGINAS_ESCOLHA.some((p) => p.valor === de) ? de : '/')
  const [tecnico, setTecnico] = useState(true)
  const [verTecnico, setVerTecnico] = useState(veioDeErro)
  const [tentou, setTentou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState<{ id: string; numero: number } | null>(null)
  const fotos = useFotos()
  const ctx = useMemo(() => contextoTecnico(pagina, nomeDaPagina(pagina)), [pagina])

  useEffect(() => {
    try {
      sessionStorage.setItem(RASCUNHO, JSON.stringify(r))
    } catch {
      /* sem armazenamento */
    }
  }, [r])

  const faltaAssunto = r.assunto.trim().length < 3 ? 'Escreva um assunto curto, como "Saldo não bate".' : undefined
  const faltaTexto = !r.texto.trim() ? 'Conte o que aconteceu.' : undefined

  async function enviar() {
    setTentou(true)
    if (faltaAssunto || faltaTexto || fotos.preparando) return
    if (!navigator.onLine) return setErro('Você está sem internet. Seu texto continua aqui; envie quando a conexão voltar.')
    setEnviando(true)
    setErro(null)
    try {
      const criado = await fonte.abrir(
        {
          id: uid(),
          assunto: r.assunto.trim(),
          categoria: r.categoria,
          texto: r.texto.trim(),
          contato: r.contato.trim() || undefined,
          contexto: tecnico ? ctx : { ...ctx, navegador: '', tela: '' },
          erros: tecnico ? erros : [],
          anexos: fotos.fotos.map((f) => f.anexo),
        },
        perfil,
      )
      try {
        sessionStorage.removeItem(RASCUNHO)
      } catch {
        /* sem armazenamento */
      }
      setPronto(criado)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  if (pronto)
    return (
      <Card className="flex flex-col items-center px-6 py-12 text-center">
        <span className="anim-janela inline-flex size-16 items-center justify-center rounded-full bg-success-soft text-success ring-8 ring-success-soft/50">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path className="anim-check" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <p className="mt-5 text-[19px] font-bold text-ink">Chamado #{pronto.numero} aberto</p>
        <p className="mt-1.5 max-w-sm text-[14px] text-ink-2">A equipe já recebeu. Quando responder, aparece um aviso no topo do sistema e a conversa continua aqui.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => onCriado(pronto.id)}>Ver chamado</Button>
          <Button variante="secundario" onClick={() => navigate(pagina)}>
            Voltar para {nomeDaPagina(pagina)}
          </Button>
        </div>
      </Card>
    )

  return (
    <Card className="flex flex-col gap-6">
      <div>
        <button type="button" onClick={onVoltar} className="mb-3 -ml-1 inline-flex items-center gap-1 rounded-lg px-1 py-1 text-[13px] font-semibold text-ink-2 hover:text-primary">
          <ArrowLeft size={16} aria-hidden /> Voltar
        </button>
        <h2 className="text-[19px] font-bold tracking-[-0.01em] text-ink">Abrir um chamado</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">Leva um minuto. A equipe responde por aqui.</p>
      </div>

      {veioDeErro && (
        <p className="flex items-start gap-2.5 rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] text-ink">
          <Bug size={17} className="mt-0.5 shrink-0 text-warning" aria-hidden />
          O erro que apareceu na tela já vai junto com o chamado. Se puder, conte o que você estava fazendo.
        </p>
      )}

      <Secao numero={1} titulo="Sobre o que é?">
        <div role="radiogroup" aria-label="Assunto do chamado" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {CATEGORIAS_TICKET.map((c) => {
            const Icone = ICONE_CATEGORIA[c.valor]
            const ativo = r.categoria === c.valor
            return (
              <button
                key={c.valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                title={c.descricao}
                onClick={() => setR({ ...r, categoria: c.valor })}
                className={`flex flex-col items-start gap-2 rounded-[14px] border p-3 text-left transition-all duration-200 active:scale-[0.97] ${
                  ativo ? 'border-primary bg-primary-soft shadow-[0_0_0_3px_rgba(52,120,246,0.12)]' : 'border-line bg-surface hover:-translate-y-px hover:border-primary-line'
                }`}
              >
                <span className={`inline-flex size-8 items-center justify-center rounded-full transition-colors ${ativo ? 'grad-primario text-white' : 'bg-[#eef2f7] text-[#4a6385]'}`}>
                  <Icone size={16} aria-hidden />
                </span>
                <span className={`text-[13px] leading-tight font-semibold ${ativo ? 'text-primary' : 'text-ink'}`}>{c.rotulo}</span>
              </button>
            )
          })}
        </div>
      </Secao>

      <Secao numero={2} titulo="Conte para a gente">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_240px]">
          <Input
            label="Assunto"
            placeholder="Ex.: Saldo do mês não bate"
            maxLength={120}
            value={r.assunto}
            onChange={(e) => setR({ ...r, assunto: e.target.value })}
            erro={tentou ? faltaAssunto : undefined}
          />
          <Select label="Onde aconteceu?" value={pagina} onChange={(e) => setPagina(e.target.value)} opcoes={PAGINAS_ESCOLHA} />
        </div>
        <div className="mt-4">
          <Label htmlFor="texto-chamado">O que aconteceu?</Label>
          <textarea
            id="texto-chamado"
            rows={5}
            maxLength={5000}
            value={r.texto}
            onChange={(e) => setR({ ...r, texto: e.target.value })}
            placeholder={DICAS[r.categoria]}
            aria-invalid={tentou && !!faltaTexto}
            className="w-full resize-y rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink shadow-[0_1px_2px_rgba(16,32,64,0.04)] transition-[border-color,box-shadow] duration-150 placeholder:text-muted hover:border-[#d3dce8] focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none aria-[invalid=true]:border-danger"
          />
          {tentou && faltaTexto && <p className="mt-1 text-[12px] text-danger">{faltaTexto}</p>}
        </div>
      </Secao>

      <Secao numero={3} titulo="Mande um print (opcional)">
        <EscolherFotos f={fotos} />
      </Secao>

      <Secao numero={4} titulo="Seus dados vão junto">
        <div className="rounded-[16px] border border-line bg-[#fafbfd] p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#eef3f9] to-[#dfe7f1] text-[#2f4a72]">
              <UserRound size={20} aria-hidden />
            </span>
            <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
              <Dado rotulo="Nome">{perfil.nome}</Dado>
              <Dado rotulo="E-mail">{perfil.email}</Dado>
              <Dado rotulo="Negócio">
                {perfil.negocio?.nome}
                {perfil.negocio && ` · ${perfil.negocio.ehMei ? 'MEI' : 'Empresa'} · ${ATIVIDADE[perfil.negocio.atividade] ?? ''}`}
              </Dado>
              <Dado rotulo="Plano">{perfil.plano}</Dado>
              {perfil.negocio?.cnpj && <Dado rotulo="CNPJ">{perfil.negocio.cnpj}</Dado>}
            </dl>
          </div>
          <Input
            className="mt-4"
            label="WhatsApp para retorno (opcional)"
            inputMode="tel"
            placeholder="(62) 99999-9999"
            maxLength={30}
            value={r.contato}
            onChange={(e) => setR({ ...r, contato: e.target.value })}
          />
        </div>
        <div className="mt-3 rounded-[16px] border border-line">
          <div className="flex items-center gap-3 px-4 py-3">
            <MonitorSmartphone size={18} className="shrink-0 text-slate" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">Informações técnicas</p>
              <p className="text-[12px] text-ink-2">
                Aparelho, tela e {erros.length ? `${erros.length} ${erros.length === 1 ? 'erro recente' : 'erros recentes'}` : 'nenhum erro recente'}. Ajudam a achar o problema.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={tecnico}
              aria-label="Enviar informações técnicas"
              onClick={() => setTecnico((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 ${tecnico ? 'grad-primario' : 'bg-[#d5dde7]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-150 ${tecnico ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {tecnico && (
            <>
              <button
                type="button"
                onClick={() => setVerTecnico((v) => !v)}
                aria-expanded={verTecnico}
                className="flex w-full items-center gap-1 border-t border-line px-4 py-2 text-left text-[12px] font-semibold text-primary"
              >
                {verTecnico ? 'Esconder' : 'Ver o que vai'}
                <ChevronDown size={14} className={`transition-transform ${verTecnico ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {verTecnico && (
                <div className="anim-aparecer border-t border-line px-4 py-3 text-[12px] text-ink-2">
                  <p>
                    {ctx.navegador} · tela {ctx.tela} · {ctx.online ? 'com internet' : 'sem internet'}
                  </p>
                  {erros.map((e, i) => (
                    <p key={i} className="mt-2 rounded-[10px] bg-[#f3f6fa] px-3 py-2 font-mono text-[11px] break-words text-ink">
                      {quando(e.quando)} · {nomeDaPagina(e.pagina)}: {e.mensagem}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Secao>

      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-[12px] bg-danger-soft px-4 py-3 text-[13px] text-danger">
          {!navigator.onLine && <WifiOff size={16} className="mt-0.5 shrink-0" aria-hidden />}
          <span>
            {erro} Seu texto e as fotos continuam aqui.
          </span>
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variante="discreto" onClick={onVoltar}>
          Cancelar
        </Button>
        <Button tamanho="lg" carregando={enviando} disabled={fotos.preparando} onClick={() => void enviar()} icone={<LifeBuoy size={18} aria-hidden />}>
          Enviar chamado
        </Button>
      </div>
    </Card>
  )
}

function Secao({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2.5 text-[15px] font-bold text-ink">
        <span className="num inline-flex size-6 items-center justify-center rounded-full bg-primary-soft text-[12px] font-bold text-primary">{numero}</span>
        {titulo}
      </h3>
      {children}
    </section>
  )
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">{rotulo}</dt>
      <dd className="truncate font-medium text-ink">{children}</dd>
    </div>
  )
}
