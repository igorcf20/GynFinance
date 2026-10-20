import { AlertTriangle, CalendarCheck, ChevronRight, FileText, HandCoins, Info, X, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Nivel = 'perigo' | 'atencao' | 'info'

const ESTILO: Record<Nivel, { caixa: string; icone: string; botao: string; texto: string }> = {
  atencao: {
    caixa: 'border-[#fde2c8] bg-gradient-to-r from-[#fff0e1] to-[#fff7ef]',
    icone: 'bg-gradient-to-b from-[#fff7ef] to-[#ffe2c7] text-[#e8640c]',
    botao: 'bg-[#ffe3c8] text-[#9a4a0b] hover:bg-[#ffd8b3]',
    texto: 'text-[#5c2c06]',
  },
  perigo: {
    caixa: 'border-[#f9d0d7] bg-gradient-to-r from-[#ffecef] to-[#fff6f7]',
    icone: 'bg-gradient-to-b from-[#fff4f6] to-[#fdd9df] text-danger',
    botao: 'bg-[#fdd9df] text-[#9b1c2e] hover:bg-[#fbc9d1]',
    texto: 'text-[#5e1220]',
  },
  info: {
    caixa: 'border-[#d6e4fc] bg-gradient-to-r from-[#e6effe] to-[#f3f7ff]',
    icone: 'bg-gradient-to-b from-[#f3f7ff] to-[#d9e7fd] text-primary',
    botao: 'bg-[#d9e7fd] text-navy hover:bg-[#cadcfb]',
    texto: 'text-ink',
  },
}

/** Faixa de aviso colorida (DAS vencendo, vendas sem nota), como na imagem de referência. */
export function Aviso({
  nivel,
  children,
  icone,
  acao,
  para,
  onDispensar,
}: {
  nivel: Nivel
  children: ReactNode
  icone?: LucideIcon
  /** Botão à direita (ex.: "Ver"). Sem ele, a faixa inteira vira link com seta. */
  acao?: { rotulo: string; para: string }
  para?: string
  /** Mostra o X; o aviso sai deslizando e só então é dispensado. */
  onDispensar?: () => void
}) {
  const e = ESTILO[nivel]
  const [saindo, setSaindo] = useState(false)
  const Icone = icone ?? (nivel === 'info' ? Info : AlertTriangle)
  const conteudo = (
    <>
      <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full ring-1 ring-white/80 ${e.icone}`}>
        <Icone size={20} strokeWidth={2} aria-hidden />
      </span>
      <p className={`flex-1 text-[14px] font-medium ${e.texto}`}>{children}</p>
      {acao && (
        <Link to={acao.para} className={`rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-colors ${e.botao}`}>
          {acao.rotulo}
        </Link>
      )}
      {!acao && para && <ChevronRight size={18} className={e.texto} aria-hidden />}
      {onDispensar && (
        <button
          type="button"
          aria-label="Dispensar aviso"
          title="Dispensar"
          onClick={(ev) => {
            ev.preventDefault()
            setSaindo(true)
            window.setTimeout(onDispensar, 300)
          }}
          className={`-mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full opacity-60 transition-all hover:bg-white/70 hover:opacity-100 ${e.texto}`}
        >
          <X size={16} strokeWidth={2.2} aria-hidden />
        </button>
      )}
    </>
  )
  const classe = `flex items-center gap-3.5 rounded-[18px] border px-4 py-3.5 shadow-[0_10px_28px_-18px_rgba(194,97,12,0.45)] md:px-5 ${e.caixa} ${saindo ? 'anim-sair' : ''}`
  if (!acao && para)
    return (
      <Link data-entrar to={para} className={`${classe} transition-transform hover:-translate-y-0.5`}>
        {conteudo}
      </Link>
    )
  return (
    <div data-entrar className={classe}>
      {conteudo}
    </div>
  )
}

export function iconeDoAviso(id: string): LucideIcon | undefined {
  if (id.startsWith('das')) return FileText
  if (id.startsWith('fechamento')) return CalendarCheck
  if (id.startsWith('receber')) return HandCoins
  return undefined
}
