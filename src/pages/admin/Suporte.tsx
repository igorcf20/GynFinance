// Painel de superadmin: chamados de suporte dos clientes e erros que o app e o servidor registram.
import { ArrowLeft, Bug, CheckCheck, ChevronDown, Inbox, Lock, MonitorSmartphone, RefreshCw, Search, ServerCrash, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Conversa, iniciais, quando, Responder, SeloTicket } from '../../components/suporte/comum'
import { Badge, type TomBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, EstadoVazio, Skeleton } from '../../components/ui/Card'
import { Select } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Modal'
import { Segmentado } from '../../components/ui/Tabs'
import { nomeDaPagina, type FiltroSuporte, type FonteSuporteAdmin } from '../../data/suporte'
import {
  CATEGORIAS_TICKET,
  PRIORIDADES_TICKET,
  SITUACOES_TICKET,
  type GrupoErro,
  type OrigemErro,
  type PrioridadeTicket,
  type ResumoTicket,
  type SituacaoTicket,
  type Ticket,
} from '../../domain/suporte'
import { telefoneLegivel } from './comum'

const TOM_PRIORIDADE: Record<PrioridadeTicket, TomBadge> = { baixa: 'neutro', normal: 'azul', alta: 'ambar', urgente: 'vermelho' }
const ATIVIDADE: Record<string, string> = { comercio: 'Comércio', servico: 'Serviços', industria: 'Indústria', misto: 'Comércio e serviços' }

type Filtro = FiltroSuporte['situacao']

