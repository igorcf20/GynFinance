import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  FileText,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Trash2,
  Unlink,
  UserRound,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BarrasHorizontais, ParceiroChart } from '../components/financial/charts'
import { Header } from '../components/layout/Header'
import { AvatarParceiro, PERIODOS, periodoDe, SeloTipo, type IdPeriodo } from '../components/parceiros/comum'
import { FormParceiro } from '../components/parceiros/FormParceiro'
import { VincularLancamentos } from '../components/parceiros/VincularLancamentos'
import { Badge } from '../components/ui/Badge'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card, CardTitulo, EstadoVazio, IconeBox } from '../components/ui/Card'
import { Explica } from '../components/ui/Explica'
import { Modal, useToast } from '../components/ui/Modal'
import { Segmentado } from '../components/ui/Tabs'
import { ValorAnimado } from '../components/ui/ValorAnimado'
import { temModulo } from '../domain/planos'
import { atendimentosDo, categoriasDoParceiro, ehCliente, ehFornecedor, lancamentosDo, linkWhatsApp, resumoParceiro, serieParceiro } from '../domain/parceiros'
import type { Lancamento, Parceiro } from '../domain/types'
import { useStore } from '../data/store'
import { brl, dataBR, mesDe, uid } from '../lib/format'

type Filtro = 'todos' | 'recebidos' | 'pagos' | 'abertos'

export function FichaParceiro() {
  const { id } = useParams()
  const { dados } = useStore()
  const p = (dados.parceiros ?? []).find((x) => x.id === id)
  if (!p) return <Navigate to="/clientes" replace />
  return <Ficha key={p.id} p={p} />
}

