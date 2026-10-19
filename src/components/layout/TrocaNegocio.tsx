import { Building2, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../data/store'
import { useToast } from '../ui/Modal'

/** Quem tem mais de um negócio (ou atende como contador) troca por aqui. Some quando só há um. */
export function TrocaNegocio({ className = '' }: { className?: string }) {
  const { conta, trocarNegocio } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [trocando, setTrocando] = useState(false)
  const lista = conta?.negocios ?? []
  if (lista.length < 2 || !conta?.negocio) return null
  const atual = conta.negocio.id
  return (
    <label
      className={`relative flex h-11 items-center gap-2.5 rounded-[12px] border border-[#e3e9f1] bg-surface pr-9 pl-3 text-[13px] font-semibold text-ink shadow-[var(--shadow-card)] transition-all hover:-translate-y-px ${trocando ? 'opacity-60' : ''} ${className}`}
    >
      <Building2 size={17} strokeWidth={1.9} className="shrink-0 text-primary" aria-hidden />
      <span className="sr-only">Negócio aberto</span>
      <span className="min-w-0 flex-1 truncate">{conta.negocio.nome}</span>
      <select
        value={atual}
        disabled={trocando}
        onChange={async (e) => {
          const id = e.target.value
          if (id === atual) return
          setTrocando(true)
          try {
            await trocarNegocio(id)
            navigate('/')
            toast(`Você está em ${lista.find((n) => n.id === id)?.nome ?? 'outro negócio'}.`)
          } catch {
            toast('Não deu para trocar de negócio agora. Tente de novo.')
          } finally {
            setTrocando(false)
          }
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {lista.map((n) => (
          <option key={n.id} value={n.id}>
            {n.nome}
            {n.papel === 'contador' ? ' (como contador)' : ''}
          </option>
        ))}
      </select>
      <ChevronsUpDown size={15} className="absolute right-3 text-slate" aria-hidden />
    </label>
  )
}
