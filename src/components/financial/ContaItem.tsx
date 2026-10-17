import { FileText, Home, Lightbulb, MessageCircle, Package, Receipt, Repeat, SlidersHorizontal, UserRound, Wifi, Zap, type LucideIcon } from 'lucide-react'
import { descricaoConta, grupoPrazo } from '../../domain/calc'
import type { DataISO, Lancamento } from '../../domain/types'
import { brl, dataBR } from '../../lib/format'
import { useState } from 'react'
import { useStore } from '../../data/store'
import { useToast } from '../ui/Modal'
import { RegistrarPagamento } from './RegistrarPagamento'
import type { DetalhesPagamento } from '../../domain/pagamento'
import { Button } from '../ui/Button'
import { IconeBox, type TomIcone } from '../ui/Card'

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
  const { hoje, marcarComoPago, registrarPagamento, dados, recorrenciaDe } = useStore()
  const toast = useToast()
  const varia = !!recorrenciaDe(conta)?.valorVaria
  const [detalhando, setDetalhando] = useState(false)
  const Icone = iconeConta(conta)
  const receber = conta.natureza === 'entrada'
  const prazo = grupoPrazo(conta.dataVencimento!, hoje)
  const atrasada = prazo === 'atrasadas'
  // Cores como na imagem: atrasada em vermelho, a receber em verde, a pagar em laranja.
  const tom: TomIcone = atrasada ? 'vermelho' : receber ? 'verde' : 'laranja'
  const corLinha = atrasada ? 'text-danger' : prazo === 'semana' ? 'text-[#e8640c]' : 'text-ink-2'
  const [saindo, setSaindo] = useState(false)
  // A linha desliza para fora antes de sumir; o aviso traz o Desfazer com a contagem.
  const baixar = (acao: () => () => void, valor: number, texto?: string) => {
    setSaindo(true)
    setTimeout(() => {
      const desfazer = acao()
      setSaindo(false)
      toast(texto ?? (receber ? `Recebimento de ${brl(valor)} registrado.` : `Pagamento de ${brl(valor)} registrado.`), { desfazer })
    }, 300)
  }
  // Conta de valor variável: abre o registro com detalhes para conferir o valor real.
  const aoTocar = () => (varia ? setDetalhando(true) : baixar(() => marcarComoPago(conta.id), conta.valor))
  const comDetalhes = (d: DetalhesPagamento) => {
    setDetalhando(false)
    const valor = d.modo === 'parcelado' ? 0 : d.valorPago
    const texto =
      d.modo === 'parcial'
        ? `${brl(d.valorPago)} ${receber ? 'recebidos' : 'pagos'}. O resto ficou para ${dataBR(d.restanteVence!)}.`
        : d.modo === 'parcelado'
          ? `Dividido em ${d.parcelas} parcelas.`
          : undefined
    baixar(() => registrarPagamento(conta.id, d), valor, texto)
  }
  const nome = receber ? conta.contraparte || conta.descricao : conta.descricao || conta.contraparte

  return (
    // Mede a largura da própria lista (e não da tela): a mesma linha serve no celular e na coluna estreita do painel.
    <li className={`group @container ${compacto ? 'py-3.5' : 'py-4'} ${saindo ? 'anim-sair' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 @md:flex-nowrap @lg:gap-4">
        <IconeBox tom={tom} className="transition-transform duration-300 group-hover:scale-105">
          <Icone size={20} strokeWidth={2} aria-hidden />
        </IconeBox>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[15px] font-bold text-ink">
            {nome}
            {conta.recorrenciaId && <Repeat size={13} strokeWidth={2.2} className="shrink-0 text-slate" aria-label="Repete todo mês" />}
          </p>
          <p className={`truncate text-[13px] font-medium ${corLinha}`}>{descricaoConta(conta, hoje)}</p>
        </div>
        <span className="num shrink-0 text-right text-[15px] font-bold text-ink">
          {varia && <span className="block text-[11px] font-medium text-ink-2">cerca de</span>}
          {brl(conta.valor)}
        </span>
        {/* No celular os botões ficam numa linha própria, alinhados ao texto: o nome da conta não some. */}
        <div className="flex shrink-0 basis-full justify-end gap-2 pl-[56px] @md:basis-auto @md:pl-0">
          {mostrarCobrar && receber && (
            <a
              href={linkCobranca(conta, dados.empresa.nomeFantasia)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Cobrar ${conta.contraparte} no WhatsApp`}
              className="hidden h-10 items-center gap-1.5 rounded-[12px] border-[1.5px] border-[#bfe6d1] px-3.5 text-[13px] font-semibold text-success transition-colors hover:bg-success-soft @xs:inline-flex"
            >
              <MessageCircle size={15} aria-hidden />
              Cobrar
            </a>
          )}
          <div className="flex">
            <Button variante="contorno" tamanho="sm" onClick={aoTocar} className="!h-10 min-w-[78px] !rounded-r-none md:min-w-[90px]">
              {receber ? 'Recebi' : 'Paguei'}
            </Button>
            <button
              type="button"
              onClick={() => setDetalhando(true)}
              aria-label={`${receber ? 'Receber' : 'Pagar'} com detalhes: comprovante, parcial ou parcelado`}
              title="Comprovante, parcial ou parcelado"
              className="-ml-[1.5px] inline-flex h-10 w-9 items-center justify-center rounded-r-[12px] border-[1.5px] border-primary-line bg-surface text-primary transition-colors hover:border-primary hover:bg-primary-soft/60"
            >
              <SlidersHorizontal size={15} aria-hidden />
            </button>
          </div>
        </div>
      </div>
      <RegistrarPagamento conta={conta} aberto={detalhando} onFechar={() => setDetalhando(false)} onConfirmar={comDetalhes} />
    </li>
  )
}
