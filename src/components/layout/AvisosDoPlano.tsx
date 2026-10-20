import { ChevronRight, Eye, LifeBuoy, Lock, Megaphone, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useStore } from '../../data/store'
import { naoLidosDaConta, suporteDemo, useNaoLidosSuporte } from '../../data/suporte'
import { temModulo, type IdModulo, MODULOS } from '../../domain/planos'
import { dataBR, diasEntre } from '../../lib/format'
import { Aviso } from '../financial/Aviso'
import { Card, EstadoVazio } from '../ui/Card'

/**
 * Faixas no topo do sistema que vêm do painel de superadmin: aviso geral, manutenção e a situação
 * da assinatura (teste acabando, mensalidade atrasada, conta suspensa).
 */
export function AvisosDoPlano() {
  const { conta, servidor, bloqueio, hoje, somenteLeitura, dados } = useStore()
  const { pathname } = useLocation()
  if (servidor === 'com') naoLidosDaConta(conta)
  else if (servidor === 'sem') suporteDemo()
  const respostas = useNaoLidosSuporte()
  const suporte =
    respostas > 0 && pathname !== '/suporte' ? (
      <Link
        to="/suporte"
        className="anim-subir group mb-4 flex items-center gap-3 rounded-[16px] border border-[#cfdffc] bg-gradient-to-r from-[#eef4ff] to-[#f7faff] px-4 py-3 text-[14px] text-ink shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:shadow-[var(--shadow-card-hover)]"
      >
        <span className="grad-primario relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white">
          <LifeBuoy size={18} aria-hidden />
          <span className="anim-pulso absolute -top-0.5 -right-0.5 size-3 rounded-full bg-danger ring-2 ring-white" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{respostas === 1 ? 'O suporte respondeu seu chamado.' : `O suporte respondeu ${respostas} chamados seus.`}</span>{' '}
          <span className="text-ink-2">Toque para ler.</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    ) : null
  if (servidor !== 'com' || !conta) return suporte
  const a = conta.assinatura
  const s = conta.sistema
  const itens: ReactNode[] = []
  if (somenteLeitura)
    itens.push(
      <Aviso key="contador" nivel="info" icone={Eye}>
        Você está vendo {dados.empresa.nomeFantasia} como contador: dá para consultar, ver relatórios e exportar, mas não para mudar nada.
      </Aviso>,
    )
  if (s?.aviso) itens.push(<Aviso key="aviso" nivel="info" icone={Megaphone}>{s.aviso}</Aviso>)
  if (s?.manutencao)
    itens.push(
      <Aviso key="manutencao" nivel="atencao" icone={Wrench}>
        O sistema está em manutenção. Você pode consultar tudo, mas o que mudar agora não será gravado.
      </Aviso>,
    )
  if (a?.situacao === 'suspensa' || a?.situacao === 'cancelada')
    itens.push(
      <Aviso key="assinatura" nivel="perigo" icone={Lock}>
        Sua assinatura está {a.situacao}. Você ainda vê e exporta seus dados, mas para gravar fale com a gente e regularize a mensalidade.
      </Aviso>,
    )
  else if (bloqueio && !s?.manutencao && !somenteLeitura) itens.push(<Aviso key="bloqueio" nivel="perigo" icone={Lock}>{bloqueio}</Aviso>)
  else if (a?.situacao === 'atrasada')
    itens.push(
      <Aviso key="assinatura" nivel="atencao">
        Sua mensalidade está em atraso{a.proximoVencimento ? ` desde ${dataBR(a.proximoVencimento)}` : ''}. Regularize para não ter o acesso suspenso.
      </Aviso>,
    )
  else if (a?.situacao === 'teste' && a.proximoVencimento) {
    const dias = diasEntre(hoje, a.proximoVencimento)
    if (dias <= 5)
      itens.push(
        <Aviso key="assinatura" nivel="info">
          {dias > 1 ? `Seu período de teste termina em ${dias} dias.` : dias === 1 ? 'Seu período de teste termina amanhã.' : dias === 0 ? 'Seu período de teste termina hoje.' : 'Seu período de teste terminou.'} Para continuar, fale com a gente e escolha o plano.
        </Aviso>,
      )
  }
  if (!itens.length) return suporte
  return (
    <>
      {suporte}
      <div className="mb-4 flex flex-col gap-2.5">{itens}</div>
    </>
  )
}

/** Tela de um módulo que o plano do cliente não inclui. */
export function SoNoPlano({ modulo, children }: { modulo: IdModulo; children: ReactNode }) {
  const { modulos, conta } = useStore()
  if (temModulo(modulos, modulo)) return <>{children}</>
  const nome = MODULOS.find((m) => m.id === modulo)?.nome ?? 'Este recurso'
  return (
    <Card>
      <EstadoVazio
        icone={<Lock size={24} />}
        titulo={`${nome} não faz parte do seu plano`}
        texto={`Seu plano atual é o ${conta?.assinatura?.planoNome ?? 'básico'}. Fale com a gente para mudar de plano e liberar este recurso.`}
      />
    </Card>
  )
}
