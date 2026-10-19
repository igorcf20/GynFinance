import { FileClock, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardTitulo, EstadoVazio, Skeleton } from '../../components/ui/Card'
import { Input, Select, Toggle } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Modal'
import type { ConfigIa, ConfigSistema, FonteAdmin, PlanoAdmin } from '../../data/admin'
import { Texto, useCarregar } from './comum'

export function AbaConfig({ fonte, planos }: { fonte: FonteAdmin; planos: PlanoAdmin[] }) {
  const toast = useToast()
  const buscar = useCallback(() => fonte.config(), [fonte])
  const { dados } = useCarregar(buscar)
  const [c, setC] = useState<ConfigSistema | null>(null)
  const [salvando, setSalvando] = useState(false)
  useEffect(() => setC(dados), [dados])
  if (!c) return <Skeleton className="h-80" />
  const muda = <K extends keyof ConfigSistema>(k: K, v: ConfigSistema[K]) => setC({ ...c, [k]: v })
  const salvar = async () => {
    setSalvando(true)
    try {
      await fonte.salvarConfig({ ...c, aviso: c.aviso.trim() })
      toast('Configurações salvas.')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2">
      <Card>
        <CardTitulo>Cadastro de clientes</CardTitulo>
        <div className="divide-y divide-line">
          <Toggle checked={c.cadastroAberto} onChange={(v) => muda('cadastroAberto', v)} label="Aceitar novos cadastros" descricao="Desligado, o site troca &quot;Criar minha conta&quot; por &quot;Quero ser avisado&quot;, que abre o WhatsApp para entrar na lista de espera." />
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <Input label="Dias de teste grátis" type="number" min={0} max={365} value={c.diasTeste} onChange={(e) => muda('diasTeste', Math.max(0, Math.min(365, Number(e.target.value) || 0)))} />
            <Select label="Plano de quem se cadastra" value={c.planoPadrao} onChange={(e) => muda('planoPadrao', e.target.value)} opcoes={planos.map((p) => ({ valor: p.id, rotulo: p.nome }))} />
          </div>
        </div>
      </Card>
      <Card>
        <CardTitulo>Funcionamento</CardTitulo>
        <div className="divide-y divide-line">
          <Toggle
            checked={c.iaLigada}
            onChange={(v) => muda('iaLigada', v)}
            label="Assistente ligado"
            descricao="Chave geral do assistente (inteligência artificial): ligado, os clientes dos planos com IA veem o Assistente no menu. Configure a chave do serviço logo abaixo."
          />
          <Toggle
            checked={c.manutencao}
            onChange={(v) => muda('manutencao', v)}
            label="Modo manutenção"
            descricao="Os clientes continuam vendo os dados, mas nada é gravado enquanto estiver ligado. Use durante atualizações grandes."
          />
          <div className="py-4">
            <Texto label="Aviso para todos os clientes" rows={2} maxLength={300} value={c.aviso} onChange={(e) => muda('aviso', e.target.value)} placeholder="Ex.: Novidade: agora dá para importar o extrato do banco!" />
            <p className="mt-1 text-[12px] text-ink-2">Aparece no topo do sistema. Deixe em branco para não mostrar nada.</p>
          </div>
        </div>
      </Card>
      <div className="xl:col-span-2">
        <Button onClick={salvar} carregando={salvando}>
          Salvar configurações
        </Button>
      </div>
      <div className="xl:col-span-2">
        <CartaoAssistente fonte={fonte} />
      </div>
    </div>
  )
}

const dolar = (micro: number) => `US$ ${(micro / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Chave do serviço de IA, modelo, limite por cliente e quanto o assistente custou. */
function CartaoAssistente({ fonte }: { fonte: FonteAdmin }) {
  const toast = useToast()
  const buscar = useCallback(() => fonte.ia(), [fonte])
  const { dados, recarregar } = useCarregar(buscar)
  const [ia, setIa] = useState<ConfigIa | null>(null)
  const [chave, setChave] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  useEffect(() => setIa(dados), [dados])
  if (!ia) return <Skeleton className="h-64" />
  const salvar = async (apagar = false) => {
    setSalvando(true)
    try {
      await fonte.salvarIa({ chave: apagar ? null : chave.trim(), modelo: ia.modelo, limiteDia: ia.limiteDia })
      setChave('')
      await recarregar()
      toast(apagar ? 'Chave apagada.' : 'Assistente salvo.')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  const testar = async () => {
    setTestando(true)
    try {
      const r = await fonte.testarIa()
      toast(`A chave funciona. Resposta de teste: "${r}"`, { segundos: 6 })
    } catch (e) {
      toast((e as Error).message, { segundos: 6 })
    } finally {
      setTestando(false)
    }
  }
  const media = ia.uso.mes.pedidos ? ia.uso.mes.custoMicro / ia.uso.mes.pedidos : 0
  const origem = {
    painel: `Chave salva aqui (termina em ${ia.finalChave}).`,
    servidor: `Usando a chave do servidor (termina em ${ia.finalChave}).`,
    nenhuma: 'Nenhuma chave salva: o assistente não funciona até salvar uma.',
  }[ia.origemChave]
  return (
    <Card>
      <CardTitulo>
        <span className="inline-flex items-center gap-2">
          <Sparkles size={18} className="text-primary" aria-hidden /> Assistente
        </span>
      </CardTitulo>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div>
            <Input
              label="Chave do serviço de IA (Anthropic)"
              type="password"
              autoComplete="off"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder={ia.origemChave === 'nenhuma' ? 'Cole aqui a chave que começa com sk-ant-' : 'Cole uma chave nova só se quiser trocar'}
            />
            <p className={`mt-1 text-[12px] ${ia.origemChave === 'nenhuma' ? 'text-warning' : 'text-ink-2'}`}>{origem}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Qualidade da leitura" value={ia.modelo} onChange={(e) => setIa({ ...ia, modelo: e.target.value })} opcoes={ia.modelos.map((m) => ({ valor: m.id, rotulo: m.nome }))} />
            <Input
              label="Pedidos por cliente por dia"
              type="number"
              min={0}
              max={1000}
              value={ia.limiteDia}
              onChange={(e) => setIa({ ...ia, limiteDia: Math.max(0, Math.min(1000, Number(e.target.value) || 0)) })}
            />
          </div>
          <p className="-mt-2 text-[12px] text-ink-2">O limite por dia protege a conta do serviço contra uso exagerado. 0 = sem limite.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void salvar()} carregando={salvando}>
              Salvar assistente
            </Button>
            <Button variante="secundario" onClick={() => void testar()} carregando={testando} disabled={ia.origemChave === 'nenhuma'}>
              Testar a chave
            </Button>
            {ia.origemChave === 'painel' && (
              <Button variante="discreto" onClick={() => void salvar(true)} disabled={salvando}>
                Apagar chave
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 self-start">
          {[
            { rotulo: 'Pedidos hoje', valor: String(ia.uso.hoje.pedidos) },
            { rotulo: 'Pedidos no mês', valor: String(ia.uso.mes.pedidos) },
            { rotulo: 'Custo no mês', valor: dolar(ia.uso.mes.custoMicro) },
            { rotulo: 'Custo médio por pedido', valor: dolar(media) },
            { rotulo: 'Clientes que usaram no mês', valor: String(ia.uso.mes.clientes) },
            { rotulo: 'Fotos lidas no mês', valor: String(ia.uso.mes.fotos) },
          ].map((x) => (
            <div key={x.rotulo} className="rounded-[14px] border border-line p-3">
              <p className="text-[12px] text-ink-2">{x.rotulo}</p>
              <p className="num mt-0.5 text-[18px] font-bold text-ink">{x.valor}</p>
            </div>
          ))}
          <p className="col-span-2 text-[12px] text-ink-2">Custo estimado pelo preço oficial do serviço. A cobrança de verdade aparece no painel da Anthropic.</p>
        </div>
      </div>
    </Card>
  )
}

export function AbaRegistro({ fonte }: { fonte: FonteAdmin }) {
  const buscar = useCallback(() => fonte.registro(), [fonte])
  const { dados } = useCarregar(buscar)
  if (!dados) return <Skeleton className="h-64" />
  return (
    <Card className="!p-0">
      {dados.length === 0 ? (
        <EstadoVazio icone={<FileClock size={24} />} titulo="Nada registrado ainda" texto="Cada mudança feita neste painel fica anotada aqui, com quem fez e quando." />
      ) : (
        <ul className="divide-y divide-line">
          {dados.map((r, i) => (
            <li key={i} className="flex flex-col gap-0.5 px-5 py-3 text-[13px] sm:flex-row sm:items-baseline sm:gap-4">
              <span className="num shrink-0 text-ink-2 sm:w-36">{new Date(r.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span className="min-w-0 flex-1">
                <b className="font-semibold text-ink first-letter:uppercase">{r.acao}</b>
                {r.detalhe && <span className="block truncate text-ink-2">{r.detalhe}</span>}
              </span>
              <span className="shrink-0 text-ink-2">{r.admin}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
