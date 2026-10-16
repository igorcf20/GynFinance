// Entrar e criar conta (versão instalada, com servidor). Mesmo visual da configuração inicial.
import { Lock, Mail, ShieldCheck, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/layout/Logo'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Segmentado } from '../components/ui/Tabs'
import { useStore } from '../data/store'

type Aba = 'entrar' | 'criar'

export function Entrar() {
  const { servidor, conta, entrar, criarConta } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [aba, setAba] = useState<Aba>(params.get('depois') === 'comecar' ? 'criar' : 'entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Sem servidor (demonstração publicada) não há conta: segue direto para a configuração no navegador.
  if (servidor === 'sem') return <Navigate to="/comecar" replace />
  if (conta) return <Navigate to={conta.temNegocio ? '/' : '/comecar'} replace />

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
        <h1 className="text-center text-[26px] font-bold tracking-[-0.02em] text-ink md:text-[30px]">{aba === 'entrar' ? 'Bom te ver de novo' : 'Crie sua conta'}</h1>
        <p className="mt-1.5 text-center text-[14px] text-ink-2">
          {aba === 'entrar' ? 'Entre para ver as finanças do seu negócio.' : 'Seus dados ficam guardados e você acessa do celular ou do computador.'}
        </p>

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
        <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-ink-2">
          <ShieldCheck size={15} className="text-success" aria-hidden /> Conexão protegida. A senha é guardada de forma cifrada.
        </p>
      </main>
    </div>
  )
}
