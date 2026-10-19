import { Bell, Building2, CreditCard, Download, ExternalLink, KeyRound, Landmark, LogOut, Monitor, Moon, RotateCcw, ShieldCheck, Sparkles, Sun, Tags, Trash2, Users, XCircle, type LucideIcon } from 'lucide-react'
import { useTema } from '../components/layout/BotaoTema'
import type { Tema } from '../lib/tema'
import { useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { NOMES_GRUPO } from '../data/categorias'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/ui/Badge'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card, CardTitulo } from '../components/ui/Card'
import { Input, Select, Toggle } from '../components/ui/Field'
import { Modal, useToast } from '../components/ui/Modal'
import { saldoPorConta } from '../domain/calc'
import type { Atividade, Categoria } from '../domain/types'
import { api } from '../data/api'
import { useStore } from '../data/store'
import { brl } from '../lib/format'
import { LINK_PRIVACIDADE, LINK_TERMOS } from '../lib/legal'

const SECOES: { id: string; rotulo: string; icone: LucideIcon }[] = [
  { id: 'empresa', rotulo: 'Empresa', icone: Building2 },
  { id: 'categorias', rotulo: 'Categorias', icone: Tags },
  { id: 'contas', rotulo: 'Contas bancárias', icone: Landmark },
  { id: 'notificacoes', rotulo: 'Notificações', icone: Bell },
  { id: 'aparencia', rotulo: 'Aparência', icone: Moon },
  { id: 'usuarios', rotulo: 'Usuários', icone: Users },
  { id: 'assinatura', rotulo: 'Assinatura', icone: CreditCard },
  { id: 'privacidade', rotulo: 'Privacidade e dados', icone: ShieldCheck },
]

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

function Empresa() {
  const { dados, atualizarEmpresa } = useStore()
  const toast = useToast()
  const [f, setF] = useState(dados.empresa)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  return (
    <Card>
      <CardTitulo>Dados da empresa</CardTitulo>
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          atualizarEmpresa(f)
          toast('Dados da empresa salvos.')
        }}
      >
        <Input label="Nome do negócio" value={f.nomeFantasia} onChange={(e) => set('nomeFantasia', e.target.value)} required />
        <Input label="Seu nome" value={f.nomeDono} onChange={(e) => set('nomeDono', e.target.value)} required />
        <Select
          label="Tipo de negócio"
          value={f.atividade}
          onChange={(e) => set('atividade', e.target.value as Atividade)}
          opcoes={[
            { valor: 'comercio', rotulo: 'Comércio' },
            { valor: 'servico', rotulo: 'Serviços' },
            { valor: 'industria', rotulo: 'Indústria' },
            { valor: 'misto', rotulo: 'Comércio e serviços' },
          ]}
        />
        <Select
          label="A empresa é MEI?"
          value={f.ehMei ? 'sim' : 'nao'}
          onChange={(e) => set('ehMei', e.target.value === 'sim')}
          opcoes={[
            { valor: 'sim', rotulo: 'Sim, é MEI' },
            { valor: 'nao', rotulo: 'Não' },
          ]}
        />
        <Input label={f.ehMei ? 'CNPJ (MEI)' : 'CNPJ'} value={f.cnpj ?? ''} inputMode="numeric" placeholder="00.000.000/0000-00" onChange={(e) => set('cnpj', e.target.value)} />
        <Input label="Data de abertura" type="date" value={f.dataAbertura} onChange={(e) => set('dataAbertura', e.target.value)} />
        <Select label="Estado" value={f.uf} onChange={(e) => set('uf', e.target.value)} opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))} />
        <Input label="Cidade" value={f.municipio ?? ''} onChange={(e) => set('municipio', e.target.value)} />
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit">Salvar alterações</Button>
        </div>
      </form>
    </Card>
  )
}

