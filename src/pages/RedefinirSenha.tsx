// Senha nova pelo link do e-mail ("Esqueci minha senha"). O código vem no endereço e vale por 1 hora.
import { Lock, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/layout/Logo'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { useStore } from '../data/store'

export function RedefinirSenha() {
  const { redefinirSenha } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const codigo = params.get('codigo') ?? ''
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    if (senha.length < 8) return setErro('A senha precisa de pelo menos 8 caracteres.')
    if (senha !== confirma) return setErro('As duas senhas não estão iguais.')
    setErro('')
    setEnviando(true)
    try {
      const c = await redefinirSenha(codigo, senha)
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
      </div>
      <main className="anim-entrar mt-8 w-full max-w-[440px] md:mt-14">
        <h1 className="text-center text-[26px] font-bold tracking-[-0.02em] text-ink md:text-[30px]">Crie uma senha nova</h1>
        <p className="mt-1.5 text-center text-[14px] text-ink-2">Depois de salvar, você já entra na sua conta. Os outros aparelhos saem e pedem a senha nova.</p>
        {!codigo ? (
          <div className="card mt-6 flex flex-col gap-4 p-5 text-center md:p-7">
            <p className="text-[14px] text-ink">Este link está incompleto. Abra de novo o link do e-mail ou peça outro.</p>
            <Link to="/entrar" className="text-[13px] font-semibold text-primary">
              Voltar para entrar
            </Link>
          </div>
        ) : (
          <form
            className="card mt-6 flex flex-col gap-4 p-5 md:p-7"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void enviar()
            }}
          >
            <Input label="Senha nova" type="password" autoComplete="new-password" placeholder="Pelo menos 8 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} icone={<Lock size={17} />} />
            <Input label="Repita a senha nova" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} icone={<Lock size={17} />} />
            {erro && (
              <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13px] text-[#9b1c2e]">
                {erro}
                {/venceu|usado/.test(erro) && (
                  <Link to="/entrar" className="mt-1 block font-semibold underline">
                    Pedir outro link
                  </Link>
                )}
              </p>
            )}
            <Button type="submit" tamanho="lg" carregando={enviando} className="mt-1 w-full">
              Salvar e entrar
            </Button>
          </form>
        )}
        <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-ink-2">
          <ShieldCheck size={15} className="text-success" aria-hidden /> A senha é guardada de forma cifrada.
        </p>
      </main>
    </div>
  )
}
