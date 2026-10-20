// Entrar e criar conta (versão instalada, com servidor). Mesmo visual da configuração inicial.
import { Lock, Mail, MailCheck, ShieldCheck, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/layout/Logo'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Segmentado } from '../components/ui/Tabs'
import { api } from '../data/api'
import { CHAVE_CONVITE, CHAVE_INDICACAO, guardar, lerGuardado, useStore } from '../data/store'

type Aba = 'entrar' | 'criar'

/** Pede o link de senha nova. A resposta é a mesma exista ou não a conta. */
function EsqueciSenha({ emailInicial, onVoltar }: { emailInicial: string; onVoltar: () => void }) {
  const [email, setEmail] = useState(emailInicial)
  const [enviado, setEnviado] = useState<null | { emailLigado: boolean }>(null)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  if (enviado)
    return (
      <div className="card mt-6 flex flex-col gap-4 p-5 text-center md:p-7">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
          <MailCheck size={26} aria-hidden />
        </span>
        <p className="text-[15px] text-ink">
          {enviado.emailLigado ? (
            <>
              Se houver uma conta com <b>{email.trim()}</b>, o link para criar a senha nova chega em alguns minutos. Confira também a caixa de spam.
            </>
          ) : (
            'O envio de e-mails ainda não está ligado neste sistema. Fale com o suporte pelo WhatsApp para recuperar o acesso.'
          )}
        </p>
        <Button variante="secundario" onClick={onVoltar}>
          Voltar para entrar
        </Button>
      </div>
    )
  return (
    <form
      className="card mt-6 flex flex-col gap-4 p-5 md:p-7"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro('Digite o e-mail da sua conta.')
        setEnviando(true)
        setErro('')
        try {
          setEnviado(
            await api<{ emailLigado: boolean }>('POST', 'conta/esqueci', {
              email: email.trim(),
            }),
          )
        } catch (err) {
          setErro((err as Error).message)
        } finally {
          setEnviando(false)
        }
      }}
    >
      <p className="text-[14px] text-ink-2">Digite o e-mail da sua conta. Mandamos um link para você criar uma senha nova.</p>
      <Input label="E-mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} icone={<Mail size={17} />} />
      {erro && (
        <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13px] text-[#9b1c2e]">
          {erro}
        </p>
      )}
      <Button type="submit" tamanho="lg" carregando={enviando} className="w-full">
        Enviar o link
      </Button>
      <button type="button" onClick={onVoltar} className="text-[13px] font-semibold text-primary">
        Lembrei a senha
      </button>
    </form>
  )
}

