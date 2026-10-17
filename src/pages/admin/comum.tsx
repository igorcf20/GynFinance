// Peças usadas por todas as abas do painel de superadmin.
import { useCallback, useEffect, useId, useState, type TextareaHTMLAttributes } from 'react'
import type { Assinante } from '../../data/admin'
import { vencida } from '../../data/admin'
import { SITUACOES_ASSINATURA, type SituacaoAssinatura } from '../../domain/planos'
import type { DataISO } from '../../domain/types'
import { Badge, type TomBadge } from '../../components/ui/Badge'
import { Label } from '../../components/ui/Field'

export const TOM_SITUACAO: Record<SituacaoAssinatura, TomBadge> = { teste: 'azul', ativa: 'verde', atrasada: 'ambar', suspensa: 'vermelho', cancelada: 'neutro' }

export const rotuloSituacao = (s: SituacaoAssinatura) => SITUACOES_ASSINATURA.find((x) => x.valor === s)!.rotulo

export function SeloSituacao({ a, hoje }: { a: Assinante; hoje: DataISO }) {
  // "Ativa" com o vencimento passado aparece como vencida, para chamar a atenção antes de mudar à mão.
  if (vencida(a, hoje) && a.situacao !== 'atrasada') return <Badge tom="ambar">{a.situacao === 'teste' ? 'Teste acabou' : 'Vencida'}</Badge>
  return <Badge tom={TOM_SITUACAO[a.situacao]}>{rotuloSituacao(a.situacao)}</Badge>
}

export function Texto({ label, className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId()
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={3}
        className="w-full resize-y rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[14px] font-medium text-ink shadow-[0_1px_2px_rgba(16,32,64,0.04)] placeholder:font-normal placeholder:text-muted transition-[border-color,box-shadow] duration-150 hover:border-[#d3dce8] focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/12"
        {...rest}
      />
    </div>
  )
}

/** Carrega uma lista do painel e deixa recarregar depois de uma mudança. */
export function useCarregar<T>(fn: () => Promise<T>) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const recarregar = useCallback(async () => {
    try {
      setDados(await fn())
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [fn])
  useEffect(() => {
    void recarregar()
  }, [recarregar])
  return { dados, erro, recarregar }
}

/** "há 3 dias", "hoje", "ontem". */
export function haQuanto(iso: string | undefined, hoje: DataISO): string {
  if (!iso) return 'nunca'
  const dias = Math.round((Date.parse(hoje) - Date.parse(iso.slice(0, 10))) / 864e5)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 60) return `há ${dias} dias`
  return `há ${Math.round(dias / 30)} meses`
}

export const telefoneLegivel = (t?: string) => {
  const d = (t ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t ?? ''
}
