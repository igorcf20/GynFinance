import { ArrowDownRight, ArrowUpRight, ChevronRight, Clock, Plus, Search, Sparkles, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvatarParceiro, PERIODOS, periodoDe, SeloTipo, type IdPeriodo } from '../components/parceiros/comum'
import { FormParceiro, type PedidoParceiro } from '../components/parceiros/FormParceiro'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card, CardTitulo, EstadoVazio, IconeBox } from '../components/ui/Card'
import { Explica } from '../components/ui/Explica'
import { useToast } from '../components/ui/Modal'
import { Segmentado } from '../components/ui/Tabs'
import { ValorAnimado } from '../components/ui/ValorAnimado'
import { ehCliente, ehFornecedor, nomesSemCadastro, normalizarNome, resumoDeTodos } from '../domain/parceiros'
import { useStore } from '../data/store'
import { brl, dataBR } from '../lib/format'

type Aba = 'todos' | 'clientes' | 'fornecedores'

export function Parceiros() {
  const { dados, hoje, cadastrarSugeridos } = useStore()
  const toast = useToast()
  const [aba, setAba] = useState<Aba>('todos')
  const [idPeriodo, setIdPeriodo] = useState<IdPeriodo>('ano')
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState<PedidoParceiro | null>(null)
  const [verSugestoes, setVerSugestoes] = useState(false)
  const periodo = periodoDe(idPeriodo, hoje)

  const linhas = useMemo(() => resumoDeTodos(dados, periodo, hoje), [dados, periodo.de, periodo.ate, hoje]) // eslint-disable-line react-hooks/exhaustive-deps
  const ativos = linhas.filter((l) => l.parceiro.ativo)
  const clientes = ativos.filter((l) => ehCliente(l.parceiro))
  const fornecedores = ativos.filter((l) => ehFornecedor(l.parceiro))
  const sugestoes = useMemo(() => nomesSemCadastro(dados), [dados])

  const recebido = clientes.reduce((t, l) => t + l.resumo.recebido, 0)
  const pago = fornecedores.reduce((t, l) => t + l.resumo.pago, 0)
  const aReceber = clientes.reduce((t, l) => t + l.resumo.aReceber, 0)
  const atrasado = clientes.reduce((t, l) => t + l.resumo.atrasadoReceber, 0)
  const aPagar = fornecedores.reduce((t, l) => t + l.resumo.aPagar, 0)

  const termo = normalizarNome(busca)
  const lista = (aba === 'clientes' ? clientes : aba === 'fornecedores' ? fornecedores : ativos)
    .filter((l) => !termo || normalizarNome(`${l.parceiro.nome} ${l.parceiro.documento ?? ''} ${(l.parceiro.contatos ?? []).map((c) => c.nome).join(' ')}`).includes(termo))
    .sort((a, b) => b.resumo.recebido + b.resumo.pago - (a.resumo.recebido + a.resumo.pago) || a.parceiro.nome.localeCompare(b.parceiro.nome, 'pt-BR'))
  const arquivados = linhas.filter((l) => !l.parceiro.ativo).length

  const topClientes = [...clientes].filter((l) => l.resumo.recebido > 0).sort((a, b) => b.resumo.recebido - a.resumo.recebido).slice(0, 5)
  const topFornecedores = [...fornecedores].filter((l) => l.resumo.pago > 0).sort((a, b) => b.resumo.pago - a.resumo.pago).slice(0, 5)

  const cadastrarTodos = () => {
    const desfazer = cadastrarSugeridos(sugestoes)
    setVerSugestoes(false)
    toast(`${sugestoes.length} ${sugestoes.length === 1 ? 'ficha criada' : 'fichas criadas'}, com o histórico de cada um.`, { desfazer })
  }

  return (
    <>
      <Header
        titulo="Clientes e fornecedores"
        subtitulo="Com quem você mais ganha e com quem mais gasta."
        acoes={
          <span className="hidden sm:inline-flex">
            <Button onClick={() => setForm({ tipo: aba === 'fornecedores' ? 'fornecedor' : 'cliente' })} icone={<Plus size={17} strokeWidth={2.4} />}>
              Novo cadastro
            </Button>
          </span>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
        <Resumo
          rotulo="Recebido dos clientes"
          valor={recebido}
          cor="text-success"
          icone={<ArrowUpRight size={19} />}
          tom="verde"
          explica={
            <Explica titulo="Recebido dos clientes" conta={<>Soma {periodo.texto}: <b>{brl(recebido)}</b></>}>
              Tudo o que os clientes cadastrados pagaram {periodo.texto}, pela data em que o dinheiro entrou. Vendas sem cliente cadastrado ficam de fora.
            </Explica>
          }
        />
        <Resumo
          rotulo="Pago aos fornecedores"
          valor={pago}
          cor="text-danger"
          icone={<ArrowDownRight size={19} />}
          tom="vermelho"
          explica={
            <Explica titulo="Pago aos fornecedores" conta={<>Soma {periodo.texto}: <b>{brl(pago)}</b></>}>
              Faturas, despesas e pagamentos feitos aos fornecedores cadastrados {periodo.texto}, pela data do pagamento.
            </Explica>
          }
        />
        <Resumo
          rotulo="A receber"
          valor={aReceber}
          cor="text-ink"
          icone={<Clock size={19} />}
          tom={atrasado ? 'laranja' : 'azul'}
          nota={atrasado ? `${brl(atrasado)} em atraso` : 'Nada em atraso'}
          explica={
            <Explica titulo="A receber dos clientes" conta={<>Em aberto: <b>{brl(aReceber)}</b>{atrasado ? <> · vencido: <b>{brl(atrasado)}</b></> : null}</>}>
              Contas a receber dos clientes cadastrados que ainda não foram pagas, de qualquer data.
            </Explica>
          }
        />
        <Resumo
          rotulo="A pagar"
          valor={aPagar}
          cor="text-ink"
          icone={<Clock size={19} />}
          tom="ambar"
          explica={
            <Explica titulo="A pagar aos fornecedores" lado="direita" conta={<>Em aberto: <b>{brl(aPagar)}</b></>}>
              Faturas e contas dos fornecedores cadastrados que ainda vão vencer ou estão vencidas.
            </Explica>
          }
        />
      </div>

      {sugestoes.length > 0 && (
        <Card className="mb-5 !py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <IconeBox tom="azul">
              <Sparkles size={19} />
            </IconeBox>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">
                {sugestoes.length} {sugestoes.length === 1 ? 'nome' : 'nomes'} dos seus lançamentos e da agenda ainda sem ficha
              </p>
              <p className="text-[13px] text-ink-2">
                {sugestoes
                  .slice(0, 4)
                  .map((s) => s.nome)
                  .join(', ')}
                {sugestoes.length > 4 ? ` e mais ${sugestoes.length - 4}` : ''}. Cadastre e o histórico de cada um já entra na ficha.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variante="secundario" tamanho="sm" onClick={() => setVerSugestoes((v) => !v)}>
                {verSugestoes ? 'Esconder' : 'Escolher'}
              </Button>
              <Button tamanho="sm" onClick={cadastrarTodos}>
                Cadastrar todos
              </Button>
            </div>
          </div>
          {verSugestoes && (
            <ul className="anim-subir mt-3 divide-y divide-line border-t border-line">
              {sugestoes.map((s) => (
                <li key={s.nome} className="flex items-center gap-3 py-2.5">
                  <AvatarParceiro p={s} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{s.nome}</span>
                    <span className="block text-[12px] text-ink-2">
                      Aparece {s.vezes} {s.vezes === 1 ? 'vez' : 'vezes'}
                      {s.telefone ? ` · ${s.telefone}` : ''}
                    </span>
                  </span>
                  <SeloTipo tipo={s.tipo} />
                  <Button variante="contorno" tamanho="sm" onClick={() => setForm({ nome: s.nome, tipo: s.tipo })}>
                    Cadastrar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmentado
          rotulo="Mostrar"
          valor={aba}
          onChange={setAba}
          estilo="navy"
          grande
          className="w-full lg:w-[520px]"
          opcoes={[
            { valor: 'todos', rotulo: 'Todos', contagem: ativos.length },
            { valor: 'clientes', rotulo: 'Clientes', contagem: clientes.length },
            { valor: 'fornecedores', rotulo: 'Fornecedores', contagem: fornecedores.length },
          ]}
        />
        <div className="overflow-x-auto lg:ml-auto">
          <Segmentado rotulo="Período" valor={idPeriodo} onChange={setIdPeriodo} opcoes={PERIODOS} rolar />
        </div>
        <div className="relative lg:w-64">
          <Search size={17} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-navy" aria-hidden />
          <input
            type="search"
            aria-label="Buscar cliente ou fornecedor"
            placeholder="Buscar por nome ou CNPJ…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-12 w-full rounded-[14px] border border-[#e3e9f1] bg-surface pr-3 pl-10 text-[14px] shadow-[var(--shadow-card)] placeholder:text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <span className="sm:hidden">
          <Button variante="secundario" onClick={() => setForm({ tipo: aba === 'fornecedores' ? 'fornecedor' : 'cliente' })} icone={<Plus size={16} />} className="w-full">
            Novo cadastro
          </Button>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="!px-2 !py-2 md:!px-3">
          {lista.length === 0 ? (
            <EstadoVazio
              icone={<Users size={22} />}
              titulo={termo ? 'Ninguém com esse nome' : 'Nenhum cadastro ainda'}
              texto={termo ? 'Tente outro nome ou cadastre agora.' : 'Cadastre seus clientes e fornecedores para ver quanto ganha e gasta com cada um.'}
              acao={<Button onClick={() => setForm({ nome: busca, tipo: aba === 'fornecedores' ? 'fornecedor' : 'cliente' })} icone={<Plus size={16} />}>Cadastrar</Button>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {lista.map(({ parceiro: p, resumo: r }, i) => (
                <li key={p.id} className="anim-entrar" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                  <Link to={`/clientes/${p.id}`} className="group flex items-center gap-3 rounded-[14px] px-2 py-3 transition-colors hover:bg-hover md:gap-4 md:px-3">
                    <AvatarParceiro p={p} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-bold text-ink">{p.nome}</span>
                        <span className="hidden sm:inline-flex">
                          <SeloTipo tipo={p.tipo} />
                        </span>
                      </span>
                      <span className="block truncate text-[12.5px] text-ink-2">
                        {r.ultimoMovimento ? `Último movimento em ${dataBR(r.ultimoMovimento)}` : 'Sem movimento ainda'}
                        {r.atrasadoReceber > 0 && <span className="font-semibold text-danger"> · {brl(r.atrasadoReceber)} em atraso</span>}
                        {!r.atrasadoReceber && r.aReceber > 0 && <span> · {brl(r.aReceber)} a receber</span>}
                        {r.aPagar > 0 && <span> · {brl(r.aPagar)} a pagar</span>}
                      </span>
                    </span>
                    <span className="text-right">
                      {r.recebido > 0 && <span className="num block text-[15px] font-bold text-success">+{brl(r.recebido)}</span>}
                      {r.pago > 0 && <span className={`num block font-bold text-danger ${r.recebido > 0 ? 'text-[13px]' : 'text-[15px]'}`}>−{brl(r.pago)}</span>}
                      {!r.recebido && !r.pago && <span className="num block text-[14px] text-muted">{brl(0)}</span>}
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-slate transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {arquivados > 0 && <p className="px-3 pt-2 pb-1 text-[12px] text-ink-2">{arquivados} arquivado{arquivados > 1 ? 's' : ''} fora da lista.</p>}
        </Card>

        <div className="flex flex-col gap-4 md:gap-5">
          <Ranking titulo="Quem mais comprou" vazio="Nenhum recebimento de cliente cadastrado" linhas={topClientes.map((l) => ({ p: l.parceiro, valor: l.resumo.recebido }))} cor="verde" periodo={periodo.texto} />
          <Ranking titulo="Com quem mais gastou" vazio="Nenhum pagamento a fornecedor cadastrado" linhas={topFornecedores.map((l) => ({ p: l.parceiro, valor: l.resumo.pago }))} cor="laranja" periodo={periodo.texto} />
        </div>
      </div>

      <FormParceiro pedido={form} onFechar={() => setForm(null)} />
    </>
  )
}

function Resumo({ rotulo, valor, cor, icone, tom, nota, explica }: { rotulo: string; valor: number; cor: string; icone: React.ReactNode; tom: 'verde' | 'vermelho' | 'azul' | 'ambar' | 'laranja'; nota?: string; explica: React.ReactNode }) {
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
      <p className={`valor-grande text-[22px] md:text-[27px] ${cor}`}>
        <ValorAnimado centavos={valor} />
      </p>
      {nota && <p className={`mt-1 text-[12px] ${nota.includes('atraso') && !nota.startsWith('Nada') ? 'font-semibold text-danger' : 'text-ink-2'}`}>{nota}</p>}
    </Card>
  )
}

function Ranking({ titulo, linhas, vazio, cor, periodo }: { titulo: string; linhas: { p: { id: string; nome: string; tipo: 'cliente' | 'fornecedor' | 'ambos' }; valor: number }[]; vazio: string; cor: 'verde' | 'laranja'; periodo: string }) {
  const max = Math.max(1, ...linhas.map((l) => l.valor))
  const grad = cor === 'verde' ? 'linear-gradient(90deg,#3fc58a,#12925a)' : 'linear-gradient(90deg,#ffb26b,#f08a24)'
  return (
    <Card>
      <CardTitulo
        explica={
          <Explica titulo={titulo} lado="direita">
            Os cinco maiores {cor === 'verde' ? 'clientes, pelo que pagaram' : 'fornecedores, pelo que você pagou'} {periodo}. A barra compara cada um com o primeiro da lista.
          </Explica>
        }
      >
        {titulo}
      </CardTitulo>
      {linhas.length === 0 ? (
        <p className="text-[13px] text-ink-2">{vazio} {periodo}.</p>
      ) : (
        <ol className="space-y-3.5">
          {linhas.map((l, i) => (
            <li key={l.p.id}>
              <Link to={`/clientes/${l.p.id}`} className="group block">
                <span className="mb-1.5 flex items-center justify-between gap-3 text-[14px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="num inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-hover text-[11px] font-bold text-ink-2">{i + 1}</span>
                    <span className="truncate font-medium text-ink group-hover:text-primary">{l.p.nome}</span>
                  </span>
                  <span className="num font-semibold text-ink">{brl(l.valor)}</span>
                </span>
                <span className="block h-2 rounded-full bg-[#edf1f6]">
                  <span className="anim-encher block h-2 origin-left rounded-full" style={{ width: `${Math.max(5, (l.valor / max) * 100)}%`, backgroundImage: grad, animationDelay: `${i * 70}ms` }} />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