function Categorias() {
  const { dados } = useStore()
  const grupos = Object.keys(NOMES_GRUPO) as Categoria['grupo'][]
  return (
    <Card>
      <CardTitulo>Categorias</CardTitulo>
      <p className="-mt-2 mb-4 text-[13px] text-ink-2">As categorias padrão já cobrem o dia a dia de um pequeno negócio. Criar categorias próprias chega numa próxima versão.</p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {grupos.map((g) => (
          <div key={g}>
            <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">{NOMES_GRUPO[g]}</p>
            <ul className="flex flex-wrap gap-2">
              {dados.categorias
                .filter((c) => c.grupo === g)
                .map((c) => (
                  <li key={c.id}>
                    <Badge tom={c.contaNoFaturamento ? 'azul' : 'neutro'}>{c.nome}</Badge>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[12px] text-ink-2">As categorias em azul contam no faturamento do MEI.</p>
    </Card>
  )
}

function Contas() {
  const { dados } = useStore()
  const saldos = saldoPorConta(dados)
  const TIPO = { caixa: 'Dinheiro em espécie', banco: 'Conta bancária', reserva: 'Reserva' }
  return (
    <Card>
      <CardTitulo>Onde o dinheiro está</CardTitulo>
      <ul className="divide-y divide-line">
        {dados.contas.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3.5">
            <div>
              <p className="font-semibold text-ink">{c.nome}</p>
              <p className="text-[12px] text-ink-2">{TIPO[c.tipo]}</p>
            </div>
            <span className="num font-semibold text-ink">{brl(saldos.get(c.id) ?? 0, { centavos: true })}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-ink-2">Pagamentos em dinheiro entram no Caixa; Pix, cartão e boleto entram na Conta PJ.</p>
    </Card>
  )
}

function Notificacoes() {
  const { dados, atualizarPreferencias } = useStore()
  const p = dados.preferencias
  return (
    <Card>
      <CardTitulo>Notificações</CardTitulo>
      <div className="divide-y divide-line">
        <div className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="font-medium text-ink">Avisar sobre contas</p>
            <p className="text-[12px] text-ink-2">Quando lembrar antes do vencimento.</p>
          </div>
          <Select
            aria-label="Antecedência do lembrete"
            className="w-40"
            value={String(p.lembreteDias)}
            onChange={(e) => atualizarPreferencias({ lembreteDias: Number(e.target.value) as 0 | 1 | 3 })}
            opcoes={[
              { valor: '0', rotulo: 'No dia' },
              { valor: '1', rotulo: '1 dia antes' },
              { valor: '3', rotulo: '3 dias antes' },
            ]}
          />
        </div>
        <Toggle checked={p.lembreteEmail} onChange={(v) => atualizarPreferencias({ lembreteEmail: v })} label="Receber avisos por e-mail" descricao="Contas, DAS e limite do MEI." />
        <Toggle checked={p.resumoMensal} onChange={(v) => atualizarPreferencias({ resumoMensal: v })} label="Resumo do mês no dia 1" descricao="Abre o fechamento do mês que terminou." />
      </div>
      <p className="mt-3 text-[12px] text-ink-2">Avisos pelo WhatsApp chegam numa próxima versão.</p>
    </Card>
  )
}

function Aparencia() {
  const { tema, trocar } = useTema()
  const opcoes: { valor: Tema; rotulo: string; texto: string; icone: React.ReactNode }[] = [
    { valor: 'claro', rotulo: 'Claro', texto: 'Fundo claro, o visual de sempre.', icone: <Sun size={20} /> },
    { valor: 'escuro', rotulo: 'Escuro', texto: 'Descansa a vista à noite.', icone: <Moon size={20} /> },
    { valor: 'sistema', rotulo: 'Igual ao aparelho', texto: 'Segue o modo do celular ou do computador.', icone: <Monitor size={20} /> },
  ]
  return (
    <Card>
      <CardTitulo>Aparência</CardTitulo>
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {opcoes.map((o) => {
          const ativo = tema === o.valor
          return (
            <button
              key={o.valor}
              role="radio"
              aria-checked={ativo}
              onClick={() => trocar(o.valor)}
              className={`flex flex-col items-start gap-2 rounded-[16px] border p-4 text-left transition-all active:scale-[0.98] ${ativo ? 'border-primary bg-primary-soft ring-4 ring-primary/12' : 'border-line bg-surface hover:border-primary-line'}`}
            >
              <span className={`inline-flex size-10 items-center justify-center rounded-full ${ativo ? 'grad-primario text-white' : 'bg-hover text-navy'}`}>{o.icone}</span>
              <span className="font-semibold text-ink">{o.rotulo}</span>
              <span className="text-[12px] text-ink-2">{o.texto}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-[12px] text-ink-2">Fica guardado neste aparelho. Também dá para trocar pela lua no topo da tela.</p>
    </Card>
  )
}

function Usuarios() {
  const { dados } = useStore()
  return (
    <Card>
      <CardTitulo>Usuários</CardTitulo>
      <div className="flex items-center gap-3 rounded-[12px] border border-line p-3.5">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">{dados.empresa.nomeDono.charAt(0)}</span>
        <div className="flex-1">
          <p className="font-semibold text-ink">{dados.empresa.nomeDono}</p>
          <p className="text-[12px] text-ink-2">Dona do negócio</p>
        </div>
        <Badge tom="azul">Acesso total</Badge>
      </div>
      <p className="mt-4 text-[13px] text-ink-2">Convidar o contador (só leitura) e outras pessoas chega numa próxima versão.</p>
    </Card>
  )
}

const SITUACAO_TEXTO: Record<string, string> = {
  teste: 'Você está no período de teste grátis, sem cobrança automática.',
  ativa: 'Assinatura em dia.',
  atrasada: 'A mensalidade está atrasada. Fale com a gente para regularizar.',
  suspensa: 'Assinatura suspensa: você vê e baixa os seus dados, mas não grava coisas novas.',
  cancelada: 'Assinatura cancelada: você ainda vê e baixa os seus dados.',
}
const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/** Cancelamento pelo próprio sistema, com protocolo (CDC e Decreto 7.962/2013). */
function Cancelamento() {
  const { conta, recarregarConta } = useStore()
  const toast = useToast()
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [protocolo, setProtocolo] = useState<number | null>(null)
  const [erro, setErro] = useState('')
  const pedido = conta?.assinatura?.cancelamentoPedidoEm
  async function pedir() {
    setEnviando(true)
    setErro('')
    try {
      const r = await api<{ protocolo: number }>('POST', 'conta/cancelamento', { motivo })
      setProtocolo(r.protocolo)
      await recarregarConta()
      toast(`Pedido de cancelamento registrado. Protocolo nº ${r.protocolo}.`)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <Card>
      <CardTitulo>Cancelar a assinatura</CardTitulo>
      {pedido ? (
        <p className="text-[13px] text-ink-2">
          Você pediu o cancelamento em <b className="text-ink">{dataBr(pedido.slice(0, 10))}</b>. A resposta chega em Ajuda e suporte. O acesso continua até o fim do período já pago.
        </p>
      ) : (
        <>
          <p className="mb-4 text-[13px] text-ink-2">
            Sem multa e sem fidelidade. O acesso continua até o fim do período já pago. Se contratou há menos de 7 dias, você tem direito à devolução integral do que pagou.
          </p>
          <Button variante="secundario" icone={<XCircle size={16} />} onClick={() => setAberto(true)}>
            Pedir cancelamento
          </Button>
        </>
      )}
      <Modal
        aberto={aberto}
        onFechar={() => {
          setAberto(false)
          setProtocolo(null)
        }}
        titulo={protocolo ? 'Pedido registrado' : 'Pedir cancelamento'}
        rodape={
          protocolo ? (
            <Button
              onClick={() => {
                setAberto(false)
                setProtocolo(null)
              }}
            >
              Entendi
            </Button>
          ) : (
            <>
              <Button variante="secundario" onClick={() => setAberto(false)}>
                Voltar
              </Button>
              <Button variante="perigo" carregando={enviando} onClick={pedir}>
                Pedir cancelamento
              </Button>
            </>
          )
        }
      >
        {protocolo ? (
          <p className="text-[14px]">
            Seu protocolo é o <b className="text-ink">nº {protocolo}</b>. A confirmação chega em Ajuda e suporte. Até o fim do período já pago, tudo continua funcionando.
          </p>
        ) : (
          <div className="flex flex-col gap-3 text-[14px]">
            <p>Antes de ir, baixe os seus dados em Configurações &gt; Privacidade e dados, se quiser guardar uma cópia.</p>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
              Quer contar o motivo? (opcional)
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} rows={3} className="rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[14px] font-normal text-ink outline-none focus:border-primary focus:ring-4 focus:ring-primary/12" />
            </label>
            {erro && (
              <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13px] text-[#9b1c2e]">
                {erro}
              </p>
            )}
          </div>
        )}
      </Modal>
    </Card>
  )
}

/** Direitos do titular (LGPD, art. 18): documentos, senha, cópia dos dados e exclusão da conta. */
function Privacidade() {
  const { modo, conta, sair } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [trocando, setTrocando] = useState(false)
  const [erroSenha, setErroSenha] = useState('')
  const [excluir, setExcluir] = useState(false)
  const [senhaExcluir, setSenhaExcluir] = useState('')
  const [excluindo, setExcluindo] = useState(false)
  const [erroExcluir, setErroExcluir] = useState('')
  const comConta = modo === 'real' && !!conta

  async function trocarSenha() {
    setErroSenha('')
    if (senhaNova.length < 8) return setErroSenha('A senha nova precisa de pelo menos 8 caracteres.')
    setTrocando(true)
    try {
      await api('POST', 'conta/senha', { atual: senhaAtual, nova: senhaNova })
      setSenhaAtual('')
      setSenhaNova('')
      toast('Senha trocada. Os outros aparelhos precisam entrar de novo.')
    } catch (e) {
      setErroSenha((e as Error).message)
    } finally {
      setTrocando(false)
    }
  }

  async function excluirConta() {
    setErroExcluir('')
    setExcluindo(true)
    try {
      await api('POST', 'conta/excluir', { senha: senhaExcluir })
      await sair()
      navigate('/entrar', { replace: true })
    } catch (e) {
      setErroExcluir((e as Error).message)
      setExcluindo(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <Card>
        <CardTitulo>Termos e privacidade</CardTitulo>
        <p className="mb-4 text-[13px] text-ink-2">
          Seus dados são usados só para o Gynfinance funcionar para você. Não vendemos dados e a nossa equipe não lê os seus lançamentos.
        </p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <a href={LINK_TERMOS} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline">
            Termos de Uso <ExternalLink size={14} aria-hidden />
          </a>
          <a href={LINK_PRIVACIDADE} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline sm:ml-4">
            Política de Privacidade <ExternalLink size={14} aria-hidden />
          </a>
        </div>
      </Card>
      {!comConta ? (
        <Card>
          <CardTitulo>Seus dados</CardTitulo>
          <p className="text-[13px] text-ink-2">Na demonstração os dados ficam só neste navegador e nada é enviado. Com uma conta, aqui você troca a senha, baixa uma cópia dos seus dados e exclui a conta.</p>
        </Card>
      ) : (
        <>
          <Card>
            <CardTitulo>Trocar a senha</CardTitulo>
            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                void trocarSenha()
              }}
            >
              <Input label="Senha atual" type="password" autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
              <Input label="Senha nova" type="password" autoComplete="new-password" placeholder="Pelo menos 8 caracteres" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} />
              {erroSenha && (
                <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13px] text-[#9b1c2e] sm:col-span-2">
                  {erroSenha}
                </p>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" variante="secundario" icone={<KeyRound size={16} />} carregando={trocando}>
                  Trocar a senha
                </Button>
              </div>
            </form>
          </Card>
          <Card>
            <CardTitulo>Baixar meus dados</CardTitulo>
            <p className="mb-4 text-[13px] text-ink-2">
              Um arquivo com tudo o que está guardado da sua conta: cadastro, negócio, lançamentos, clientes e fornecedores, chamados, mensalidades e acessos. Serve para guardar uma cópia
              ou levar para outro sistema.
            </p>
            <a href="api/conta/meus-dados" download className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-line bg-surface px-5 text-[14px] font-semibold text-ink hover:border-[#d3dce8]">
              <Download size={16} aria-hidden /> Baixar meus dados
            </a>
          </Card>
          <Card>
            <CardTitulo>Excluir minha conta</CardTitulo>
            <p className="mb-4 text-[13px] text-ink-2">
              Apaga a conta, o negócio, os lançamentos, os comprovantes e os chamados. Não dá para desfazer. Ficam guardados só o que a lei obriga: os registros de acesso (6 meses) e as
              mensalidades pagas (5 anos).
            </p>
            <Button variante="secundario" icone={<Trash2 size={16} />} onClick={() => setExcluir(true)} className="text-danger">
              Excluir minha conta
            </Button>
          </Card>
        </>
      )}
      <Modal
        aberto={excluir}
        onFechar={() => setExcluir(false)}
        titulo="Excluir a conta para sempre?"
        rodape={
          <>
            <Button variante="secundario" onClick={() => setExcluir(false)}>
              Cancelar
            </Button>
            <Button variante="perigo" icone={<Trash2 size={16} />} carregando={excluindo} disabled={!senhaExcluir} onClick={excluirConta}>
              Excluir para sempre
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-[14px]">
          <p>Tudo o que está no Gynfinance será apagado agora e não volta. Se quiser uma cópia, baixe os seus dados antes.</p>
          <Input label="Digite a sua senha para confirmar" type="password" autoComplete="current-password" value={senhaExcluir} onChange={(e) => setSenhaExcluir(e.target.value)} />
          {erroExcluir && (
            <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13px] text-[#9b1c2e]">
              {erroExcluir}
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}

function Assinatura() {
  const { restaurarDemo, modo, conta, sair } = useStore()
  const assinatura = conta?.assinatura
  const navigate = useNavigate()
  const toast = useToast()
  const [confirmar, setConfirmar] = useState(false)
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <Card>
        <CardTitulo>Assinatura</CardTitulo>
        <div className="rounded-[14px] border border-[#d6e4fb] bg-[#f4f8ff] p-5">
          <p className="text-[13px] font-semibold text-primary">Plano {assinatura?.planoNome ?? 'Essencial'}</p>
          <p className="num mt-1 text-[28px] font-bold text-ink">
            {brl(assinatura?.valorCentavos ?? 2500)}
            <span className="text-[14px] font-medium text-ink-2"> por mês</span>
          </p>
          {assinatura ? (
            <p className="mt-2 text-[13px] text-ink-2">
              {SITUACAO_TEXTO[assinatura.situacao]}
              {assinatura.proximoVencimento && assinatura.situacao !== 'cancelada' && (
                <>
                  {' '}
                  {assinatura.situacao === 'teste' ? 'O teste vai até' : 'Próximo vencimento:'} <b className="text-ink">{dataBr(assinatura.proximoVencimento)}</b>.
                </>
              )}{' '}
              Sem fidelidade.
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-ink-2">Entradas e saídas, contas a pagar e receber, Meu MEI e relatórios. Sem fidelidade.</p>
          )}
        </div>
      </Card>
      {modo === 'real' && conta && <Cancelamento />}
      {modo === 'demo' && (
        <Card>
          <CardTitulo>Demonstração</CardTitulo>
          <p className="mb-4 text-[13px] text-ink-2">
            Você está vendo os dados de exemplo da Doces da Ana. Para usar com o seu negócio, faça a configuração inicial. Para começar a apresentação do zero, restaure os
            dados originais.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <ButtonLink to="/comecar" icone={<Sparkles size={16} />}>
              Usar com o meu negócio
            </ButtonLink>
            <Button variante="secundario" icone={<RotateCcw size={16} />} onClick={() => setConfirmar(true)}>
              Restaurar dados de exemplo
            </Button>
          </div>
        </Card>
      )}
      {modo === 'real' && conta && (
        <Card>
          <CardTitulo>Sua conta</CardTitulo>
          <p className="mb-4 text-[13px] text-ink-2">
            Você entrou como <b className="text-ink">{conta.usuario.email}</b>. Os dados do negócio ficam guardados no servidor do Gynfinance, e dá para acessar
            do celular ou do computador.
          </p>
          <Button
            variante="secundario"
            icone={<LogOut size={16} />}
            onClick={async () => {
              await sair()
              navigate('/entrar', { replace: true })
            }}
          >
            Sair da conta
          </Button>
        </Card>
      )}
      {modo === 'real' && !conta && (
        <Card>
          <CardTitulo>Seus dados</CardTitulo>
          <p className="mb-4 text-[13px] text-ink-2">
            Por enquanto os dados ficam guardados neste navegador. Voltar para a demonstração apaga os lançamentos do seu negócio.
          </p>
          <Button variante="secundario" icone={<RotateCcw size={16} />} onClick={() => setConfirmar(true)}>
            Voltar para a demonstração
          </Button>
        </Card>
      )}
      <Modal
        aberto={confirmar}
        onFechar={() => setConfirmar(false)}
        titulo={modo === 'demo' ? 'Restaurar dados de exemplo?' : 'Voltar para a demonstração?'}
        rodape={
          <>
            <Button variante="secundario" onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                restaurarDemo()
                setConfirmar(false)
                toast('Dados de exemplo restaurados.')
              }}
            >
              Restaurar
            </Button>
          </>
        }
      >
        <p>
          {modo === 'demo'
            ? 'Tudo o que foi lançado na demonstração será apagado e os números voltam aos originais.'
            : 'Os lançamentos e a configuração do seu negócio serão apagados deste navegador, e a Doces da Ana volta a aparecer.'}
        </p>
      </Modal>
    </div>
  )
}

const CONTEUDO: Record<string, () => React.JSX.Element> = { empresa: Empresa, categorias: Categorias, contas: Contas, notificacoes: Notificacoes, aparencia: Aparencia, usuarios: Usuarios, assinatura: Assinatura, privacidade: Privacidade }

export function Settings() {
  const { secao = 'empresa' } = useParams()
  const Conteudo = CONTEUDO[secao] ?? Empresa
  return (
    <>
      <Header titulo="Configurações" />
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-[240px_1fr] lg:items-start">
        <nav
          aria-label="Configurações"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:card lg:mx-0 lg:flex-col lg:overflow-visible lg:p-2.5"
        >
          {SECOES.map((s) => {
            const ativo = secao === s.id
            return (
              <NavLink
                key={s.id}
                to={`/configuracoes/${s.id}`}
                className={`flex h-11 shrink-0 items-center gap-3 rounded-[12px] px-2.5 text-[14px] transition-colors ${
                  ativo ? 'bg-gradient-to-r from-[#dbe7fc] to-[#e9f1fe] font-bold text-navy' : 'font-medium text-[#3d5170] hover:bg-hover hover:text-ink'
                }`}
              >
                <span className={`inline-flex size-[28px] items-center justify-center rounded-[8px] ${ativo ? 'grad-navy text-white' : 'text-[#2f4a72]'}`}>
                  <s.icone size={ativo ? 16 : 19} strokeWidth={ativo ? 2.2 : 1.8} aria-hidden />
                </span>
                {s.rotulo}
              </NavLink>
            )
          })}
        </nav>
        <div key={secao} className="anim-aparecer min-w-0">
          <Conteudo />
        </div>
      </div>
    </>
  )
}
