import { Bell, Building2, CreditCard, Landmark, RotateCcw, Sparkles, Tags, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { NOMES_GRUPO } from '../data/categorias'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/ui/Badge'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card, CardTitulo } from '../components/ui/Card'
import { Input, Select, Toggle } from '../components/ui/Field'
import { Modal, useToast } from '../components/ui/Modal'
import { saldoPorConta } from '../domain/calc'
import type { Atividade, Categoria } from '../domain/types'
import { useStore } from '../data/store'
import { brl } from '../lib/format'

const SECOES: { id: string; rotulo: string; icone: LucideIcon }[] = [
  { id: 'empresa', rotulo: 'Empresa', icone: Building2 },
  { id: 'categorias', rotulo: 'Categorias', icone: Tags },
  { id: 'contas', rotulo: 'Contas bancárias', icone: Landmark },
  { id: 'notificacoes', rotulo: 'Notificações', icone: Bell },
  { id: 'usuarios', rotulo: 'Usuários', icone: Users },
  { id: 'assinatura', rotulo: 'Assinatura', icone: CreditCard },
]

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

function Empresa() {
  const { dados, atualizarEmpresa } = useStore()
  const toast = useToast()
  const [f, setF] = useState(dados.empresa)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  return (
    <Card>
      <CardTitulo>Dados da empresa</CardTitulo>
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          atualizarEmpresa(f)
          toast('Dados da empresa salvos.')
        }}
      >
        <Input label="Nome do negócio" value={f.nomeFantasia} onChange={(e) => set('nomeFantasia', e.target.value)} required />
        <Input label="Seu nome" value={f.nomeDono} onChange={(e) => set('nomeDono', e.target.value)} required />
        <Select
          label="Tipo de negócio"
          value={f.atividade}
          onChange={(e) => set('atividade', e.target.value as Atividade)}
          opcoes={[
            { valor: 'comercio', rotulo: 'Comércio' },
            { valor: 'servico', rotulo: 'Serviços' },
            { valor: 'industria', rotulo: 'Indústria' },
            { valor: 'misto', rotulo: 'Comércio e serviços' },
          ]}
        />
        <Select
          label="A empresa é MEI?"
          value={f.ehMei ? 'sim' : 'nao'}
          onChange={(e) => set('ehMei', e.target.value === 'sim')}
          opcoes={[
            { valor: 'sim', rotulo: 'Sim, é MEI' },
            { valor: 'nao', rotulo: 'Não' },
          ]}
        />
        <Input label={f.ehMei ? 'CNPJ (MEI)' : 'CNPJ'} value={f.cnpj ?? ''} inputMode="numeric" placeholder="00.000.000/0000-00" onChange={(e) => set('cnpj', e.target.value)} />
        <Input label="Data de abertura" type="date" value={f.dataAbertura} onChange={(e) => set('dataAbertura', e.target.value)} />
        <Select label="Estado" value={f.uf} onChange={(e) => set('uf', e.target.value)} opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))} />
        <Input label="Cidade" value={f.municipio ?? ''} onChange={(e) => set('municipio', e.target.value)} />
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit">Salvar alterações</Button>
        </div>
      </form>
    </Card>
  )
}