export function AbaSuporte({ fonte }: { fonte: FonteSuporteAdmin }) {
  const [filtro, setFiltro] = useState<Filtro>('abertos')
  const [busca, setBusca] = useState('')
  const [dados, setDados] = useState<Awaited<ReturnType<FonteSuporteAdmin['lista']>> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setDados(await fonte.lista({ situacao: filtro, busca }))
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [fonte, filtro, busca])
  useEffect(() => {
    const t = window.setTimeout(() => void carregar(), busca ? 300 : 0)
    return () => window.clearTimeout(t)
  }, [carregar, busca])

  const c = dados?.contagem
  const abertos = c ? c.aberto + c.em_andamento + c.aguardando_cliente : undefined
  const opcoes: { valor: Filtro; rotulo: string; contagem?: number }[] = [
    { valor: 'abertos', rotulo: 'Abertos', contagem: abertos },
    { valor: 'aberto', rotulo: 'Novos', contagem: c?.aberto },
    { valor: 'em_andamento', rotulo: 'Em andamento', contagem: c?.em_andamento },
    { valor: 'aguardando_cliente', rotulo: 'Aguardando', contagem: c?.aguardando_cliente },
    { valor: 'resolvido', rotulo: 'Resolvidos', contagem: c?.resolvido },
    { valor: 'todos', rotulo: 'Todos' },
  ]

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className={`flex min-w-0 flex-col gap-3 ${aberto ? 'hidden lg:flex' : ''}`}>
        <div className="grid grid-cols-3 gap-2.5">
          <Numero rotulo="Sem leitura" valor={dados?.naoLidos} destaque />
          <Numero rotulo="Abertos" valor={abertos} />
          <Numero rotulo="Resolvidos" valor={c?.resolvido} />
        </div>
        <label className="relative block">
          <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate" aria-hidden />
          <span className="sr-only">Buscar chamado</span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, assunto ou #número"
            className="h-11 w-full rounded-[12px] border border-line bg-surface pr-3 pl-10 text-[14px] text-ink shadow-[0_1px_2px_rgba(16,32,64,0.04)] placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
          />
        </label>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Situação">
          {opcoes.map((o) => (
            <button
              key={o.valor}
              type="button"
              role="tab"
              aria-selected={filtro === o.valor}
              onClick={() => setFiltro(o.valor)}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-all duration-200 ${
                filtro === o.valor ? 'grad-primario text-white' : 'border border-line bg-surface text-ink-2 hover:text-primary'
              }`}
            >
              {o.rotulo}
              {o.contagem !== undefined && <span className={`num rounded-full px-1.5 text-[11px] ${filtro === o.valor ? 'bg-white/20' : 'bg-[#eef2f7]'}`}>{o.contagem}</span>}
            </button>
          ))}
        </div>
        <Card className="!p-2">
          {erro && <Falha texto={erro} onTentar={carregar} />}
          {!dados && !erro && (
            <div className="flex flex-col gap-2 p-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[74px]" />
              ))}
            </div>
          )}
          {dados?.tickets.length === 0 && <EstadoVazio icone={<Inbox size={24} />} titulo="Nenhum chamado aqui" texto={busca ? 'Nada encontrado com essa busca.' : 'Quando um cliente abrir um chamado, ele aparece nesta lista.'} />}
          <ul>
            {dados?.tickets.map((t) => (
              <li key={t.id}>
                <ItemAdmin t={t} ativo={t.id === aberto} onAbrir={() => setAberto(t.id)} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className={`min-w-0 ${aberto ? '' : 'hidden lg:block'}`}>
        {aberto ? (
          <DetalheAdmin key={aberto} fonte={fonte} id={aberto} onVoltar={() => setAberto(null)} onMudou={carregar} />
        ) : (
          <Card className="flex min-h-[420px] items-center justify-center">
            <EstadoVazio icone={<Inbox size={24} />} titulo="Escolha um chamado" texto="Os sem leitura e os mais urgentes ficam no topo da lista." />
          </Card>
        )}
      </div>
    </div>
  )
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor?: number; destaque?: boolean }) {
  return (
    <div className={`rounded-[14px] border px-3 py-2.5 ${destaque && valor ? 'border-[#cfdffc] bg-primary-soft' : 'border-line bg-surface'}`}>
      <p className={`num text-[20px] leading-none font-extrabold ${destaque && valor ? 'text-primary' : 'text-ink'}`}>{valor ?? '–'}</p>
      <p className="mt-1 text-[11px] font-semibold text-ink-2">{rotulo}</p>
    </div>
  )
}

function Falha({ texto, onTentar }: { texto: string; onTentar: () => void }) {
  return (
    <div role="alert" className="m-2 flex items-center gap-3 rounded-[12px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
      <span className="flex-1">{texto}</span>
      <button type="button" onClick={onTentar} className="inline-flex items-center gap-1 font-semibold">
        <RefreshCw size={14} aria-hidden /> Tentar de novo
      </button>
    </div>
  )
}

function ItemAdmin({ t, ativo, onAbrir }: { t: ResumoTicket; ativo: boolean; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-current={ativo ? 'true' : undefined}
      className={`relative flex w-full items-start gap-3 rounded-[14px] px-3 py-3 text-left transition-all duration-200 ${ativo ? 'bg-primary-soft' : 'hover:bg-hover'}`}
    >
      {t.naoLido && <span className="absolute top-1/2 left-1 size-1.5 -translate-y-1/2 rounded-full bg-primary" aria-label="Sem leitura" />}
      <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#eef3f9] to-[#dfe7f1] text-[12px] font-bold text-[#2f4a72]">
        {iniciais(t.cliente?.nome ?? '')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-[13px] text-ink ${t.naoLido ? 'font-bold' : 'font-semibold'}`}>{t.cliente?.negocio || t.cliente?.nome}</span>
          <span className="shrink-0 text-[11px] text-muted">{quando(t.atualizadoEm)}</span>
        </span>
        <span className={`block truncate text-[14px] ${t.naoLido ? 'font-bold text-ink' : 'font-medium text-ink'}`}>{t.assunto}</span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-2">{t.ultimaMensagem?.texto}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <SeloTicket situacao={t.situacao} />
          {t.prioridade !== 'normal' && <Badge tom={TOM_PRIORIDADE[t.prioridade]}>{PRIORIDADES_TICKET.find((p) => p.valor === t.prioridade)?.rotulo}</Badge>}
          <span className="num text-[11px] text-muted">#{t.numero}</span>
        </span>
      </span>
    </button>
  )
}

