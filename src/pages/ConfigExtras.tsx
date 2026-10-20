// Seções de Configurações que chegaram com as melhorias de outubro/2026: cobrança, categorias
// próprias, metas e tetos, avisos no celular, contador, negócios, indicação e lixeira.
import { BellRing, Building2, Check, Copy, Gift, MessageCircle, Plus, RotateCcw, Share2, Trash2, UserCheck, UserMinus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardTitulo, EstadoVazio } from '../components/ui/Card'
import { Input, Select, Toggle } from '../components/ui/Field'
import { Modal, useToast } from '../components/ui/Modal'
import { api } from '../data/api'
import { NOMES_GRUPO } from '../data/categorias'
import { useStore } from '../data/store'
import { MARCAS_COBRANCA, MENSAGEM_PADRAO, textoCobranca } from '../domain/cobranca'
import type { Categoria, Lancamento } from '../domain/types'
import { desligarAvisos, estadoAvisos, ligarAvisos, type EstadoAvisos } from '../lib/avisos'
import { addDias, brl, centavosParaTexto, dataBR, lerValor, uid } from '../lib/format'
import { Texto } from './admin/comum'

/** Copia para a área de transferência, com aviso. */
function useCopiar() {
  const toast = useToast()
  return async (texto: string, aviso = 'Link copiado.') => {
    try {
      await navigator.clipboard.writeText(texto)
      toast(aviso)
    } catch {
      window.prompt('Copie o texto:', texto)
    }
  }
}

// ---------- Cobrança (Empresa) ----------

export function Cobranca() {
  const { dados, atualizarEmpresa, hoje } = useStore()
  const toast = useToast()
  const [pix, setPix] = useState(dados.empresa.chavePix ?? '')
  const [msg, setMsg] = useState(dados.empresa.mensagemCobranca ?? '')
  const exemplo: Lancamento = {
    id: 'exemplo', empresaId: dados.empresa.id, natureza: 'entrada', valor: 15000, contaFinanceiraId: '', situacao: 'previsto', dataCompetencia: hoje,
    dataVencimento: addDias(hoje, -2), formaPagamento: 'pix', notaEmitida: 'nao', contraparte: 'Maria Souza', descricao: 'Encomenda',
  }
  const previa = textoCobranca(exemplo, { ...dados.empresa, chavePix: pix, mensagemCobranca: msg })
  return (
    <Card>
      <CardTitulo>Cobrança pelo WhatsApp</CardTitulo>
      <p className="-mt-2 mb-4 text-[13px] text-ink-2">
        Em "A receber" e "Em atraso", o botão Cobrar abre o WhatsApp do cliente com esta mensagem pronta. Quando o cliente tem telefone na ficha ou na agenda, a
        conversa já abre com ele.
      </p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          atualizarEmpresa({ chavePix: pix.trim() || undefined, mensagemCobranca: msg.trim() && msg.trim() !== MENSAGEM_PADRAO ? msg.trim() : undefined })
          toast('Cobrança salva.')
        }}
      >
        <Input label="Chave Pix do negócio" value={pix} onChange={(e) => setPix(e.target.value)} placeholder="CNPJ, celular, e-mail ou chave aleatória" maxLength={140} />
        <Texto label="Mensagem (opcional)" rows={4} value={msg || MENSAGEM_PADRAO} onChange={(e) => setMsg(e.target.value)} maxLength={1000} />
        <p className="-mt-2 text-[12px] text-ink-2">
          O sistema troca {MARCAS_COBRANCA.map((m, i) => (
            <span key={m}>
              <code className="rounded bg-hover px-1 text-ink">{m}</code>
              {i < MARCAS_COBRANCA.length - 1 ? ' ' : ''}
            </span>
          ))}{' '}
          pelos dados de cada conta.
        </p>
        <div className="rounded-[14px] border border-[#cdebd9] bg-[#f3fbf6] p-3.5">
          <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-success">
            <MessageCircle size={14} aria-hidden /> Assim o cliente recebe
          </p>
          <p className="text-[14px] text-ink">{previa}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {msg && (
            <Button type="button" variante="secundario" onClick={() => setMsg('')}>
              Voltar ao texto padrão
            </Button>
          )}
          <Button type="submit">Salvar cobrança</Button>
        </div>
      </form>
    </Card>
  )
}

// ---------- Categorias ----------

const GRUPOS_EDITAVEIS: Categoria['grupo'][] = ['receita', 'custo', 'despesa_fixa', 'despesa_variavel', 'imposto', 'retirada']

