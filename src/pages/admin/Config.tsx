import { FileClock } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardTitulo, EstadoVazio, Skeleton } from '../../components/ui/Card'
import { Input, Select, Toggle } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Modal'
import type { ConfigSistema, FonteAdmin, PlanoAdmin } from '../../data/admin'
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
          <Toggle checked={c.cadastroAberto} onChange={(v) => muda('cadastroAberto', v)} label="Aceitar novos cadastros" descricao="Desligado, o botão Criar conta avisa que os cadastros estão fechados." />
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
            label="Inteligência artificial ligada"
            descricao="Chave geral: só com ela ligada os planos com IA usam os recursos de IA. Ainda não há recursos de IA no sistema."
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
    </div>
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
