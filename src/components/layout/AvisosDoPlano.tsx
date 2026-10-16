import { Lock, Megaphone, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../../data/store'
import { temModulo, type IdModulo, MODULOS } from '../../domain/planos'
import { dataBR, diasEntre } from '../../lib/format'
import { Aviso } from '../financial/Aviso'
import { Card, EstadoVazio } from '../ui/Card'

/**
 * Faixas no topo do sistema que vêm do painel de superadmin: aviso geral, manutenção e a situação
 * da assinatura (teste acabando, mensalidade atrasada, conta suspensa).
 */
export function AvisosDoPlano() {
  const { conta, servidor, bloqueio, hoje } = useStore()
  if (servidor !== 'com' || !conta) return null
  const a = conta.assinatura
  const s = conta.sistema
  const itens: ReactNode[] = []
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
  else if (bloqueio && !s?.manutencao) itens.push(<Aviso key="bloqueio" nivel="perigo" icone={Lock}>{bloqueio}</Aviso>)
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
  if (!itens.length) return null
  return <div className="mb-4 flex flex-col gap-2.5">{itens}</div>
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