function Ficha({ p }: { p: Parceiro }) {
  const { dados, hoje, modulos, salvarParceiro, excluirParceiro, vincularLancamentos } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [idPeriodo, setIdPeriodo] = useState<IdPeriodo>('ano')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [editar, setEditar] = useState(false)
  const [vincular, setVincular] = useState(false)
  const [apagar, setApagar] = useState(false)
  const periodo = periodoDe(idPeriodo, hoje)
  const cliente = ehCliente(p)
  const fornecedor = ehFornecedor(p)

  const r = resumoParceiro(dados.lancamentos, p.id, periodo, hoje)
  const serie = serieParceiro(dados.lancamentos, p.id, mesDe(hoje), 12)
  const categorias = categoriasDoParceiro(dados, p.id, periodo)
  const todos = useMemo(
    () => lancamentosDo(dados.lancamentos, p.id).sort((a, b) => (b.dataPagamento ?? b.dataVencimento ?? b.dataCompetencia).localeCompare(a.dataPagamento ?? a.dataVencimento ?? a.dataCompetencia)),
    [dados.lancamentos, p.id],
  )
  const lista = todos.filter((l) =>
    filtro === 'abertos' ? l.situacao === 'previsto' : filtro === 'recebidos' ? l.natureza === 'entrada' && l.situacao === 'realizado' : filtro === 'pagos' ? l.natureza === 'saida' && l.situacao === 'realizado' : true,
  )
  const atendimentos = atendimentosDo(dados.atendimentos, p)
  const zap = linkWhatsApp(p.telefone)

  const atualizar = (mudanca: Partial<Parceiro>) => salvarParceiro({ ...p, ...mudanca }, p.id)

  const tirar = (l: Lancamento) => {
    const desfazer = vincularLancamentos([l.id], undefined)
    toast('Lançamento tirado da ficha. Ele continua em Lançamentos.', { desfazer })
  }

  return (
    <>
      <Link to="/clientes" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-primary">
        <ArrowLeft size={16} aria-hidden /> Clientes e fornecedores
      </Link>
      <Header
        titulo={
          <span className="flex items-center gap-3">
            <AvatarParceiro p={p} />
            <span className="min-w-0 truncate">{p.nome}</span>
          </span>
        }
        subtitulo={
          <>
            {p.tipo === 'cliente' ? 'Cliente' : p.tipo === 'fornecedor' ? 'Fornecedor' : 'Cliente e fornecedor'} desde {dataBR(p.criadoEm)}
            {!p.ativo && ' · arquivado'}
          </>
        }
        acoes={
          <span className="hidden gap-2 lg:inline-flex">
            <Button variante="secundario" icone={<Pencil size={16} />} onClick={() => setEditar(true)}>
              Editar
            </Button>
          </span>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {cliente && (
          <ButtonLink to={`/lancar?parceiro=${p.id}&tipo=entrada`} icone={<ArrowUpRight size={17} />}>
            Novo recebimento
          </ButtonLink>
        )}
        {fornecedor && (
          <ButtonLink to={`/lancar?parceiro=${p.id}&tipo=saida`} variante={cliente ? 'secundario' : 'primario'} icone={<ArrowDown size={17} />}>
            {cliente ? 'Nova despesa' : 'Nova fatura ou despesa'}
          </ButtonLink>
        )}
        <Button variante="secundario" icone={<Link2 size={16} />} onClick={() => setVincular(true)}>
          Atribuir lançamentos
        </Button>
        {zap && (
          <a href={zap} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-[#bfe8d3] bg-success-soft px-4 text-[14px] font-semibold text-success transition-all hover:-translate-y-px">
            <MessageCircle size={17} aria-hidden /> WhatsApp
          </a>
        )}
        <Button variante="secundario" className="lg:hidden" icone={<Pencil size={16} />} onClick={() => setEditar(true)}>
          Editar
        </Button>
        <div className="w-full overflow-x-auto sm:ml-auto sm:w-auto">
          <Segmentado rotulo="Período" valor={idPeriodo} onChange={setIdPeriodo} opcoes={PERIODOS} rolar />
        </div>
      </div>

      <div className={`mb-5 grid grid-cols-2 gap-3 md:gap-5 ${cliente && fornecedor ? 'xl:grid-cols-5' : 'xl:grid-cols-3'}`}>
        {cliente && (
          <Numero
            rotulo={fornecedor ? 'Ganhei com ele' : 'Recebido'}
            valor={r.recebido}
            cor="text-success"
            tom="verde"
            icone={<ArrowUpRight size={18} />}
            nota={r.vendas ? `${r.vendas} ${r.vendas === 1 ? 'venda' : 'vendas'} · média ${brl(r.ticketMedio)}` : 'Nenhuma venda recebida'}
            explica={
              <Explica titulo="Recebido" conta={<>{r.vendas} recebimentos {periodo.texto}: <b>{brl(r.recebido)}</b>{r.vendas ? <> · média <b>{brl(r.ticketMedio)}</b></> : null}</>}>
                O que {p.nome} pagou {periodo.texto}, pela data em que o dinheiro entrou. A média é o total dividido pelo número de vendas.
              </Explica>
            }
          />
        )}
        {fornecedor && (
          <Numero
            rotulo={cliente ? 'Gastei com ele' : 'Pago'}
            valor={r.pago}
            cor="text-danger"
            tom="vermelho"
            icone={<ArrowDown size={18} />}
            nota={r.compras ? `${r.compras} ${r.compras === 1 ? 'pagamento' : 'pagamentos'}` : 'Nenhum pagamento'}
            explica={
              <Explica titulo="Pago" conta={<>{r.compras} pagamentos {periodo.texto}: <b>{brl(r.pago)}</b></>}>
                Faturas, despesas e pagamentos feitos a {p.nome} {periodo.texto}, pela data do pagamento.
              </Explica>
            }
          />
        )}
        {cliente && (
          <Numero
            rotulo="A receber"
            valor={r.aReceber}
            cor="text-ink"
            tom={r.atrasadoReceber ? 'laranja' : 'azul'}
            icone={<Receipt size={18} />}
            nota={r.atrasadoReceber ? `${brl(r.atrasadoReceber)} em atraso` : r.atrasoMedioDias !== undefined ? (r.atrasoMedioDias > 0 ? `Costuma pagar ${r.atrasoMedioDias} dias depois` : 'Costuma pagar em dia') : r.aReceber ? 'Nada vencido' : 'Nada em aberto'}
            alerta={r.atrasadoReceber > 0}
            explica={
              <Explica titulo="A receber" conta={<>Em aberto: <b>{brl(r.aReceber)}</b>{r.atrasadoReceber ? <> · vencido: <b>{brl(r.atrasadoReceber)}</b></> : null}</>}>
                Contas a receber de {p.nome} que ainda não foram pagas, de qualquer data. "Costuma pagar" compara o vencimento com o dia em que pagou, nas contas já recebidas.
              </Explica>
            }
          />
        )}
        {fornecedor && (
          <Numero
            rotulo="A pagar"
            valor={r.aPagar}
            cor="text-ink"
            tom={r.atrasadoPagar ? 'laranja' : 'ambar'}
            icone={<FileText size={18} />}
            nota={r.atrasadoPagar ? `${brl(r.atrasadoPagar)} vencido` : 'Nada vencido'}
            alerta={r.atrasadoPagar > 0}
            explica={
              <Explica titulo="A pagar" lado="direita" conta={<>Em aberto: <b>{brl(r.aPagar)}</b></>}>
                Faturas e contas de {p.nome} que você ainda vai pagar.
              </Explica>
            }
          />
        )}
        {(!cliente || !fornecedor) && (
          <Numero
            rotulo={cliente ? 'Último pagamento' : 'Última compra'}
            texto={r.ultimoMovimento ? dataBR(r.ultimoMovimento) : 'Ainda não houve'}
            tom="neutro"
            icone={<CalendarDays size={18} />}
            nota={`${todos.length} ${todos.length === 1 ? 'lançamento' : 'lançamentos'} na ficha`}
            explica={
              <Explica titulo="Último movimento" lado="direita">
                O dia mais recente em que entrou ou saiu dinheiro com {p.nome}, em qualquer período.
              </Explica>
            }
          />
        )}
        {cliente && fornecedor && (
          <Numero
            rotulo="Saldo com ele"
            valor={r.saldo}
            cor={r.saldo >= 0 ? 'text-success' : 'text-danger'}
            tom="azul"
            icone={<UserRound size={18} />}
            nota={r.saldo >= 0 ? 'Você mais ganhou do que gastou' : 'Você mais gastou do que ganhou'}
            explica={
              <Explica titulo="Saldo" lado="direita" conta={<>{brl(r.recebido)} − {brl(r.pago)} = <b>{brl(r.saldo)}</b></>}>
                Recebido menos pago {periodo.texto}.
              </Explica>
            }
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <Card>
            <CardTitulo
              explica={
                <Explica titulo="Mês a mês">
                  {cliente && fornecedor ? 'Barras verdes: o que recebeu. Laranja: o que pagou.' : cliente ? 'Quanto recebeu de' : 'Quanto pagou a'} {!(cliente && fornecedor) && p.nome} em cada um dos últimos 12 meses.
                </Explica>
              }
              acao={
                <span className="flex items-center gap-3 text-[12px] font-semibold text-ink-2">
                  {cliente && <Legenda cor="#12925a">Recebido</Legenda>}
                  {fornecedor && <Legenda cor="#f08a24">Pago</Legenda>}
                </span>
              }
            >
              Últimos 12 meses
            </CardTitulo>
            <ParceiroChart serie={serie} mostrar={{ recebido: cliente, pago: fornecedor }} />
          </Card>

          <Card className="!px-2 !py-2 md:!px-3">
            <div className="flex flex-col gap-3 px-2 pt-3 pb-2 sm:flex-row sm:items-center">
              <h2 className="flex-1 text-[17px] font-bold tracking-[-0.01em] text-ink">{fornecedor && !cliente ? 'Faturas, despesas e pagamentos' : 'Lançamentos'}</h2>
              <div className="overflow-x-auto">
                <Segmentado
                  rotulo="Filtrar lançamentos"
                  valor={filtro}
                  onChange={setFiltro}
                  rolar
                  opcoes={[
                    { valor: 'todos', rotulo: 'Todos', contagem: todos.length },
                    ...(cliente ? [{ valor: 'recebidos' as const, rotulo: 'Recebidos' }] : []),
                    ...(fornecedor ? [{ valor: 'pagos' as const, rotulo: 'Pagos' }] : []),
                    { valor: 'abertos', rotulo: 'Em aberto', contagem: todos.filter((l) => l.situacao === 'previsto').length },
                  ]}
                />
              </div>
            </div>
            {lista.length === 0 ? (
              <EstadoVazio
                icone={<Receipt size={22} />}
                titulo="Nada aqui ainda"
                texto={`Lance um ${cliente ? 'recebimento' : 'pagamento'} escolhendo ${p.nome}, ou atribua lançamentos que já existem.`}
                acao={
                  <Button variante="contorno" icone={<Link2 size={16} />} onClick={() => setVincular(true)}>
                    Atribuir lançamentos
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {lista.slice(0, 60).map((l, i) => (
                  <LinhaLancamento key={l.id} l={l} hoje={hoje} atraso={i} categoria={dados.categorias.find((c) => c.id === l.categoriaId)?.nome} onTirar={() => tirar(l)} />
                ))}
              </ul>
            )}
            {lista.length > 60 && <p className="px-3 py-2 text-[12px] text-ink-2">Mostrando os 60 mais recentes. Veja todos em Lançamentos, buscando por {p.nome}.</p>}
          </Card>

          {categorias.length > 0 && (
            <Card>
              <CardTitulo
                explica={
                  <Explica titulo="Por categoria">
                    Em que categorias entrou ou saiu o dinheiro com {p.nome} {periodo.texto}.
                  </Explica>
                }
              >
                Por categoria
              </CardTitulo>
              <BarrasHorizontais itens={categorias.map((c) => ({ nome: `${c.natureza === 'entrada' ? '↑' : '↓'} ${c.nome}`, valor: c.valor }))} />
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <Contatos p={p} />
          <Tarefas p={p} hoje={hoje} atualizar={atualizar} />
          <Anotacoes p={p} hoje={hoje} atualizar={atualizar} />
          {cliente && temModulo(modulos, 'agenda') && (
            <Card>
              <CardTitulo
                acao={
                  <Link to="/agenda" className="text-[13px] font-semibold text-primary hover:underline">
                    Abrir agenda
                  </Link>
                }
              >
                Atendimentos
              </CardTitulo>
              {atendimentos.length === 0 ? (
                <p className="text-[13px] text-ink-2">Nenhum atendimento com {p.nome} na agenda.</p>
              ) : (
                <ul className="-my-2 divide-y divide-line">
                  {atendimentos.slice(0, 6).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                      <span className="num w-[86px] shrink-0 font-semibold text-ink">
                        {dataBR(a.data).slice(0, 5)} · {a.inicio}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink-2">{a.servico ?? 'Atendimento'}</span>
                      {a.situacao === 'faltou' ? <Badge tom="vermelho">Faltou</Badge> : a.situacao === 'cancelado' ? <Badge>Cancelado</Badge> : a.data >= hoje ? <Badge tom="azul">Marcado</Badge> : <Badge tom="verde">Feito</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          {cliente && (
            <Card className="border border-dashed border-[#cfdae8] !bg-[#fafcff] !shadow-none">
              <div className="flex items-start gap-3">
                <IconeBox tom="azul" tamanho="sm">
                  <FileText size={17} />
                </IconeBox>
                <div>
                  <p className="font-semibold text-ink">Faturas para este cliente</p>
                  <p className="mt-0.5 text-[13px] text-ink-2">
                    Em breve dá para criar a fatura aqui e ela já entra como conta a receber de {p.nome}. Por enquanto, guarde o número da fatura no lançamento, no "Modo avançado".
                  </p>
                </div>
              </div>
            </Card>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variante="discreto"
              icone={<Archive size={16} />}
              onClick={() => {
                atualizar({ ativo: !p.ativo })
                toast(p.ativo ? `${p.nome} arquivado. O histórico continua aqui.` : `${p.nome} voltou para a lista.`)
              }}
            >
              {p.ativo ? 'Arquivar' : 'Desarquivar'}
            </Button>
            <Button variante="discreto" className="!text-danger hover:!bg-danger-soft" icone={<Trash2 size={16} />} onClick={() => setApagar(true)}>
              Excluir ficha
            </Button>
          </div>
        </div>
      </div>

      <FormParceiro pedido={editar ? { editando: p } : null} onFechar={() => setEditar(false)} />
      <VincularLancamentos parceiro={p} aberto={vincular} onFechar={() => setVincular(false)} />
      <Modal
        aberto={apagar}
        onFechar={() => setApagar(false)}
        titulo={`Excluir a ficha de ${p.nome}?`}
        rodape={
          <>
            <Button variante="secundario" onClick={() => setApagar(false)}>
              Cancelar
            </Button>
            <Button
              variante="perigo"
              onClick={() => {
                const desfazer = excluirParceiro(p.id)
                navigate('/clientes', { replace: true })
                toast(`Ficha de ${p.nome} excluída.`, { desfazer })
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>Os lançamentos continuam em Lançamentos, com o nome {p.nome}; só deixam de estar ligados a esta ficha. Contatos, anotações e tarefas saem junto. Se quiser só tirar da lista, use Arquivar.</p>
      </Modal>
    </>
  )
}

function Legenda({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-[3px]" style={{ background: cor }} aria-hidden />
      {children}
    </span>
  )
}

function Numero({
  rotulo,
  valor,
  texto,
  cor = 'text-ink',
  tom,
  icone,
  nota,
  alerta,
  explica,
}: {
  rotulo: string
  valor?: number
  texto?: string
  cor?: string
  tom: 'verde' | 'vermelho' | 'azul' | 'ambar' | 'laranja' | 'neutro'
  icone: ReactNode
  nota?: string
  alerta?: boolean
  explica: ReactNode
}) {
  return (
    <Card className="!p-4 md:!p-5">
      <div className="mb-2 flex items-center gap-2.5">
        <IconeBox tom={tom} tamanho="sm">
          {icone}
        </IconeBox>
        <span className="flex min-w-0 items-center gap-0.5 text-[13px] font-semibold text-[#3d5170]">
          <span className="truncate">{rotulo}</span>
          {explica}
        </span>
      </div>
      <p className={`valor-grande text-[22px] md:text-[27px] ${cor}`}>{valor !== undefined ? <ValorAnimado centavos={valor} /> : <span className="text-[20px] md:text-[23px]">{texto}</span>}</p>
      {nota && <p className={`mt-1 text-[12px] ${alerta ? 'font-semibold text-danger' : 'text-ink-2'}`}>{nota}</p>}
    </Card>
  )
}

function LinhaLancamento({ l, hoje, categoria, atraso, onTirar }: { l: Lancamento; hoje: string; categoria?: string; atraso: number; onTirar: () => void }) {
  const entrada = l.natureza === 'entrada'
  const aberto = l.situacao === 'previsto'
  const vencida = aberto && !!l.dataVencimento && l.dataVencimento < hoje
  const numeros = [l.numeroFatura && `Fatura ${l.numeroFatura}`, l.numeroProforma && `Pro forma ${l.numeroProforma}`, l.numeroOrcamento && `Orçamento ${l.numeroOrcamento}`].filter(Boolean)
  return (
    <li className="anim-entrar group flex items-center gap-1" style={{ animationDelay: `${Math.min(atraso, 10) * 30}ms` }}>
      <Link to={`/lancar?id=${l.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] px-2 py-3 transition-colors hover:bg-hover md:px-3">
        <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${entrada ? 'bg-gradient-to-b from-[#ecf9f2] to-[#d9f2e5] text-success' : 'bg-gradient-to-b from-[#fff4ea] to-[#ffe3cc] text-[#e8640c]'}`}>
          {entrada ? <ArrowUpRight size={18} aria-hidden /> : <ArrowDown size={18} aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink">{l.descricao || categoria || (entrada ? 'Recebimento' : 'Pagamento')}</span>
          <span className="block truncate text-[12px] text-ink-2">
            {aberto ? `Vence ${dataBR(l.dataVencimento!)}` : `${entrada ? 'Recebido' : 'Pago'} em ${dataBR(l.dataPagamento!)}`}
            {categoria ? ` · ${categoria}` : ''}
            {numeros.length ? ` · ${numeros.join(' · ')}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`num text-[14px] font-bold ${entrada ? 'text-success' : 'text-ink'}`}>
            {entrada ? '+' : '−'}
            {brl(l.valor, { centavos: l.valor % 100 !== 0 })}
          </span>
          {aberto && (vencida ? <Badge tom="vermelho">Atrasada</Badge> : <Badge tom="ambar">{entrada ? 'A receber' : 'A pagar'}</Badge>)}
        </span>
      </Link>
      <button onClick={onTirar} title="Tirar da ficha" aria-label={`Tirar ${l.descricao ?? 'lançamento'} da ficha`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-slate opacity-60 transition hover:bg-hover hover:text-danger group-hover:opacity-100">
        <Unlink size={15} />
      </button>
    </li>
  )
}

function Contatos({ p }: { p: Parceiro }) {
  const itens: { icone: ReactNode; texto: string; href?: string }[] = []
  if (p.telefone) itens.push({ icone: <Phone size={15} />, texto: p.telefone, href: `tel:${p.telefone.replace(/[^\d+]/g, '')}` })
  if (p.email) itens.push({ icone: <Mail size={15} />, texto: p.email, href: `mailto:${p.email}` })
  if (p.endereco) itens.push({ icone: <MapPin size={15} />, texto: p.endereco, href: `https://www.google.com/maps/search/${encodeURIComponent(p.endereco)}` })
  if (p.documento) itens.push({ icone: <FileText size={15} />, texto: p.documento })
  return (
    <Card>
      <CardTitulo acao={<SeloTipo tipo={p.tipo} />}>Contato</CardTitulo>
      {itens.length === 0 && !p.contatos?.length && <p className="text-[13px] text-ink-2">Sem telefone, e-mail ou endereço. Toque em Editar para completar.</p>}
      <ul className="flex flex-col gap-2.5">
        {itens.map((i) => (
          <li key={i.texto} className="flex items-start gap-2.5 text-[14px] text-ink">
            <span className="mt-0.5 text-slate">{i.icone}</span>
            {i.href ? (
              <a href={i.href} target={i.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="min-w-0 break-words hover:text-primary hover:underline">
                {i.texto}
              </a>
            ) : (
              <span className="min-w-0 break-words">{i.texto}</span>
            )}
          </li>
        ))}
      </ul>
      {!!p.contatos?.length && (
        <>
          <p className="mt-4 mb-2 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">Pessoas de contato</p>
          <ul className="flex flex-col gap-2">
            {p.contatos.map((c) => {
              const zap = linkWhatsApp(c.telefone)
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-[12px] bg-hover/60 px-3 py-2.5">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-[12px] font-bold text-navy">{c.nome.charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">
                      {c.nome}
                      {c.cargo && <span className="font-normal text-ink-2"> · {c.cargo}</span>}
                    </span>
                    <span className="block truncate text-[12px] text-ink-2">{[c.telefone, c.email].filter(Boolean).join(' · ') || 'Sem telefone'}</span>
                  </span>
                  {zap && (
                    <a href={zap} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${c.nome}`} className="inline-flex size-9 items-center justify-center rounded-full text-success hover:bg-success-soft">
                      <MessageCircle size={17} />
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} aria-label={`E-mail para ${c.nome}`} className="inline-flex size-9 items-center justify-center rounded-full text-primary hover:bg-primary-soft">
                      <Mail size={16} />
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {p.observacao && <p className="mt-4 rounded-[12px] bg-warning-soft px-3 py-2.5 text-[13px] text-[#7a3c07]">{p.observacao}</p>}
    </Card>
  )
}

function Tarefas({ p, hoje, atualizar }: { p: Parceiro; hoje: string; atualizar: (m: Partial<Parceiro>) => void }) {
  const [texto, setTexto] = useState('')
  const [prazo, setPrazo] = useState('')
  const tarefas = [...(p.tarefas ?? [])].sort((a, b) => Number(a.feita) - Number(b.feita) || (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'))
  const pendentes = tarefas.filter((t) => !t.feita).length
  const adicionar = () => {
    if (!texto.trim()) return
    atualizar({ tarefas: [...(p.tarefas ?? []), { id: uid(), texto: texto.trim(), prazo: prazo || undefined, feita: false }] })
    setTexto('')
    setPrazo('')
  }
  return (
    <Card>
      <CardTitulo acao={pendentes > 0 ? <Badge tom="azul">{pendentes} a fazer</Badge> : undefined}>Tarefas</CardTitulo>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          adicionar()
        }}
      >
        <input
          aria-label="Nova tarefa"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={ehFornecedor(p) && !ehCliente(p) ? 'Ex.: pedir a tabela nova' : 'Ex.: mandar o orçamento'}
          maxLength={300}
          className="h-10 min-w-0 flex-1 rounded-[12px] border border-line bg-surface px-3 text-[14px] text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
        />
        <input aria-label="Prazo da tarefa" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="h-10 w-[42px] rounded-[12px] border border-line bg-surface px-2 text-[13px] text-ink focus:border-primary focus:outline-none sm:w-[140px]" />
        <Button type="submit" tamanho="sm" className="!h-10" aria-label="Adicionar tarefa" icone={<Plus size={16} />} />
      </form>
      {tarefas.length === 0 ? (
        <p className="text-[13px] text-ink-2">Anote o que precisa fazer com {p.nome}: ligar, cobrar, pedir orçamento.</p>
      ) : (
        <ul className="-mx-1 flex flex-col">
          {tarefas.map((t) => {
            const atrasada = !t.feita && !!t.prazo && t.prazo < hoje
            return (
              <li key={t.id} className="group flex items-center gap-2 rounded-[10px] px-1 py-1.5 hover:bg-hover">
                <button
                  onClick={() => atualizar({ tarefas: (p.tarefas ?? []).map((x) => (x.id === t.id ? { ...x, feita: !x.feita } : x)) })}
                  aria-label={t.feita ? `Marcar "${t.texto}" como não feita` : `Marcar "${t.texto}" como feita`}
                  className={`shrink-0 transition-transform active:scale-90 ${t.feita ? 'text-success' : 'text-slate hover:text-primary'}`}
                >
                  {t.feita ? <CheckCircle2 size={20} className="anim-check" /> : <Circle size={20} />}
                </button>
                <span className={`min-w-0 flex-1 text-[14px] ${t.feita ? 'text-muted line-through' : 'text-ink'}`}>{t.texto}</span>
                {t.prazo && <span className={`num shrink-0 text-[12px] ${atrasada ? 'font-semibold text-danger' : 'text-ink-2'}`}>{t.prazo === hoje ? 'hoje' : dataBR(t.prazo).slice(0, 5)}</span>}
                <button
                  onClick={() => atualizar({ tarefas: (p.tarefas ?? []).filter((x) => x.id !== t.id) })}
                  aria-label={`Apagar a tarefa "${t.texto}"`}
                  className="shrink-0 rounded-md p-1 text-slate opacity-0 transition group-hover:opacity-100 hover:text-danger focus:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function Anotacoes({ p, hoje, atualizar }: { p: Parceiro; hoje: string; atualizar: (m: Partial<Parceiro>) => void }) {
  const [texto, setTexto] = useState('')
  const notas = [...(p.anotacoes ?? [])].sort((a, b) => b.data.localeCompare(a.data))
  const adicionar = () => {
    if (!texto.trim()) return
    atualizar({ anotacoes: [{ id: uid(), data: hoje, texto: texto.trim() }, ...(p.anotacoes ?? [])] })
    setTexto('')
  }
  return (
    <Card>
      <CardTitulo>Anotações</CardTitulo>
      <div className="mb-3">
        <textarea
          aria-label="Nova anotação"
          rows={2}
          maxLength={2000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) adicionar()
          }}
          placeholder="Ex.: combinou entrega toda sexta; prefere Pix."
          className="w-full rounded-[12px] border border-line bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
        />
        {texto.trim() && (
          <Button tamanho="sm" className="anim-aparecer mt-2" icone={<NotebookPen size={15} />} onClick={adicionar}>
            Guardar anotação
          </Button>
        )}
      </div>
      {notas.length === 0 ? (
        <p className="text-[13px] text-ink-2">Nada anotado ainda.</p>
      ) : (
        <ol className="relative ml-1.5 border-l-2 border-line pl-4">
          {notas.map((n) => (
            <li key={n.id} className="group relative pb-3.5 last:pb-0">
              <span className="absolute top-1.5 -left-[22px] size-2.5 rounded-full bg-primary ring-4 ring-surface" aria-hidden />
              <p className="flex items-center justify-between gap-2 text-[12px] font-semibold text-ink-2">
                {dataBR(n.data)}
                <button
                  onClick={() => atualizar({ anotacoes: (p.anotacoes ?? []).filter((x) => x.id !== n.id) })}
                  aria-label="Apagar anotação"
                  className="rounded-md p-0.5 text-slate opacity-0 transition group-hover:opacity-100 hover:text-danger focus:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </p>
              <p className="text-[14px] whitespace-pre-line text-ink">{n.texto}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
