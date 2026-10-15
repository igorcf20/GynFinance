import { FileText, Home, Lightbulb, MessageCircle, Package, Receipt, Repeat, UserRound, Wifi, Zap, type LucideIcon } from 'lucide-react'
import { descricaoConta, grupoPrazo } from '../../domain/calc'
import type { DataISO, Lancamento } from '../../domain/types'
import { brl, centavosParaTexto, dataBR, lerValor } from '../../lib/format'
import { useRef, useState } from 'react'
import { useStore } from '../../data/store'
import { Modal, useToast } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

const ICONES: Record<string, LucideIcon> = {
  aluguel: Home,
  internet: Wifi,
  luz: Lightbulb,
  embalagem: Package,
  mercadoria: Package,
  das: Receipt,
  contador: FileText,
  sistema: Zap,
}

export function iconeConta(l: Lancamento): LucideIcon {
  if (l.natureza === 'entrada') return UserRound
  return (l.categoriaId && ICONES[l.categoriaId]) || FileText
}

export function linkCobranca(l: Lancamento, negocio: string): string {
  const texto = `Olá${l.contraparte ? `, ${l.contraparte.split(' ')[0]}` : ''}! Aqui é da ${negocio}. Passando para lembrar do pagamento de ${brl(l.valor, { centavos: true })}${
    l.descricao ? ` (${l.descricao.toLowerCase()})` : ''
  }, com vencimento em ${dataBR(l.dataVencimento!)}. Pode ser por Pix. Obrigado!`
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}

export function estadoConta(l: Lancamento, hoje: DataISO): { tom: 'vermelho' | 'ambar' | 'neutro'; texto: string } {
  const g = grupoPrazo(l.dataVencimento!, hoje)
  if (g === 'atrasadas') return { tom: 'vermelho', texto: 'Atrasada' }
  if (g === 'semana') return { tom: 'ambar', texto: 'Esta semana' }
  return { tom: 'neutro', texto: 'Pendente' }
}

/** Linha de conta a pagar ou a receber, com a ação de baixa. */
export function ContaItem({ conta, compacto, mostrarCobrar }: { conta: Lancamento; compacto?: boolean; mostrarCobrar?: boolean }) {
  const { hoje, marcarComoPago, dados, recorrenciaDe } = useStore()
  const toast = useToast()
  const varia = !!recorrenciaDe(conta)?.valorVaria
  const [confirmando, setConfirmando] = useState(false)
  const [valorTxt, setValorTxt] = useState('')
  const refValor = useRef<HTMLInputElement>(null)
  const Icone = iconeConta(conta)
  const receber = conta.natureza === 'entrada'
  const atrasada = grupoPrazo(conta.dataVencimento!, hoje) === 'atrasadas'
  const estado = estadoConta(conta, hoje)
  const baixar = (valorReal = conta.valor) => {
    marcarComoPago(conta.id, valorReal)
    toast(receber ? `Recebimento de ${brl(valorReal)} registrado.` : `Pagamento de ${brl(valorReal)} registrado.`)
  }
  // Conta de valor variável: confirma o valor real antes de baixar.
  const aoTocar = () => {
    if (!varia) return baixar()
    setValorTxt(centavosParaTexto(conta.valor))
    setConfirmando(true)
    setTimeout(() => refValor.current?.select(), 50)
  }
  const nome = receber ? conta.contraparte || conta.descricao : conta.descricao || conta.contraparte

  return (
    <li className="flex items-center gap-3 py-3.5 md:gap-4">
      <span
        className={`inline-flex size-10 shrink-0 items-center justify-center rounded-[11px] ${
          atrasada ? 'bg-danger-soft text-danger' : 'bg-[#f1f4f8] text-slate'
        }`}
      >
        <Icone size={19} strokeWidth={1.7} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-semibold text-ink">
          {nome}
          {conta.recorrenciaId && <Repeat size={13} className="shrink-0 text-slate" aria-label="Repete todo mês" />}
        </p>
        <p className={`truncate text-[12px] ${atrasada ? 'text-danger' : 'text-ink-2'}`}>{descricaoConta(conta, hoje)}</p>
      </div>
      {!compacto && (
        <span className="hidden md:inline-flex">
          <Badge tom={estado.tom}>{estado.texto}</Badge>
        </span>
      )}
      <span className="num shrink-0 text-right font-semibold text-ink">
        {varia && <span className="block text-[11px] font-normal text-ink-2">cerca de</span>}
        {brl(conta.valor)}
      </span>
      <div className="flex shrink-0 gap-2">
        {mostrarCobrar && receber && (
          <a
            href={linkCobranca(conta, dados.empresa.nomeFantasia)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Cobrar ${conta.contraparte} no WhatsApp`}
            className="hidden h-8 items-center gap-1.5 rounded-[10px] border border-line px-3 text-[13px] font-semibold text-success transition-colors hover:bg-success-soft sm:inline-flex"
          >
            <MessageCircle size={15} aria-hidden />
            Cobrar
          </a>
        )}
        <Button variante="secundario" tamanho="sm" onClick={aoTocar} className="!text-primary">
          {receber ? 'Recebi' : 'Paguei'}
        </Button>
      </div>
      <Modal
        aberto={confirmando}
        onFechar={() => setConfirmando(false)}
        titulo={`Quanto veio ${nome ? `de ${nome.toLowerCase()}` : 'esta conta'}?`}
        rodape={
          <>
            <Button variante="secundario" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const v = lerValor(valorTxt)
                if (v <= 0) return refValor.current?.focus()
                setConfirmando(false)
                baixar(v)
              }}
            >
              {receber ? 'Confirmar recebimento' : 'Confirmar pagamento'}
            </Button>
          </>
        }
      >
        <p className="mb-3">Esta conta muda de valor todo mês. Confira o valor real antes de confirmar.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const v = lerValor(valorTxt)
            if (v > 0) {
              setConfirmando(false)
              baixar(v)
            }
          }}
          className="flex items-baseline gap-2 border-b border-line pb-1 focus-within:border-primary"
        >
          <span className="text-[20px] font-bold text-ink-2">R$</span>
          <input
            id={`valor-real-${conta.id}`}
            ref={refValor}
            aria-label="Valor real"
            inputMode="decimal"
            value={valorTxt}
            onChange={(e) => setValorTxt(e.target.value.replace(/[^\d.,]/g, ''))}
            className="num w-full bg-transparent text-[28px] font-bold text-ink focus:outline-none"
          />
        </form>
      </Modal>
    </li>
  )
}
