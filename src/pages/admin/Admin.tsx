// Painel de superadmin: mensalidades, assinantes e contatos, planos com módulos e IA, textos e
// imagens do site e o funcionamento geral do sistema.
import { CreditCard, FileClock, Globe, LayoutDashboard, Settings2, ShieldAlert, Users } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Card, EstadoVazio } from '../../components/ui/Card'
import { Segmentado } from '../../components/ui/Tabs'
import { criarFonteDemo, fonteServidor, type FonteAdmin } from '../../data/admin'
import { useStore } from '../../data/store'
import type { DataISO } from '../../domain/types'
import { hojeReal } from '../../lib/format'
import { AbaAssinantes, FichaAssinante } from './Assinantes'
import { AbaConfig, AbaRegistro } from './Config'
import { AbaPlanos } from './Planos'
import { AbaResumo } from './Resumo'
import { AbaSite } from './Site'
import { useCarregar } from './comum'

type Aba = 'resumo' | 'assinantes' | 'planos' | 'site' | 'config' | 'registro'

const ABAS: { valor: Aba; rotulo: string; icone: typeof Users }[] = [
  { valor: 'resumo', rotulo: 'Resumo', icone: LayoutDashboard },
  { valor: 'assinantes', rotulo: 'Assinantes', icone: Users },
  { valor: 'planos', rotulo: 'Planos', icone: CreditCard },
  { valor: 'site', rotulo: 'Site', icone: Globe },
  { valor: 'config', rotulo: 'Sistema', icone: Settings2 },
  { valor: 'registro', rotulo: 'Histórico', icone: FileClock },
]

export function Admin() {
  const { servidor, conta, hoje } = useStore()
  // Na demonstração o painel usa assinantes de exemplo, guardados só na memória.
  const [demo] = useState(() => criarFonteDemo(hoje))
  if (servidor === 'com' && !conta?.admin)
    return (
      <>
        <Header titulo="Superadmin" />
        <Card>
          <EstadoVazio icone={<ShieldAlert size={24} />} titulo="Só o administrador do sistema entra aqui" texto="Esta área gere as assinaturas de todos os clientes do Gynfinance." />
        </Card>
      </>
    )
  // Com servidor, as datas são as de verdade (a conta do admin pode estar na demonstração do app).
  return <Painel fonte={servidor === 'com' ? fonteServidor : demo} hoje={servidor === 'com' ? hojeReal() : hoje} />
}

function Painel({ fonte, hoje }: { fonte: FonteAdmin; hoje: DataISO }) {
  const [params, setParams] = useSearchParams()
  const aba = (ABAS.some((a) => a.valor === params.get('aba')) ? params.get('aba') : 'resumo') as Aba
  const irPara = (a: Aba) => setParams(a === 'resumo' ? {} : { aba: a }, { replace: true })

  const buscarAssinantes = useCallback(() => fonte.assinantes(), [fonte])
  const assinantes = useCarregar(buscarAssinantes)
  const buscarPlanos = useCallback(() => fonte.planos(), [fonte])
  const planos = useCarregar(buscarPlanos)
  const [aberto, setAberto] = useState<string | null>(null)
  const ficha = useMemo(() => assinantes.dados?.find((a) => a.id === aberto) ?? null, [assinantes.dados, aberto])
  const recarregarTudo = useCallback(async () => {
    await Promise.all([assinantes.recarregar(), planos.recarregar()])
  }, [assinantes, planos])

  return (
    <>
      <Header
        titulo="Superadmin"
        subtitulo={fonte.demonstracao ? 'Demonstração com assinantes de exemplo. Nada aqui é gravado.' : 'Assinaturas, planos, site e funcionamento do Gynfinance.'}
      />
      <div className="relative -mx-4 mb-5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" data-entrar>
        <Segmentado
          rotulo="Áreas do painel"
          rolar
          valor={aba}
          onChange={irPara}
          opcoes={ABAS.map((a) => ({ valor: a.valor, rotulo: a.rotulo, icone: <a.icone size={15} aria-hidden /> }))}
        />
      </div>
      {(assinantes.erro || planos.erro) && <p className="mb-4 rounded-[12px] bg-danger-soft px-4 py-3 text-[14px] text-danger">{assinantes.erro ?? planos.erro}</p>}

      {aba === 'resumo' && <AbaResumo fonte={fonte} assinantes={assinantes.dados} hoje={hoje} onAbrir={setAberto} onIrPara={irPara} />}
      {aba === 'assinantes' && <AbaAssinantes assinantes={assinantes.dados} planos={planos.dados ?? []} hoje={hoje} onAbrir={setAberto} />}
      {aba === 'planos' && <AbaPlanos fonte={fonte} planos={planos.dados} onMudou={recarregarTudo} />}
      {aba === 'site' && <AbaSite fonte={fonte} />}
      {aba === 'config' && <AbaConfig fonte={fonte} planos={planos.dados ?? []} />}
      {aba === 'registro' && <AbaRegistro fonte={fonte} />}

      <FichaAssinante fonte={fonte} assinante={ficha} planos={planos.dados ?? []} hoje={hoje} onFechar={() => setAberto(null)} onMudou={recarregarTudo} />
    </>
  )
}