export function CategoriasEditaveis() {
  const { dados, salvarCategoria, somenteLeitura } = useStore()
  const toast = useToast()
  const [editando, setEditando] = useState<Categoria | null>(null)
  const novo = (): Categoria => ({ id: uid(), empresaId: dados.empresa.id, nome: '', grupo: 'despesa_variavel', contaNoFaturamento: false, ativa: true })
  return (
    <Card>
      <CardTitulo
        acao={
          !somenteLeitura && (
            <Button tamanho="sm" icone={<Plus size={15} />} onClick={() => setEditando(novo())}>
              Nova categoria
            </Button>
          )
        }
      >
        Categorias
      </CardTitulo>
      <p className="-mt-2 mb-4 text-[13px] text-ink-2">
        Crie as categorias do seu jeito e esconda as que não usa. Uma categoria escondida some das listas, mas os lançamentos antigos continuam com ela.
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {GRUPOS_EDITAVEIS.map((g) => (
          <div key={g}>
            <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">{NOMES_GRUPO[g]}</p>
            <ul className="flex flex-col gap-1.5">
              {dados.categorias
                .filter((c) => c.grupo === g)
                .map((c) => (
                  <li key={c.id} className={`flex items-center gap-2 rounded-[12px] border border-line px-3 py-2 ${c.ativa ? '' : 'opacity-55'}`}>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
                      {c.nome}
                      {c.empresaId && <span className="ml-1.5 text-[11px] font-semibold text-primary">sua</span>}
                    </span>
                    {c.contaNoFaturamento && <Badge tom="azul">faturamento</Badge>}
                    {!somenteLeitura && (
                      <>
                        {c.empresaId && (
                          <button type="button" className="text-[12px] font-semibold text-primary hover:underline" onClick={() => setEditando(c)}>
                            Editar
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-ink-2 hover:text-ink hover:underline"
                          onClick={() => {
                            salvarCategoria({ ...c, ativa: !c.ativa })
                            toast(c.ativa ? `"${c.nome}" escondida.` : `"${c.nome}" de volta às listas.`)
                          }}
                        >
                          {c.ativa ? 'Esconder' : 'Mostrar'}
                        </button>
                      </>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[12px] text-ink-2">As marcadas com "faturamento" contam no limite do MEI e na meta do mês.</p>
      {editando && <FormCategoria inicial={editando} onFechar={() => setEditando(null)} />}
    </Card>
  )
}

function FormCategoria({ inicial, onFechar }: { inicial: Categoria; onFechar: () => void }) {
  const { dados, salvarCategoria } = useStore()
  const toast = useToast()
  const [c, setC] = useState(inicial)
  const nova = !dados.categorias.some((x) => x.id === inicial.id)
  const repetida = dados.categorias.some((x) => x.id !== c.id && x.nome.trim().toLowerCase() === c.nome.trim().toLowerCase())
  const salvar = () => {
    if (!c.nome.trim() || repetida) return
    salvarCategoria({ ...c, nome: c.nome.trim(), contaNoFaturamento: c.grupo === 'receita' && c.contaNoFaturamento })
    toast(nova ? `Categoria "${c.nome.trim()}" criada.` : 'Categoria salva.')
    onFechar()
  }
  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={nova ? 'Nova categoria' : 'Editar categoria'}
      rodape={
        <>
          <Button variante="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={!c.nome.trim() || repetida}>
            {nova ? 'Criar' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Nome" value={c.nome} autoFocus maxLength={60} onChange={(e) => setC({ ...c, nome: e.target.value })} placeholder="Ex.: Esmaltes" erro={repetida ? 'Já existe uma categoria com esse nome.' : undefined} />
        <Select label="Tipo" value={c.grupo} onChange={(e) => setC({ ...c, grupo: e.target.value as Categoria['grupo'] })} opcoes={GRUPOS_EDITAVEIS.map((g) => ({ valor: g, rotulo: NOMES_GRUPO[g] }))} />
        {c.grupo === 'receita' && (
          <Toggle checked={c.contaNoFaturamento} onChange={(v) => setC({ ...c, contaNoFaturamento: v })} label="Conta no faturamento" descricao="Vendas e serviços contam no limite do MEI e na meta do mês." />
        )}
      </div>
    </Modal>
  )
}

// ---------- Metas e tetos ----------

export function MetasETetos() {
  const { dados, atualizarEmpresa, somenteLeitura } = useStore()
  const toast = useToast()
  const [meta, setMeta] = useState(dados.empresa.metaFaturamento ? centavosParaTexto(dados.empresa.metaFaturamento) : '')
  const saidas = dados.categorias.filter((c) => c.ativa && c.grupo !== 'receita' && c.grupo !== 'retirada')
  const [tetos, setTetos] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(dados.empresa.limitesCategoria ?? {}).map(([k, v]) => [k, centavosParaTexto(v)])),
  )
  return (
    <Card>
      <CardTitulo>Metas e tetos</CardTitulo>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          const limites = Object.fromEntries(Object.entries(tetos).map(([k, v]) => [k, lerValor(v)]).filter(([, v]) => (v as number) > 0))
          atualizarEmpresa({ metaFaturamento: lerValor(meta) || undefined, limitesCategoria: Object.keys(limites).length ? limites : undefined })
          toast('Metas e tetos salvos.')
        }}
      >
        <div>
          <Input label="Meta de vendas por mês" inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="Ex.: 8.000,00 (vazio = sem meta)" />
          <p className="mt-1.5 text-[12px] text-ink-2">Aparece no Início com quanto falta e quanto precisa vender por dia para chegar lá.</p>
        </div>
        <div>
          <p className="text-[15px] font-bold text-ink">Teto de gasto por categoria</p>
          <p className="mb-3 text-[12px] text-ink-2">Quanto você aceita gastar por mês em cada uma. O app avisa quando passar de 80% e quando estourar. Deixe em branco para não ter teto.</p>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            {saidas.map((c) => (
              <Input key={c.id} label={c.nome} inputMode="decimal" value={tetos[c.id] ?? ''} onChange={(e) => setTetos((t) => ({ ...t, [c.id]: e.target.value }))} placeholder="Sem teto" />
            ))}
          </div>
        </div>
        {!somenteLeitura && (
          <div className="flex justify-end">
            <Button type="submit">Salvar metas e tetos</Button>
          </div>
        )}
      </form>
    </Card>
  )
}

// ---------- Avisos no celular (Notificações) ----------

export function AvisosNoAparelho() {
  const { servidor } = useStore()
  const toast = useToast()
  const [estado, setEstado] = useState<EstadoAvisos | 'carregando'>('carregando')
  const [mexendo, setMexendo] = useState(false)
  useEffect(() => {
    if (servidor !== 'com') return
    void estadoAvisos().then(setEstado).catch(() => setEstado('sem-suporte'))
  }, [servidor])
  const texto: Record<EstadoAvisos | 'carregando' | 'demo', string> = {
    demo: 'Na versão instalada, os lembretes de contas, DAS e fechamento do mês aparecem na tela do celular, como os de qualquer app.',
    carregando: 'Conferindo este aparelho...',
    'sem-suporte': 'Este navegador não recebe avisos. No celular, use o Chrome (Android) ou adicione o Gynfinance à tela de início (iPhone).',
    'precisa-instalar': 'No iPhone, os avisos funcionam com o Gynfinance na tela de início: toque em Compartilhar e depois em "Adicionar à Tela de Início". Depois abra por lá e volte aqui.',
    bloqueado: 'Os avisos estão bloqueados para o Gynfinance neste navegador. Libere nas configurações do navegador (Notificações) e volte aqui.',
    desligado: 'Os lembretes de contas, DAS e fechamento do mês aparecem na tela do celular, mesmo com o app fechado.',
    ligado: 'Ligado neste aparelho. Os lembretes do dia chegam a partir das 8h.',
  }
  const chave = servidor !== 'com' ? 'demo' : estado
  const alternar = async (ligar: boolean) => {
    setMexendo(true)
    try {
      const novo = ligar ? await ligarAvisos() : await desligarAvisos()
      setEstado(novo)
      toast(novo === 'ligado' ? 'Avisos ligados neste aparelho.' : novo === 'bloqueado' ? 'O navegador bloqueou os avisos.' : 'Avisos desligados neste aparelho.')
    } catch (e) {
      toast((e as Error).message || 'Não deu para ligar os avisos agora.')
    } finally {
      setMexendo(false)
    }
  }
  return (
    <Card>
      <div className="flex items-start gap-3.5">
        <span className="grad-primario inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white">
          <BellRing size={19} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-ink">Avisos no celular</p>
          <p className="mt-0.5 text-[13px] text-ink-2">{texto[chave]}</p>
        </div>
        {(estado === 'ligado' || estado === 'desligado') && servidor === 'com' && (
          <Button tamanho="sm" variante={estado === 'ligado' ? 'secundario' : 'primario'} carregando={mexendo} onClick={() => void alternar(estado !== 'ligado')}>
            {estado === 'ligado' ? 'Desligar' : 'Ligar'}
          </Button>
        )}
      </div>
    </Card>
  )
}

// ---------- Contador ----------

interface ContadorLista {
  id: string
  nome: string
  email: string
  desde: string
}

export function Contador() {
  const { dados, servidor, somenteLeitura, conta, trocarNegocio } = useStore()
  const toast = useToast()
  const copiar = useCopiar()
  const [lista, setLista] = useState<ContadorLista[] | null>(null)
  const [convite, setConvite] = useState<{ link: string; validoAte: string } | null>(null)
  const [gerando, setGerando] = useState(false)
  const [tirar, setTirar] = useState<ContadorLista | null>(null)
  const real = servidor === 'com'
  useEffect(() => {
    if (!real || somenteLeitura) return
    void api<{ contadores: ContadorLista[] }>('GET', 'contador').then((r) => setLista(r.contadores)).catch(() => setLista([]))
  }, [real, somenteLeitura, dados.empresa.id])

  if (somenteLeitura) {
    return (
      <Card>
        <CardTitulo>Acesso de contador</CardTitulo>
        <p className="text-[14px] text-ink-2">
          Você está vendo <b className="text-ink">{dados.empresa.nomeFantasia}</b> como contador. Dá para consultar tudo, baixar a planilha e o relatório em PDF, mas não
          dá para mudar nada.
        </p>
        <Button
          className="mt-4"
          variante="secundario"
          icone={<UserMinus size={16} />}
          onClick={async () => {
            await api('POST', 'contador/sair', { empresaId: dados.empresa.id })
            const outro = conta?.negocios?.find((n) => n.id !== dados.empresa.id)
            toast(`Você não vê mais ${dados.empresa.nomeFantasia}.`)
            if (outro) await trocarNegocio(outro.id)
            else window.location.reload()
          }}
        >
          Deixar de ver este negócio
        </Button>
      </Card>
    )
  }

  const mensagem = convite ? `Olá! Quero te dar acesso ao financeiro da ${dados.empresa.nomeFantasia} no Gynfinance, só para consulta. Abra este link: ${convite.link}` : ''
  return (
    <Card>
      <CardTitulo>Acesso do contador</CardTitulo>
      <p className="-mt-2 mb-4 text-[13px] text-ink-2">
        Convide o seu contador para ver os lançamentos, as contas, os relatórios e o MEI. Ele só vê: não muda nada. Você tira o acesso quando quiser.
      </p>
      <div className="flex items-center gap-3 rounded-[12px] border border-line p-3.5">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">{dados.empresa.nomeDono.charAt(0)}</span>
        <div className="flex-1">
          <p className="font-semibold text-ink">{dados.empresa.nomeDono}</p>
          <p className="text-[12px] text-ink-2">Dono do negócio</p>
        </div>
        <Badge tom="azul">Acesso total</Badge>
      </div>
      {lista?.map((c) => (
        <div key={c.id} className="mt-2 flex items-center gap-3 rounded-[12px] border border-line p-3.5">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-hover text-navy">
            <UserCheck size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{c.nome}</p>
            <p className="truncate text-[12px] text-ink-2">
              {c.email} · desde {dataBR(c.desde)}
            </p>
          </div>
          <Badge>Só vê</Badge>
          <button type="button" className="text-[12px] font-semibold text-danger hover:underline" onClick={() => setTirar(c)}>
            Tirar
          </button>
        </div>
      ))}
      {!real ? (
        <p className="mt-4 text-[13px] text-ink-2">Na versão instalada, o botão "Convidar contador" gera um link para mandar pelo WhatsApp.</p>
      ) : convite ? (
        <div className="mt-4 rounded-[14px] border border-primary-line bg-primary-soft/50 p-4">
          <p className="text-[14px] font-semibold text-ink">Link de convite pronto</p>
          <p className="mt-1 text-[12px] text-ink-2">Vale até {dataBR(convite.validoAte)} e para uma pessoa só. Quem abrir entra ou cria a conta e passa a ver este negócio.</p>
          <p className="mt-2 rounded-[10px] bg-surface px-3 py-2 text-[12px] break-all text-ink">{convite.link}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              className="inline-flex h-10 items-center gap-1.5 rounded-[12px] bg-[#25d366] px-3.5 text-[13px] font-semibold text-white"
              href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={15} aria-hidden /> Mandar pelo WhatsApp
            </a>
            <Button tamanho="sm" variante="secundario" icone={<Copy size={14} />} onClick={() => void copiar(convite.link)}>
              Copiar link
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="mt-4"
          icone={<Plus size={16} />}
          carregando={gerando}
          onClick={async () => {
            setGerando(true)
            try {
              setConvite(await api<{ link: string; validoAte: string }>('POST', 'contador/convite'))
            } catch (e) {
              toast((e as Error).message)
            } finally {
              setGerando(false)
            }
          }}
        >
          Convidar contador
        </Button>
      )}
      <Modal
        aberto={!!tirar}
        onFechar={() => setTirar(null)}
        titulo="Tirar o acesso?"
        rodape={
          <>
            <Button variante="secundario" onClick={() => setTirar(null)}>
              Cancelar
            </Button>
            <Button
              variante="perigo"
              onClick={async () => {
                if (!tirar) return
                await api('DELETE', `contador/${tirar.id}`).catch(() => {})
                setLista((l) => l?.filter((x) => x.id !== tirar.id) ?? null)
                toast(`${tirar.nome} não vê mais o negócio.`)
                setTirar(null)
              }}
            >
              Tirar acesso
            </Button>
          </>
        }
      >
        <p>{tirar?.nome} deixa de ver os dados da {dados.empresa.nomeFantasia} na hora. Para voltar, mande um convite novo.</p>
      </Modal>
    </Card>
  )
}

// ---------- Negócios ----------

export function Negocios() {
  const { dados, servidor, conta, trocarNegocio } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [abrindo, setAbrindo] = useState<string | null>(null)
  const lista = conta?.negocios ?? [{ id: dados.empresa.id, nome: dados.empresa.nomeFantasia, papel: 'dono' as const }]
  const meus = lista.filter((n) => n.papel === 'dono').length
  const limite = conta?.limiteNegocios ?? 1
  const podeCriar = servidor === 'com' && meus < limite
  return (
    <Card>
      <CardTitulo>Seus negócios</CardTitulo>
      <p className="-mt-2 mb-4 text-[13px] text-ink-2">
        Cada negócio tem o seu caixa, as suas contas e os seus relatórios, separados. Troque de negócio aqui ou pelo nome no menu.
      </p>
      <ul className="flex flex-col gap-2">
        {lista.map((n) => {
          const aberto = n.id === dados.empresa.id
          return (
            <li key={n.id} className={`flex items-center gap-3 rounded-[12px] border p-3.5 ${aberto ? 'border-primary bg-primary-soft/40' : 'border-line'}`}>
              <span className={`inline-flex size-10 items-center justify-center rounded-full ${aberto ? 'grad-primario text-white' : 'bg-hover text-navy'}`}>
                <Building2 size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{n.nome}</p>
                <p className="text-[12px] text-ink-2">{n.papel === 'dono' ? 'Seu negócio' : 'Você vê como contador'}</p>
              </div>
              {aberto ? (
                <Badge tom="azul" icone={<Check size={12} />}>
                  Aberto
                </Badge>
              ) : (
                <Button
                  tamanho="sm"
                  variante="secundario"
                  carregando={abrindo === n.id}
                  onClick={async () => {
                    setAbrindo(n.id)
                    try {
                      await trocarNegocio(n.id)
                      toast(`${n.nome} aberto.`)
                      navigate('/')
                    } catch (e) {
                      toast((e as Error).message)
                    } finally {
                      setAbrindo(null)
                    }
                  }}
                >
                  Abrir
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button icone={<Plus size={16} />} disabled={!podeCriar} onClick={() => navigate('/comecar?novo=1')}>
          Novo negócio
        </Button>
        <p className="text-[12px] text-ink-2">
          {servidor !== 'com'
            ? 'Na versão instalada, dá para ter mais de um negócio na mesma conta.'
            : podeCriar
              ? `Seu plano permite ${limite} ${limite === 1 ? 'negócio' : 'negócios'}.`
              : `Seu plano permite ${limite} ${limite === 1 ? 'negócio' : 'negócios'}. Para ter mais, fale com a gente e mude de plano.`}
        </p>
      </div>
    </Card>
  )
}

// ---------- Indique e ganhe ----------

export function Indicacao() {
  const { conta, servidor, dados } = useStore()
  const copiar = useCopiar()
  const codigo = conta?.indicacao?.codigo ?? 'seu-codigo'
  const link = `${window.location.origin}/?indicacao=${codigo}`
  const mensagem = `Estou usando o Gynfinance para organizar o dinheiro da ${dados.empresa.nomeFantasia} e está me ajudando muito. Assinando por este link, você ganha 1 mês grátis: ${link}`
  return (
    <Card>
      <div className="flex items-start gap-3.5">
        <span className="grad-primario inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white">
          <Gift size={21} aria-hidden />
        </span>
        <div className="min-w-0">
          <CardTitulo className="!mb-1">Indique e ganhe</CardTitulo>
          <p className="text-[13px] text-ink-2">Mande o seu link para outros empreendedores. Quem assinar por ele ganha 1 mês grátis, e você também ganha 1 mês a cada indicação que virar assinatura.</p>
        </div>
      </div>
      <p className="mt-4 rounded-[12px] border border-line bg-hover/60 px-3.5 py-2.5 text-[13px] break-all text-ink">{servidor === 'com' ? link : 'Na versão instalada, o seu link pessoal aparece aqui.'}</p>
      {servidor === 'com' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            className="inline-flex h-10 items-center gap-1.5 rounded-[12px] bg-[#25d366] px-3.5 text-[13px] font-semibold text-white"
            href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Share2 size={15} aria-hidden /> Mandar pelo WhatsApp
          </a>
          <Button tamanho="sm" variante="secundario" icone={<Copy size={14} />} onClick={() => void copiar(link)}>
            Copiar link
          </Button>
        </div>
      )}
      {conta?.indicacao && (
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[12px] bg-hover/60 px-3.5 py-2.5">
            <dt className="text-[12px] text-ink-2">Se cadastraram</dt>
            <dd className="num text-[22px] font-bold text-ink">{conta.indicacao.cadastros}</dd>
          </div>
          <div className="rounded-[12px] bg-hover/60 px-3.5 py-2.5">
            <dt className="text-[12px] text-ink-2">Já assinam (meses ganhos)</dt>
            <dd className="num text-[22px] font-bold text-success">{conta.indicacao.assinantes}</dd>
          </div>
        </dl>
      )}
    </Card>
  )
}

// ---------- Lixeira ----------

export function Lixeira() {
  const { dados, restaurarLancamento, somenteLeitura, hoje } = useStore()
  const toast = useToast()
  const itens = dados.lixeira ?? []
  const nomeCat = (id?: string) => dados.categorias.find((c) => c.id === id)?.nome
  return (
    <Card>
      <CardTitulo>Lixeira</CardTitulo>
      <p className="-mt-2 mb-4 text-[13px] text-ink-2">Lançamentos apagados ficam aqui por 30 dias. Depois disso somem de vez.</p>
      {itens.length === 0 ? (
        <EstadoVazio icone={<Trash2 size={22} />} titulo="A lixeira está vazia" texto="Quando você apagar um lançamento, ele aparece aqui e dá para trazer de volta." />
      ) : (
        <ul className="divide-y divide-line">
          {itens.map((i) => {
            const l = i.lancamentos.find((x) => !x.espelhoDe) ?? i.lancamentos[0]
            const restam = 30 - Math.round((Date.parse(hoje) - Date.parse(i.excluidoEm)) / 864e5)
            return (
              <li key={i.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{l.descricao || l.contraparte || nomeCat(l.categoriaId) || 'Lançamento'}</p>
                  <p className="text-[12px] text-ink-2">
                    {l.natureza === 'entrada' ? 'Entrada' : l.natureza === 'saida' ? 'Saída' : 'Movimento'} de {dataBR(l.dataCompetencia)} · apagado em {dataBR(i.excluidoEm)} · some em{' '}
                    {Math.max(0, restam)} {restam === 1 ? 'dia' : 'dias'}
                  </p>
                </div>
                <span className={`num shrink-0 font-bold ${l.natureza === 'entrada' ? 'text-success' : 'text-ink'}`}>{brl(l.valor)}</span>
                {!somenteLeitura && (
                  <Button
                    tamanho="sm"
                    variante="secundario"
                    icone={<RotateCcw size={14} />}
                    onClick={() => {
                      restaurarLancamento(i.id)
                      toast('Lançamento de volta.')
                    }}
                  >
                    Restaurar
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
