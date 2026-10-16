import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

/** Convite para sair da demonstração e configurar o próprio negócio (configuração inicial). */
export function CartaoComecar() {
  return (
    <Link
      to="/comecar"
      className="card reflexo group flex items-center gap-4 p-4 md:p-5 !border-[#cfe0fc] !bg-gradient-to-br !from-[#eaf2ff] !to-[#f6f9ff] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
    >
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full grad-primario text-white">
        <Sparkles size={21} strokeWidth={2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-ink">Usar com o meu negócio</span>
        <span className="block text-[13px] leading-snug text-ink-2">Em 2 minutos, troque os dados de exemplo pelos seus.</span>
      </span>
      <ArrowRight size={19} className="shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}
