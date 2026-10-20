// Configuração inicial (tela 0 do planejamento): roda uma vez, em até 2 minutos, e troca a
// demonstração pelos dados do próprio negócio.
import { ArrowLeft, ArrowRight, Briefcase, Building2, Check, Factory, Landmark, Package, PiggyBank, Store, UserRound, Wallet, X, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/layout/Logo'
import { Button } from '../components/ui/Button'
import { Input, Label, Select } from '../components/ui/Field'
import { limiteDoAno } from '../domain/calc'
import { parametroDoAno } from '../domain/parametros'
import type { Atividade } from '../domain/types'
import { categoriasDoNegocio } from '../data/categorias'
import { useStore, type ConfigInicial } from '../data/store'
import { brl, hojeReal, lerValor, mesAno } from '../lib/format'

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

const ATIVIDADES: { valor: Atividade; titulo: string; descricao: string; icone: LucideIcon }[] = [
  { valor: 'comercio', titulo: 'Vendo produtos', descricao: 'Loja, doces, roupas, revenda', icone: Store },
  { valor: 'servico', titulo: 'Presto serviços', descricao: 'Beleza, manutenção, aulas, consultoria', icone: Briefcase },
  { valor: 'misto', titulo: 'Os dois', descricao: 'Vendo produtos e presto serviços', icone: Package },
  { valor: 'industria', titulo: 'Fabrico o que vendo', descricao: 'Produção própria, oficina, confecção', icone: Factory },
]

interface Respostas {
  nomeDono: string
  nomeFantasia: string
  cnpj: string
  uf: string
  ehMei: boolean | null
  mesAbertura: string
  atividade: Atividade | null
  saldoBanco: string
  saldoCaixa: string
  prolabore: string
  faturadoAntes: string
  dasEmDia: boolean | null
}

type Passo = 'negocio' | 'funcionamento' | 'dinheiro' | 'mei'

/** Escolha em cartão grande, com o check animado quando selecionada. */
function Opcao({ selecionada, onClick, titulo, descricao, icone: Icone }: { selecionada: boolean; onClick: () => void; titulo: string; descricao?: string; icone?: LucideIcon }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selecionada}
      onClick={onClick}
      className={`relative flex min-h-[64px] w-full items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-all duration-200 active:scale-[0.98] ${
        selecionada
          ? 'border-primary bg-gradient-to-b from-[#f3f8ff] to-[#e8f0fe] shadow-[0_8px_22px_-14px_rgba(37,99,235,0.6)]'
          : 'border-line bg-surface hover:-translate-y-px hover:border-[#c9d7ec] hover:shadow-[var(--shadow-card)]'
      }`}
    >
      {Icone && (
        <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${selecionada ? 'grad-primario text-white' : 'bg-[#eef3f9] text-[#2f4a72]'}`}>
          <Icone size={19} strokeWidth={2} aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-ink">{titulo}</span>
        {descricao && <span className="block text-[12.5px] leading-snug text-ink-2">{descricao}</span>}
      </span>
      <span
        className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-all ${selecionada ? 'border-primary bg-primary text-white' : 'border-[#cfd9e6] bg-white'}`}
        aria-hidden
      >
        {selecionada && <Check size={12} strokeWidth={3.2} />}
      </span>
    </button>
  )
}

