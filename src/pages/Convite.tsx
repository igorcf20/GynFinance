// Link de convite do contador (#/convite?codigo=...): mostra de quem é o convite e abre o negócio.
import { Building2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/layout/Logo'
import { Button } from '../components/ui/Button'
import { api } from '../data/api'
import { CHAVE_CONVITE, guardar, useStore } from '../data/store'

export function Convite() {
  const { conta, servidor, aceitarConvite } = useStore()
  const navigate = useNavigate()
  const codigo = useSearchParams()[0].get('codigo') ?? ''
  const [negocio, setNegocio] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [abrindo, setAbrindo] = useState(false)

  useEffect(() => {
    if (servidor !== 'com') return
    if (!codigo) return setErro('Este link está incompleto. Peça um novo ao seu cliente.')
    api<{ negocio: string }>('GET', `convite/${encodeURIComponent(codigo)}`)
      .then((r) => {
        setNegocio(r.negocio)
        // Guardado para depois de entrar ou criar a conta.
        guardar(CHAVE_CONVITE, codigo)
      })
      .catch((e) => setErro((e as Error).message))
  }, [codigo, servidor])

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pt-5 pb-10 md:pt-8">
      <div className="flex w-full max-w-[1040px] items-center">
        <Logo />
      </div>
      <main className="anim-entrar card mt-10 w-full max-w-[460px] p-6 text-center md:mt-16 md:p-8">
        <span className="grad-primario mx-auto inline-flex size-14 items-center justify-center rounded-full text-white">
          <Building2 size={26} aria-hidden />
        </span>
        {servidor === 'sem' ? (
          <p className="mt-4 text-[15px] text-ink">Convites de contador funcionam na versão instalada do Gynfinance.</p>
        ) : erro ? (
          <>
            <h1 className="mt-4 text-[22px] font-bold text-ink">Convite indisponível</h1>
            <p className="mt-2 text-[14px] text-ink-2">{erro}</p>
          </>
        ) : !negocio ? (
          <p className="mt-4 text-[14px] text-ink-2" aria-busy="true">
            Conferindo o convite...
          </p>
        ) : (
          <>
            <h1 className="mt-4 text-[22px] font-bold text-balance text-ink">Convite para ver {negocio}</h1>
            <p className="mt-2 text-[14px] text-ink-2">Você vai acompanhar lançamentos, contas, relatórios e o MEI deste negócio, só para consulta. O dono pode tirar o acesso quando quiser.</p>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-ink-2">
              <ShieldCheck size={14} aria-hidden /> Você não muda nada nos dados do cliente.
            </p>
            {conta ? (
              <Button
                className="mt-6 w-full"
                tamanho="lg"
                carregando={abrindo}
                onClick={async () => {
                  setAbrindo(true)
                  try {
                    await aceitarConvite(codigo)
                    navigate('/', { replace: true })
                  } catch (e) {
                    setErro((e as Error).message)
                  } finally {
                    setAbrindo(false)
                  }
                }}
              >
                Abrir {negocio}
              </Button>
            ) : (
              <div className="mt-6 flex flex-col gap-2.5">
                <Button tamanho="lg" onClick={() => navigate('/entrar?depois=comecar')}>
                  Criar minha conta
                </Button>
                <Button tamanho="lg" variante="secundario" onClick={() => navigate('/entrar')}>
                  Já tenho conta
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