function DetalheAdmin({ fonte, id, onVoltar, onMudou }: { fonte: FonteSuporteAdmin; id: string; onVoltar: () => void; onMudou: () => Promise<void> }) {
  const [d, setD] = useState<{ ticket: Ticket; outros: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [interna, setInterna] = useState(false)
  const [depois, setDepois] = useState<SituacaoTicket>('aguardando_cliente')
  const avisar = useToast()
  const carregar = useCallback(async () => {
    try {
      setD(await fonte.ler(id))
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [fonte, id])
  useEffect(() => {
    void carregar().then(onMudou)
  }, [carregar, onMudou])

  async function alterar(m: { situacao?: SituacaoTicket; prioridade?: PrioridadeTicket }) {
    try {
      await fonte.alterar(id, m)
      await carregar()
      await onMudou()
      avisar('Chamado atualizado.')
    } catch (e) {
      avisar((e as Error).message)
    }
  }

  if (erro)
    return (
      <Card>
        <VoltarLista onVoltar={onVoltar} />
        <Falha texto={erro} onTentar={carregar} />
      </Card>
    )
  if (!d)
    return (
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-4/5" />
      </Card>
    )
  const t = d.ticket
  const p = t.perfil
  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="flex min-w-0 flex-col gap-5">
        <div>
          <VoltarLista onVoltar={onVoltar} />
          <p className="num text-[12px] font-semibold text-muted">
            Chamado #{t.numero} · aberto {quando(t.criadoEm)} · {CATEGORIAS_TICKET.find((c) => c.valor === t.categoria)?.rotulo}
          </p>
          <h2 className="mt-0.5 text-[19px] font-bold tracking-[-0.01em] text-ink">{t.assunto}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
            <Select
              label="Situação"
              value={t.situacao}
              onChange={(e) => void alterar({ situacao: e.target.value as SituacaoTicket })}
              opcoes={SITUACOES_TICKET.map((s) => ({ valor: s.valor, rotulo: s.rotulo }))}
            />
            <Select
              label="Prioridade"
              value={t.prioridade}
              onChange={(e) => void alterar({ prioridade: e.target.value as PrioridadeTicket })}
              opcoes={PRIORIDADES_TICKET.map((x) => ({ valor: x.valor, rotulo: x.rotulo }))}
            />
          </div>
        </div>
        <div className="rounded-[16px] bg-[#f7f9fc] p-3 sm:p-4">
          <Conversa mensagens={t.mensagens} lado="suporte" nomeCliente={p.nome} />
        </div>
        <Responder
          placeholder={interna ? 'Nota interna: só a equipe vê' : `Responder para ${p.nome.split(' ')[0]}`}
          rotuloEnviar={interna ? 'Salvar nota' : 'Responder'}
          onEnviar={async (m) => {
            await fonte.responder(id, { ...m, interna, situacao: interna ? undefined : depois })
            await carregar()
            await onMudou()
            avisar(interna ? 'Nota salva.' : 'Resposta enviada. O cliente vê o aviso no topo do sistema.')
          }}
          extra={
            <>
              <button
                type="button"
                aria-pressed={interna}
                onClick={() => setInterna((v) => !v)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors ${interna ? 'bg-warning-soft text-warning ring-1 ring-[#f3c58f]' : 'text-ink-2 hover:bg-hover'}`}
              >
                <Lock size={13} aria-hidden /> Nota interna
              </button>
              {!interna && (
                <label className="inline-flex items-center gap-1 text-[12px] whitespace-nowrap text-ink-2">
                  <span className="hidden sm:inline">e marcar</span>
                  <select
                    value={depois}
                    onChange={(e) => setDepois(e.target.value as SituacaoTicket)}
                    className="h-9 rounded-full border border-line bg-surface px-2.5 text-[12px] font-semibold text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="aguardando_cliente">Aguardando cliente</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="resolvido">Resolvido</option>
                  </select>
                </label>
              )}
            </>
          }
        />
      </Card>

      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <div className="mb-3 flex items-center gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#eef3f9] to-[#dfe7f1] text-[#2f4a72]">
              <UserRound size={20} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold text-ink">{p.nome}</p>
              <p className="truncate text-[12px] text-ink-2">{p.email}</p>
            </div>
          </div>
          <dl className="flex flex-col gap-2 text-[13px]">
            {p.negocio && (
              <Linha rotulo="Negócio">
                {p.negocio.nome}
                <span className="block text-[12px] text-ink-2">
                  {p.negocio.ehMei ? 'MEI' : 'Empresa'} · {ATIVIDADE[p.negocio.atividade] ?? p.negocio.atividade} · {[p.negocio.municipio, p.negocio.uf].filter(Boolean).join('/')}
                </span>
              </Linha>
            )}
            {p.negocio?.cnpj && <Linha rotulo="CNPJ">{p.negocio.cnpj}</Linha>}
            <Linha rotulo="Plano">
              {p.plano ?? '–'}
              {p.situacaoAssinatura && <span className="text-ink-2"> · {p.situacaoAssinatura}</span>}
            </Linha>
            {(t.contato || p.telefone) && (
              <Linha rotulo="WhatsApp">
                <a
                  className="font-semibold text-primary hover:underline"
                  href={`https://wa.me/55${(t.contato || p.telefone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {telefoneLegivel(t.contato || p.telefone)}
                </a>
              </Linha>
            )}
            {d.outros > 0 && <Linha rotulo="Outros chamados">{d.outros}</Linha>}
          </dl>
        </Card>
        <Card>
          <p className="mb-3 flex items-center gap-2 text-[14px] font-bold text-ink">
            <MonitorSmartphone size={16} className="text-slate" aria-hidden /> Onde e em que aparelho
          </p>
          <dl className="flex flex-col gap-2 text-[13px]">
            <Linha rotulo="Tela">
              {t.paginaNome || nomeDaPagina(t.pagina)} <span className="font-mono text-[11px] text-muted">{t.pagina}</span>
            </Linha>
            {t.contexto.navegador && <Linha rotulo="Navegador">{t.contexto.navegador}</Linha>}
            {t.contexto.tela && (
              <Linha rotulo="Tamanho da tela">
                {t.contexto.tela} · {t.contexto.plataforma}
              </Linha>
            )}
            {!t.contexto.online && <Linha rotulo="Internet">sem conexão ao abrir</Linha>}
          </dl>
          {t.erros.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-danger">
                <Bug size={15} aria-hidden /> {t.erros.length} {t.erros.length === 1 ? 'erro recente' : 'erros recentes'}
              </p>
              <ul className="flex flex-col gap-2">
                {t.erros.map((e, i) => (
                  <li key={i}>
                    <Pilha titulo={`${ORIGEM[e.origem]} · ${nomeDaPagina(e.pagina)} · ${quando(e.quando)}`} mensagem={e.mensagem} pilha={e.pilha} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function VoltarLista({ onVoltar }: { onVoltar: () => void }) {
  return (
    <button type="button" onClick={onVoltar} className="mb-3 -ml-1 inline-flex items-center gap-1 rounded-lg px-1 py-1 text-[13px] font-semibold text-ink-2 hover:text-primary lg:hidden">
      <ArrowLeft size={16} aria-hidden /> Chamados
    </button>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
      <dt className="text-ink-2">{rotulo}</dt>
      <dd className="min-w-0 font-medium break-words text-ink">{children}</dd>
    </div>
  )
}

const ORIGEM: Record<OrigemErro, string> = { tela: 'Tela quebrou', script: 'Erro de script', promessa: 'Erro de script', servidor: 'Servidor', conexao: 'Sem conexão' }

function Pilha({ titulo, mensagem, pilha }: { titulo: string; mensagem: string; pilha?: string }) {
  const [ver, setVer] = useState(false)
  return (
    <div className="rounded-[12px] border border-[#f9cdd5] bg-danger-soft/60 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-ink-2">{titulo}</p>
      <p className="mt-0.5 font-mono text-[12px] break-words text-ink">{mensagem}</p>
      {pilha && (
        <>
          <button type="button" onClick={() => setVer((v) => !v)} aria-expanded={ver} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
            {ver ? 'Esconder detalhes' : 'Ver detalhes'} <ChevronDown size={12} className={ver ? 'rotate-180' : ''} aria-hidden />
          </button>
          {ver && <pre className="anim-aparecer mt-1.5 max-h-48 overflow-auto rounded-[8px] bg-white/70 p-2 text-[11px] whitespace-pre-wrap text-ink-2">{pilha}</pre>}
        </>
      )}
    </div>
  )
}

// ---------- Erros ----------
export function AbaErros({ fonte }: { fonte: FonteSuporteAdmin }) {
  const [resolvidos, setResolvidos] = useState<'abertos' | 'todos'>('abertos')
  const [grupos, setGrupos] = useState<GrupoErro[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const avisar = useToast()
  const carregar = useCallback(async () => {
    try {
      setGrupos(await fonte.erros(resolvidos === 'todos'))
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [fonte, resolvidos])
  useEffect(() => {
    void carregar()
  }, [carregar])
  const total = useMemo(() => (grupos ?? []).filter((g) => !g.resolvido).reduce((s, g) => s + g.vezes, 0), [grupos])

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-gradient-to-b from-[#fff1f3] to-[#fde0e5] text-danger">
            <Bug size={20} aria-hidden />
          </span>
          <div>
            <p className="font-bold text-ink">Erros dos últimos 30 dias</p>
            <p className="text-[13px] text-ink-2">
              {grupos ? `${total} ${total === 1 ? 'ocorrência' : 'ocorrências'} sem resolver.` : 'Carregando…'} Telas que quebraram no app e falhas do servidor, agrupadas.
            </p>
          </div>
        </div>
        <Segmentado
          rotulo="Mostrar"
          valor={resolvidos}
          onChange={setResolvidos}
          opcoes={[
            { valor: 'abertos', rotulo: 'Sem resolver' },
            { valor: 'todos', rotulo: 'Todos' },
          ]}
        />
      </Card>
      {erro && (
        <Card className="!p-2">
          <Falha texto={erro} onTentar={carregar} />
        </Card>
      )}
      {!grupos && !erro && <Skeleton className="h-28" />}
      {grupos?.length === 0 && (
        <Card>
          <EstadoVazio icone={<CheckCheck size={24} />} titulo="Nenhum erro sem resolver" texto="Quando uma tela quebrar para algum cliente ou o servidor falhar, aparece aqui." />
        </Card>
      )}
      <ul className="flex flex-col gap-3">
        {grupos?.map((g) => (
          <li key={g.chave}>
            <Card className={g.resolvido ? 'opacity-60' : ''}>
              <div className="flex flex-wrap items-start gap-3">
                <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${g.origem === 'servidor' ? 'bg-[#eef2f7] text-navy' : 'bg-danger-soft text-danger'}`}>
                  {g.origem === 'servidor' ? <ServerCrash size={17} aria-hidden /> : <Bug size={17} aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
                    <Badge tom={g.origem === 'servidor' ? 'neutro' : 'vermelho'}>{ORIGEM[g.origem]}</Badge>
                    <span className="font-semibold text-ink">{g.origem === 'servidor' ? g.pagina : nomeDaPagina(g.pagina)}</span>
                    {g.resolvido && <Badge tom="verde">Resolvido</Badge>}
                  </p>
                  <p className="mt-1.5 font-mono text-[13px] break-words text-ink">{g.mensagem}</p>
                  <p className="num mt-1.5 text-[12px] text-ink-2">
                    {g.vezes} {g.vezes === 1 ? 'vez' : 'vezes'} · {g.pessoas ? `${g.pessoas} ${g.pessoas === 1 ? 'pessoa' : 'pessoas'}` : 'sem login'} · última {quando(g.ultimaVez)}
                    {g.navegador ? ` · ${g.navegador}` : ''}
                  </p>
                  {g.pilha && (
                    <div className="mt-2">
                      <Pilha titulo="Detalhes técnicos" mensagem={`Primeira vez ${quando(g.primeiraVez)}`} pilha={g.pilha} />
                    </div>
                  )}
                </div>
                {!g.resolvido && (
                  <Button
                    variante="secundario"
                    tamanho="sm"
                    icone={<CheckCheck size={15} aria-hidden />}
                    onClick={async () => {
                      try {
                        await fonte.resolverErro(g.chave)
                        avisar('Marcado como resolvido. Se acontecer de novo, volta para a lista.')
                        await carregar()
                      } catch (e) {
                        avisar((e as Error).message)
                      }
                    }}
                  >
                    Resolvido
                  </Button>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