function Grupo({ rotulo, children, colunas = 2, erro }: { rotulo: string; children: ReactNode; colunas?: 1 | 2; erro?: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo}>
      <Label>{rotulo}</Label>
      <div className={`grid gap-2.5 ${colunas === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>{children}</div>
      {erro && <p className="mt-1.5 text-[12px] text-danger">{erro}</p>}
    </div>
  )
}

function CampoValor({ label, valor, onChange, ajuda, placeholder = '0,00' }: { label: string; valor: string; onChange: (v: string) => void; ajuda?: string; placeholder?: string }) {
  return (
    <div>
      <Input
        label={label}
        inputMode="decimal"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        icone={<span className="text-[14px] font-semibold text-[#3d5170]">R$</span>}
      />
      {ajuda && <p className="mt-1.5 text-[12px] leading-relaxed text-ink-2">{ajuda}</p>}
    </div>
  )
}

/** Prévia ao lado do formulário (computador): mostra o painel que vai nascer das respostas. */
function Previa({ r }: { r: Respostas }) {
  const hoje = hojeReal()
  const ano = Number(hoje.slice(0, 4))
  const saldo = lerValor(r.saldoBanco) + lerValor(r.saldoCaixa)
  const faturado = lerValor(r.faturadoAntes)
  const limite = r.mesAbertura ? limiteDoAno(ano, `${r.mesAbertura}-01`) : parametroDoAno(ano).limiteAnual
  const usado = limite > 0 ? Math.min(1, faturado / limite) : 0
  return (
    <aside aria-label="Prévia do seu painel" className="sticky top-8 hidden lg:block">
      <p className="mb-3 text-[12px] font-semibold tracking-[0.06em] text-ink-2 uppercase">Seu painel vai começar assim</p>
      <div className="card p-5">
        <p className="text-[13px] font-medium text-ink-2">{r.nomeDono ? `Olá, ${r.nomeDono.split(' ')[0]}` : 'Olá'}</p>
        <p className="truncate text-[18px] font-bold text-ink">{r.nomeFantasia || 'Seu negócio'}</p>
        <div className="mt-4 rounded-[14px] bg-gradient-to-br from-[#f3f8ff] to-[#e6effe] p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-navy">
            <Wallet size={16} aria-hidden /> Saldo do caixa hoje
          </p>
          <p className="valor-grande num mt-1 text-[30px] text-ink">{brl(saldo)}</p>
          <p className="text-[12px] text-ink-2">Conta da empresa + dinheiro no caixa</p>
        </div>
        {r.ehMei && (
          <div className="mt-3 rounded-[14px] border border-line p-4">
            <p className="text-[13px] font-semibold text-ink">Limite do MEI em {ano}</p>
            <p className="num mt-1 text-[13px] text-ink-2">
              {brl(faturado)} de {brl(limite)}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8eef6]">
              <div className="h-full rounded-full grad-primario transition-[width] duration-500" style={{ width: `${Math.max(2, usado * 100)}%` }} />
            </div>
          </div>
        )}
        {lerValor(r.prolabore) > 0 && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
            <PiggyBank size={16} className="text-primary" aria-hidden /> Meta de pró-labore: <b className="num text-ink">{brl(lerValor(r.prolabore))}</b> por mês
          </p>
        )}
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-ink-2">Você pode mudar tudo isso depois em Configurações.</p>
    </aside>
  )
}

export function Onboarding() {
  const { modo, comecar, servidor, conta, dados } = useStore()
  const navigate = useNavigate()
  // "Novo negócio" (Configurações > Seus negócios): cria mais um, sem apagar o que está aberto.
  const adicional = useSearchParams()[0].get('novo') === '1' && servidor === 'com' && !!conta?.temNegocio
  const hoje = hojeReal()
  const [r, setR] = useState<Respostas>({
    nomeDono: adicional ? dados.empresa.nomeDono : '',
    nomeFantasia: '',
    cnpj: '',
    uf: '',
    ehMei: null,
    mesAbertura: '',
    atividade: null,
    saldoBanco: '',
    saldoCaixa: '',
    prolabore: '',
    faturadoAntes: '',
    dasEmDia: null,
  })
  const [passo, setPasso] = useState<Passo>('negocio')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [pronto, setPronto] = useState<ConfigInicial | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')
  const set = <K extends keyof Respostas>(k: K, v: Respostas[K]) => {
    setR((x) => ({ ...x, [k]: v }))
    setErros((e) => ({ ...e, [k]: '' }))
  }

  const passos: Passo[] = r.ehMei ? ['negocio', 'funcionamento', 'dinheiro', 'mei'] : ['negocio', 'funcionamento', 'dinheiro']
  const indice = passos.indexOf(passo)
  const ultimo = indice === passos.length - 1
  const mesHoje = hoje.slice(0, 7)

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (passo === 'negocio') {
      if (!r.nomeDono.trim()) e.nomeDono = 'Diga como podemos te chamar.'
      if (!r.nomeFantasia.trim()) e.nomeFantasia = 'Escreva o nome do negócio.'
      if (!r.uf) e.uf = 'Escolha o estado.'
    }
    if (passo === 'funcionamento') {
      if (!r.atividade) e.atividade = 'Escolha o que mais parece com o seu negócio.'
      if (r.ehMei === null) e.ehMei = 'Responda se a empresa é MEI.'
      if (!r.mesAbertura) e.mesAbertura = 'Informe o mês em que a empresa abriu.'
      else if (r.mesAbertura > mesHoje) e.mesAbertura = 'O mês de abertura não pode ser no futuro.'
    }
    if (passo === 'mei' && r.dasEmDia === null) e.dasEmDia = 'Responda sobre os DAS do ano.'
    setErros(e)
    return Object.values(e).every((x) => !x)
  }

  async function avancar() {
    if (!validar()) return
    if (!ultimo) {
      setPasso(passos[indice + 1])
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const c: ConfigInicial = {
      nomeDono: r.nomeDono,
      nomeFantasia: r.nomeFantasia,
      cnpj: r.cnpj,
      uf: r.uf,
      ehMei: !!r.ehMei,
      mesAbertura: r.mesAbertura,
      atividade: r.atividade!,
      saldoBanco: lerValor(r.saldoBanco),
      saldoCaixa: lerValor(r.saldoCaixa),
      prolaboreDesejado: lerValor(r.prolabore) || undefined,
      faturadoAntes: r.ehMei ? lerValor(r.faturadoAntes) || undefined : undefined,
      dasEmDia: r.ehMei ? !!r.dasEmDia : undefined,
    }
    setSalvando(true)
    setErroEnvio('')
    try {
      await comecar(c, adicional)
      setPronto(c)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErroEnvio((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  // Na versão instalada, o negócio fica na conta da pessoa: primeiro entrar ou criar a conta.
  if (servidor === 'com' && !conta) return <Navigate to="/entrar?depois=comecar" replace />

  const TITULOS: Record<Passo, { titulo: string; texto: string }> = {
    negocio: { titulo: 'Vamos conhecer o seu negócio', texto: 'São 2 minutos. Com isso o Gynfinance já monta o seu painel.' },
    funcionamento: { titulo: 'Como o negócio funciona', texto: 'Serve para mostrar as categorias certas e, se for MEI, o limite e o DAS do ano.' },
    dinheiro: { titulo: 'Quanto dinheiro tem hoje', texto: 'É o ponto de partida do saldo. Daqui para frente o sistema soma o que entra e tira o que sai.' },
    mei: { titulo: 'Seu MEI neste ano', texto: 'Para a barra do limite e os avisos do DAS começarem certos.' },
  }

  if (pronto) {
    const ano = Number(hoje.slice(0, 4))
    const categorias = categoriasDoNegocio(pronto.atividade).filter((c) => c.ativa).length
    const itens = [
      `${pronto.nomeFantasia} cadastrado, com ${categorias} categorias prontas para o seu tipo de negócio.`,
      `Saldo inicial de ${brl(pronto.saldoBanco + pronto.saldoCaixa)}: ${brl(pronto.saldoBanco)} na conta e ${brl(pronto.saldoCaixa)} no caixa.`,
      pronto.ehMei
        ? `Meu MEI ligado: limite de ${brl(limiteDoAno(ano, `${pronto.mesAbertura}-01`))} em ${ano} e DAS de ${brl(parametroDoAno(ano).dasValorPorAtividade[pronto.atividade], { centavos: true })} todo dia 20.`
        : 'Como a empresa não é MEI, a tela Meu MEI fica escondida.',
      pronto.prolaboreDesejado ? `Meta de pró-labore de ${brl(pronto.prolaboreDesejado)} por mês.` : 'Pró-labore sem meta por enquanto. Dá para definir depois.',
    ]
    return (
      <div className="flex min-h-dvh flex-col items-center px-4 py-8 md:py-14">
        <Logo />
        <div className="card anim-janela mt-8 w-full max-w-[560px] p-6 text-center md:p-9">
          <span className="mx-auto inline-flex size-16 items-center justify-center rounded-full grad-primario text-white shadow-[var(--shadow-primary)]">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path className="anim-check" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h1 className="mt-5 text-[24px] font-bold tracking-[-0.02em] text-ink md:text-[28px]">Tudo pronto, {pronto.nomeDono.split(' ')[0]}!</h1>
          <p className="mt-1.5 text-[14px] text-ink-2">O seu painel já está montado. Agora é só lançar o que entra e o que sai.</p>
          <ul className="mt-6 space-y-2.5 text-left">
            {itens.map((t, i) => (
              <li key={i} data-entrar className="anim-entrar flex gap-3 rounded-[12px] bg-[#f6f9fd] px-3.5 py-3 text-[13.5px] leading-snug text-ink" style={{ animationDelay: `${200 + i * 90}ms` }}>
                <Check size={17} strokeWidth={2.6} className="mt-px shrink-0 text-success" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-7 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Button variante="secundario" tamanho="lg" onClick={() => navigate('/')}>
              Ver o painel
            </Button>
            <Button tamanho="lg" onClick={() => navigate('/lancar')}>
              Fazer o 1º lançamento
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const t = TITULOS[passo]
  return (
    <div className="min-h-dvh px-4 pt-5 pb-10 md:px-8 md:pt-8">
      <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-4">
        <Logo />
        <Link to="/" className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-white hover:text-ink">
          <X size={16} aria-hidden /> {modo === 'demo' && !conta ? 'Voltar à demonstração' : 'Cancelar'}
        </Link>
      </div>

      <div className="mx-auto mt-6 grid max-w-[1040px] grid-cols-1 gap-8 md:mt-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <main>
          {/* Progresso: um traço por passo, que enche ao avançar. */}
          <div className="flex items-center gap-2" aria-label={`Passo ${indice + 1} de ${passos.length}`}>
            {passos.map((p, i) => (
              <span key={p} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e3eaf3]">
                <span className={`block h-full rounded-full grad-primario transition-[width] duration-500 ease-[var(--curva)] ${i <= indice ? 'w-full' : 'w-0'}`} />
              </span>
            ))}
          </div>
          <p className="mt-4 text-[12px] font-semibold tracking-[0.06em] text-primary uppercase">
            Passo {indice + 1} de {passos.length}
          </p>

          <div key={passo} className="anim-entrar">
            <h1 className="mt-1 text-[24px] font-bold tracking-[-0.02em] text-balance text-ink md:text-[30px]">{adicional && passo === 'negocio' ? 'Vamos conhecer o novo negócio' : t.titulo}</h1>
            <p className="mt-1.5 max-w-[56ch] text-[14px] text-ink-2 md:text-[15px]">{t.texto}</p>

            <form
              className="card mt-6 flex flex-col gap-5 p-5 md:p-7"
              onSubmit={(e) => {
                e.preventDefault()
                void avancar()
              }}
              noValidate
            >
              {passo === 'negocio' && (
                <>
                  {modo === 'real' && (
                    <p className="rounded-[12px] bg-warning-soft px-3.5 py-2.5 text-[13px] text-[#7a3c07]">
                      Você já tem um negócio configurado. Concluir esta configuração apaga os lançamentos atuais.
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input label="Seu nome" autoComplete="given-name" placeholder="Ex.: Ana" value={r.nomeDono} onChange={(e) => set('nomeDono', e.target.value)} erro={erros.nomeDono} icone={<UserRound size={17} />} />
                    <Input label="Nome do negócio" placeholder="Ex.: Doces da Ana" value={r.nomeFantasia} onChange={(e) => set('nomeFantasia', e.target.value)} erro={erros.nomeFantasia} icone={<Building2 size={17} />} />
                    <Input label="CNPJ (opcional)" inputMode="numeric" placeholder="00.000.000/0000-00" value={r.cnpj} onChange={(e) => set('cnpj', e.target.value)} />
                    <div>
                      <Select
                        label="Estado"
                        value={r.uf}
                        onChange={(e) => set('uf', e.target.value)}
                        opcoes={[{ valor: '', rotulo: 'Escolha o estado' }, ...UFS.map((u) => ({ valor: u, rotulo: u }))]}
                      />
                      {erros.uf ? <p className="mt-1 text-[12px] text-danger">{erros.uf}</p> : <p className="mt-1.5 text-[12px] text-ink-2">Para o botão de nota abrir o portal certo.</p>}
                    </div>
                  </div>
                </>
              )}

              {passo === 'funcionamento' && (
                <>
                  <Grupo rotulo="O que o negócio faz?" erro={erros.atividade}>
                    {ATIVIDADES.map((a) => (
                      <Opcao key={a.valor} selecionada={r.atividade === a.valor} onClick={() => set('atividade', a.valor)} titulo={a.titulo} descricao={a.descricao} icone={a.icone} />
                    ))}
                  </Grupo>
                  <Grupo rotulo="A empresa é MEI?" erro={erros.ehMei}>
                    <Opcao selecionada={r.ehMei === true} onClick={() => set('ehMei', true)} titulo="Sim, é MEI" descricao="Mostra o limite do ano e o DAS" />
                    <Opcao selecionada={r.ehMei === false} onClick={() => set('ehMei', false)} titulo="Não é MEI" descricao="ME, EPP ou ainda sem CNPJ" />
                  </Grupo>
                  <div className="sm:max-w-[280px]">
                    <Input label="Mês em que a empresa abriu" type="month" max={mesHoje} value={r.mesAbertura} onChange={(e) => set('mesAbertura', e.target.value)} erro={erros.mesAbertura} />
                    {!erros.mesAbertura && r.mesAbertura && <p className="mt-1.5 text-[12px] text-ink-2">{mesAno(r.mesAbertura)}</p>}
                  </div>
                </>
              )}

              {passo === 'dinheiro' && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <CampoValor label="Na conta da empresa" valor={r.saldoBanco} onChange={(v) => set('saldoBanco', v)} ajuda="Pix, cartão e boleto caem aqui." />
                    <CampoValor label="Em dinheiro, no caixa" valor={r.saldoCaixa} onChange={(v) => set('saldoCaixa', v)} ajuda="Notas e moedas guardadas no negócio." />
                  </div>
                  <p className="flex gap-2.5 rounded-[12px] bg-primary-soft/70 px-3.5 py-3 text-[13px] leading-relaxed text-[#2f4a72]">
                    <Landmark size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                    Se o negócio ainda usa a sua conta pessoal, coloque só a parte que é da empresa. Separar as duas é o primeiro passo para saber quanto sobra.
                  </p>
                  <CampoValor
                    label="Quanto você quer tirar por mês para você? (opcional)"
                    valor={r.prolabore}
                    onChange={(v) => set('prolabore', v)}
                    ajuda="É o seu pró-labore. O sistema avisa quando você tirar mais do que o negócio gerou no mês."
                  />
                </>
              )}

              {passo === 'mei' && (
                <>
                  <CampoValor
                    label={`Quanto o negócio já vendeu em ${hoje.slice(0, 4)}, antes de hoje? (opcional)`}
                    valor={r.faturadoAntes}
                    onChange={(v) => set('faturadoAntes', v)}
                    ajuda="Some as vendas e serviços do ano até agora. Assim a barra do limite do MEI já começa certa."
                  />
                  <Grupo rotulo="Os DAS deste ano estão pagos até o mês passado?" erro={erros.dasEmDia}>
                    <Opcao selecionada={r.dasEmDia === true} onClick={() => set('dasEmDia', true)} titulo="Sim, estão em dia" descricao="Ficam marcados como pagos" />
                    <Opcao selecionada={r.dasEmDia === false} onClick={() => set('dasEmDia', false)} titulo="Não, tenho meses atrasados" descricao="Aparecem como atrasados no Meu MEI" />
                  </Grupo>
                </>
              )}

              {erroEnvio && (
                <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13px] text-[#9b1c2e]">
                  {erroEnvio}
                </p>
              )}
              <div className="mt-1 flex flex-col-reverse gap-2.5 border-t border-line pt-5 sm:flex-row sm:justify-between">
                {indice > 0 ? (
                  <Button type="button" variante="discreto" tamanho="lg" icone={<ArrowLeft size={17} />} onClick={() => setPasso(passos[indice - 1])}>
                    Voltar
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="submit" tamanho="lg" className="sm:min-w-[200px]" carregando={salvando}>
                  {ultimo ? 'Concluir' : 'Continuar'}
                  {!ultimo && <ArrowRight size={17} aria-hidden />}
                </Button>
              </div>
            </form>
          </div>
        </main>
        <Previa r={r} />
      </div>
    </div>
  )
}