function Categorias() {
  const { dados } = useStore()
  const grupos = Object.keys(NOMES_GRUPO) as Categoria['grupo'][]
  return (
    <Card>
      <CardTitulo>Categorias</CardTitulo>
      <p className="-mt-2 mb-4 text-[13px] text-ink-2">As categorias padrão já cobrem o dia a dia de um pequeno negócio. Criar categorias próprias chega numa próxima versão.</p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {grupos.map((g) => (
          <div key={g}>
            <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">{NOMES_GRUPO[g]}</p>
            <ul className="flex flex-wrap gap-2">
              {dados.categorias
                .filter((c) => c.grupo === g)
                .map((c) => (
                  <li key={c.id}>
                    <Badge tom={c.contaNoFaturamento ? 'azul' : 'neutro'}>{c.nome}</Badge>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[12px] text-ink-2">As categorias em azul contam no faturamento do MEI.</p>
    </Card>
  )
}

function Contas() {
  const { dados } = useStore()
  const saldos = saldoPorConta(dados)
  const TIPO = { caixa: 'Dinheiro em espécie', banco: 'Conta bancária', reserva: 'Reserva' }
  return (
    <Card>
      <CardTitulo>Onde o dinheiro está</CardTitulo>
      <ul className="divide-y divide-line">
        {dados.contas.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3.5">
            <div>
              <p className="font-semibold text-ink">{c.nome}</p>
              <p className="text-[12px] text-ink-2">{TIPO[c.tipo]}</p>
            </div>
            <span className="num font-semibold text-ink">{brl(saldos.get(c.id) ?? 0, { centavos: true })}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-ink-2">Pagamentos em dinheiro entram no Caixa; Pix, cartão e boleto entram na Conta PJ.</p>
    </Card>
  )
}

function Notificacoes() {
  const { dados, atualizarPreferencias } = useStore()
  const p = dados.preferencias
  return (
    <Card>
      <CardTitulo>Notificações</CardTitulo>
      <div className="divide-y divide-line">
        <div className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="font-medium text-ink">Avisar sobre contas</p>
            <p className="text-[12px] text-ink-2">Quando lembrar antes do vencimento.</p>
          </div>
          <Select
            aria-label="Antecedência do lembrete"
            className="w-40"
            value={String(p.lembreteDias)}
            onChange={(e) => atualizarPreferencias({ lembreteDias: Number(e.target.value) as 0 | 1 | 3 })}
            opcoes={[
              { valor: '0', rotulo: 'No dia' },
              { valor: '1', rotulo: '1 dia antes' },
              { valor: '3', rotulo: '3 dias antes' },
            ]}
          />
        </div>
        <Toggle checked={p.lembreteEmail} onChange={(v) => atualizarPreferencias({ lembreteEmail: v })} label="Receber avisos por e-mail" descricao="Contas, DAS e limite do MEI." />
        <Toggle checked={p.resumoMensal} onChange={(v) => atualizarPreferencias({ resumoMensal: v })} label="Resumo do mês no dia 1" descricao="Abre o fechamento do mês que terminou." />
      </div>
      <p className="mt-3 text-[12px] text-ink-2">Avisos pelo WhatsApp chegam numa próxima versão.</p>
    </Card>
  )
}

function Usuarios() {
  const { dados } = useStore()
  return (
    <Card>
      <CardTitulo>Usuários</CardTitulo>
      <div className="flex items-center gap-3 rounded-[12px] border border-line p-3.5">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">{dados.empresa.nomeDono.charAt(0)}</span>
        <div className="flex-1">
          <p className="font-semibold text-ink">{dados.empresa.nomeDono}</p>
          <p className="text-[12px] text-ink-2">Dona do negócio</p>
        </div>
        <Badge tom="azul">Acesso total</Badge>
      </div>
      <p className="mt-4 text-[13px] text-ink-2">Convidar o contador (só leitura) e outras pessoas chega numa próxima versão.</p>
    </Card>
  )
}

function Assinatura() {
  const { restaurarDemo, modo } = useStore()
  const toast = useToast()
  const [confirmar, setConfirmar] = useState(false)
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <Card>
        <CardTitulo>Assinatura</CardTitulo>
        <div className="rounded-[14px] border border-[#d6e4fb] bg-[#f4f8ff] p-5">
          <p className="text-[13px] font-semibold text-primary">Plano Essencial</p>
          <p className="num mt-1 text-[28px] font-bold text-ink">
            R$ 25<span className="text-[14px] font-medium text-ink-2"> por mês</span>
          </p>
          <p className="mt-2 text-[13px] text-ink-2">Entradas e saídas, contas a pagar e receber, Meu MEI e relatórios. Sem fidelidade.</p>
        </div>
      </Card>
      {modo === 'demo' && (
        <Card>
          <CardTitulo>Demonstração</CardTitulo>
          <p className="mb-4 text-[13px] text-ink-2">
            Você está vendo os dados de exemplo da Doces da Ana. Para usar com o seu negócio, faça a configuração inicial. Para começar a apresentação do zero, restaure os
            dados originais.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <ButtonLink to="/comecar" icone={<Sparkles size={16} />}>
              Usar com o meu negócio
            </ButtonLink>
            <Button variante="secundario" icone={<RotateCcw size={16} />} onClick={() => setConfirmar(true)}>
              Restaurar dados de exemplo
            </Button>
          </div>
        </Card>
      )}
      {modo === 'real' && (
        <Card>
          <CardTitulo>Seus dados</CardTitulo>
          <p className="mb-4 text-[13px] text-ink-2">
            Por enquanto os dados ficam guardados neste navegador. Voltar para a demonstração apaga os lançamentos do seu negócio.
          </p>
          <Button variante="secundario" icone={<RotateCcw size={16} />} onClick={() => setConfirmar(true)}>
            Voltar para a demonstração
          </Button>
        </Card>
      )}
      <Modal
        aberto={confirmar}
        onFechar={() => setConfirmar(false)}
        titulo={modo === 'demo' ? 'Restaurar dados de exemplo?' : 'Voltar para a demonstração?'}
        rodape={
          <>
            <Button variante="secundario" onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                restaurarDemo()
                setConfirmar(false)
                toast('Dados de exemplo restaurados.')
              }}
            >
              Restaurar
            </Button>
          </>
        }
      >
        <p>
          {modo === 'demo'
            ? 'Tudo o que foi lançado na demonstração será apagado e os números voltam aos originais.'
            : 'Os lançamentos e a configuração do seu negócio serão apagados deste navegador, e a Doces da Ana volta a aparecer.'}
        </p>
      </Modal>
    </div>
  )
}

const CONTEUDO: Record<string, () => React.JSX.Element> = { empresa: Empresa, categorias: Categorias, contas: Contas, notificacoes: Notificacoes, usuarios: Usuarios, assinatura: Assinatura }

export function Settings() {
  const { secao = 'empresa' } = useParams()
  const Conteudo = CONTEUDO[secao] ?? Empresa
  return (
    <>
      <Header titulo="Configurações" />
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-[240px_1fr] lg:items-start">
        <nav
          aria-label="Configurações"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:card lg:mx-0 lg:flex-col lg:overflow-visible lg:p-2.5"
        >
          {SECOES.map((s) => {
            const ativo = secao === s.id
            return (
              <NavLink
                key={s.id}
                to={`/configuracoes/${s.id}`}
                className={`flex h-11 shrink-0 items-center gap-3 rounded-[12px] px-2.5 text-[14px] transition-colors ${
                  ativo ? 'bg-gradient-to-r from-[#dbe7fc] to-[#e9f1fe] font-bold text-navy' : 'font-medium text-[#3d5170] hover:bg-hover hover:text-ink'
                }`}
              >
                <span className={`inline-flex size-[28px] items-center justify-center rounded-[8px] ${ativo ? 'grad-navy text-white' : 'text-[#2f4a72]'}`}>
                  <s.icone size={ativo ? 16 : 19} strokeWidth={ativo ? 2.2 : 1.8} aria-hidden />
                </span>
                {s.rotulo}
              </NavLink>
            )
          })}
        </nav>
        <div key={secao} className="anim-aparecer min-w-0">
          <Conteudo />
        </div>
      </div>
    </>
  )
}