export function Entrar() {
  const { servidor, conta, entrar, criarConta, aceitarConvite } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Link de quem indicou também pode chegar direto no sistema (/app/#/entrar?indicacao=...).
  const indicacao = params.get('indicacao')
  if (indicacao && /^[0-9a-z]{4,40}$/i.test(indicacao) && lerGuardado(CHAVE_INDICACAO) !== indicacao) guardar(CHAVE_INDICACAO, indicacao)
  const convidado = !!lerGuardado(CHAVE_CONVITE)
  const [aba, setAba] = useState<Aba>(params.get('depois') === 'comecar' ? 'criar' : 'entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [esqueci, setEsqueci] = useState(false)

  // Sem servidor (demonstração publicada) não há conta: segue direto para a configuração no navegador.
  if (servidor === 'sem') return <Navigate to="/comecar" replace />
  // Durante o envio quem decide a próxima tela é enviar() (o convite do contador vem antes).
  if (conta && !enviando) return <Navigate to={conta.temNegocio ? '/' : '/comecar'} replace />

  async function enviar() {
    setErro('')
    if (aba === 'criar') {
      if (!nome.trim()) return setErro('Diga como podemos te chamar.')
      if (senha.length < 8) return setErro('A senha precisa de pelo menos 8 caracteres.')
      if (!aceite) return setErro('Para criar a conta, aceite os termos de uso e o tratamento dos dados.')
    }
    setEnviando(true)
    try {
      const c = aba === 'entrar' ? await entrar(email, senha) : await criarConta(nome, email, senha)
      // Veio pelo convite de um cliente: já abre o negócio dele.
      if (convidado) {
        const aceito = await aceitarConvite().catch(() => false)
        if (aceito) return navigate('/', { replace: true })
        guardar(CHAVE_CONVITE, undefined)
      }
      navigate(c.temNegocio ? '/' : '/comecar', { replace: true })
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pt-5 pb-10 md:pt-8">
      <div className="flex w-full max-w-[1040px] items-center justify-between gap-4">
        <Logo />
        <Link to="/" className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-white hover:text-ink">
          <X size={16} aria-hidden /> Ver a demonstração
        </Link>
      </div>

      <main className="anim-entrar mt-8 w-full max-w-[440px] md:mt-14">
        <h1 className="text-center text-[26px] font-bold tracking-[-0.02em] text-ink md:text-[30px]">
          {esqueci ? 'Esqueceu a senha?' : aba === 'entrar' ? 'Bom te ver de novo' : 'Crie sua conta'}
        </h1>
        <p className="mt-1.5 text-center text-[14px] text-ink-2">
          {esqueci
            ? 'Acontece. Em dois passos você volta a entrar.'
            : aba === 'entrar'
              ? 'Entre para ver as finanças do seu negócio.'
              : 'Seus dados ficam guardados e você acessa do celular ou do computador.'}
        </p>
        {convidado && !esqueci && (
          <p className="mt-4 rounded-[14px] border border-primary-line bg-primary-soft/60 px-4 py-3 text-center text-[13px] text-ink">
            Você foi convidado para ver o financeiro de um cliente como contador. Entre ou crie a sua conta para abrir.
          </p>
        )}

        {esqueci ? (
          <EsqueciSenha emailInicial={email} onVoltar={() => setEsqueci(false)} />
        ) : (
          <form
            className="card mt-6 flex flex-col gap-4 p-5 md:p-7"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void enviar()
            }}
          >
            <Segmentado
              rotulo="Entrar ou criar conta"
              valor={aba}
              onChange={(v) => {
                setAba(v)
                setErro('')
              }}
              opcoes={[
                { valor: 'entrar', rotulo: 'Entrar' },
                { valor: 'criar', rotulo: 'Criar conta' },
              ]}
              className="flex w-full"
            />
            {aba === 'criar' && <Input label="Seu nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} icone={<UserRound size={17} />} />}
            <Input label="E-mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} icone={<Mail size={17} />} />
            <Input
              label="Senha"
              type="password"
              autoComplete={aba === 'entrar' ? 'current-password' : 'new-password'}
              placeholder={aba === 'criar' ? 'Pelo menos 8 caracteres' : undefined}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              icone={<Lock size={17} />}
            />
            {aba === 'entrar' && (
              <button type="button" onClick={() => setEsqueci(true)} className="-mt-2 self-end text-[13px] font-semibold text-primary hover:underline">
                Esqueci minha senha
              </button>
            )}
            {aba === 'criar' && (
              <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-ink-2">
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[#3478f6]" />
                Aceito os termos de uso e o tratamento dos meus dados para o funcionamento do Gynfinance, conforme a LGPD.
              </label>
            )}
            {erro && (
              <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13px] text-[#9b1c2e]">
                {erro}
              </p>
            )}
            <Button type="submit" tamanho="lg" carregando={enviando} className="mt-1 w-full">
              {aba === 'entrar' ? 'Entrar' : 'Criar conta e continuar'}
            </Button>
          </form>
        )}
        <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-ink-2">
          <ShieldCheck size={15} className="text-success" aria-hidden /> Conexão protegida. A senha é guardada de forma cifrada.
        </p>
      </main>
    </div>
  )
}
