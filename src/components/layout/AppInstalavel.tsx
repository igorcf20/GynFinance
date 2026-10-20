import { Download, RefreshCw, Share, SquarePlus, Smartphone, WifiOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useInstalar } from '../../lib/pwa'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { LogoMarca } from './Logo'

/**
 * Versão nova publicada: o app avisa e atualiza com um toque, em vez de ficar na versão antiga
 * guardada no aparelho. Também confere de hora em hora, para quem deixa o app aberto o dia todo.
 */
export function AvisoVersaoNova() {
  const {
    needRefresh: [temNova, setTemNova],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (registro) window.setInterval(() => void registro.update().catch(() => {}), 60 * 60 * 1000)
    },
  })
  const [atualizando, setAtualizando] = useState(false)
  if (!temNova) return null
  return (
    <div
      role="status"
      className="anim-toast fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-md items-center gap-3 rounded-[16px] bg-ink/95 p-3 pl-4 text-white shadow-[var(--shadow-pop)] ring-1 ring-white/10 backdrop-blur md:right-6 md:bottom-6 md:left-auto md:mx-0"
    >
      <RefreshCw size={18} className="shrink-0 text-[#9cc2ff]" aria-hidden />
      <p className="min-w-0 flex-1 text-[14px] leading-snug">
        <span className="font-semibold">Tem versão nova do Gynfinance.</span> Leva um segundo.
      </p>
      <button
        type="button"
        onClick={() => {
          setAtualizando(true)
          // Versão achada na conferência de hora em hora não dispara o recarregar do updateServiceWorker:
          // quando a versão nova assume, recarrega aqui.
          navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload(), { once: true })
          void updateServiceWorker(true)
        }}
        className="inline-flex h-9 shrink-0 items-center rounded-[11px] bg-white/12 px-3 text-[13px] font-semibold text-[#9cc2ff] transition-colors hover:bg-white/20"
      >
        {atualizando ? 'Atualizando…' : 'Atualizar'}
      </button>
      <button type="button" onClick={() => setTemNova(false)} aria-label="Depois" className="-ml-1 rounded-lg p-1 text-white/60 hover:text-white">
        <X size={16} />
      </button>
    </div>
  )
}

/** Convite para instalar o Gynfinance na tela inicial (some quando já está instalado). */
export function CartaoInstalar() {
  const { forma, instalar } = useInstalar()
  const [comoNoIphone, setComoNoIphone] = useState(false)
  if (!forma) return null
  return (
    <>
      <button
        type="button"
        onClick={() => (forma === 'botao' ? void instalar() : setComoNoIphone(true))}
        className="card group flex w-full items-center gap-4 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
      >
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Smartphone size={21} strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-ink">Instalar o app</span>
          <span className="block text-[13px] leading-snug text-ink-2">O Gynfinance na tela inicial, abrindo como app, mesmo com a internet fraca.</span>
        </span>
        <Download size={19} className="shrink-0 text-primary" aria-hidden />
      </button>
      <Modal aberto={comoNoIphone} onFechar={() => setComoNoIphone(false)} titulo="Instalar no iPhone">
        <ol className="flex flex-col gap-4 text-[14px]">
          <li className="flex items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Share size={18} aria-hidden />
            </span>
            <span>
              No Safari, toque em <b>Compartilhar</b>, o quadrado com a seta para cima.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <SquarePlus size={18} aria-hidden />
            </span>
            <span>
              Escolha <b>Adicionar à Tela de Início</b>.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <LogoMarca size={20} />
            </span>
            <span>
              Toque em <b>Adicionar</b>. O ícone do Gynfinance aparece junto com os seus apps.
            </span>
          </li>
        </ol>
      </Modal>
    </>
  )
}

/**
 * Sem internet ao abrir: a conta e os dados ficam no servidor, então o app explica e tenta de novo
 * sozinho quando a conexão volta, em vez de mostrar a demonstração no lugar do negócio da pessoa.
 */
export function TelaSemInternet({ onTentar }: { onTentar: () => void }) {
  const [tentando, setTentando] = useState(false)
  useEffect(() => {
    window.addEventListener('online', onTentar)
    return () => window.removeEventListener('online', onTentar)
  }, [onTentar])
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center">
      <div className="anim-entrar card flex w-full max-w-sm flex-col items-center p-7">
        <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-gradient-to-b from-[#fff4e6] to-[#ffe4c4] text-[#e8640c]">
          <WifiOff size={24} aria-hidden />
        </span>
        <h1 className="text-[19px] font-bold text-ink">Sem internet agora</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
          Os dados do seu negócio ficam guardados com segurança no servidor. Assim que a conexão voltar, o Gynfinance abre sozinho.
        </p>
        <Button
          className="mt-5 w-full"
          carregando={tentando}
          icone={<RefreshCw size={16} aria-hidden />}
          onClick={() => {
            setTentando(true)
            onTentar()
            window.setTimeout(() => setTentando(false), 1500)
          }}
        >
          Tentar de novo
        </Button>
      </div>
    </div>
  )
}
