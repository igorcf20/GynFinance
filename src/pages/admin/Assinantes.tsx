import { Building2, Copy, Download, Mail, MessageCircle, Phone, Search, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { linkWhatsapp } from '../../components/agenda/visual'
import { Button } from '../../components/ui/Button'
import { Card, EstadoVazio, Skeleton } from '../../components/ui/Card'
import { Input, Label, Select, Toggle } from '../../components/ui/Field'
import { Modal, useToast } from '../../components/ui/Modal'
import { Chips } from '../../components/ui/Tabs'
import { FORMAS_MENSALIDADE, maisUmMes, mensalidadeDe, vencida, type Assinante, type FonteAdmin, type FormaMensalidade, type PagamentoMensalidade, type PlanoAdmin } from '../../data/admin'
import { SITUACOES_ASSINATURA, type SituacaoAssinatura } from '../../domain/planos'
import type { DataISO } from '../../domain/types'
import { addMeses, brl, centavosParaTexto, dataBR, lerValor, mesAno } from '../../lib/format'
import { mensagemCobranca } from './Resumo'
import { haQuanto, SeloSituacao, telefoneLegivel, Texto } from './comum'

type Filtro = 'todos' | SituacaoAssinatura | 'vencidos'

const ATIVIDADES: Record<string, string> = { servico: 'Serviços', comercio: 'Comércio', industria: 'Indústria', misto: 'Comércio e serviços' }

function baixarContatos(lista: Assinante[]) {
  const cel = (v: string) => `"${v.replace(/"/g, '""')}"`
  const linhas = [
    ['Nome', 'Negócio', 'E-mail', 'WhatsApp', 'Cidade', 'Plano', 'Situação', 'Mensalidade', 'Próximo vencimento', 'Cliente desde'],
    ...lista.map((a) => [
      a.nome,
      a.negocio?.nome ?? '',
      a.email,
      telefoneLegivel(a.telefone),
      a.negocio?.municipio ? `${a.negocio.municipio}/${a.negocio.uf}` : '',
      a.planoNome,
      SITUACOES_ASSINATURA.find((s) => s.valor === a.situacao)!.rotulo,
      centavosParaTexto(mensalidadeDe(a)),
      a.proximoVencimento ? dataBR(a.proximoVencimento) : '',
      dataBR(a.criadoEm.slice(0, 10)),
    ]),
  ]
  const csv = '﻿' + linhas.map((l) => l.map(cel).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'assinantes-gynfinance.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function AbaAssinantes({ assinantes, planos, hoje, onAbrir }: { assinantes: Assinante[] | null; planos: PlanoAdmin[]; hoje: DataISO; onAbrir: (id: string) => void }) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [plano, setPlano] = useState('')
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return (assinantes ?? []).filter(
      (a) =>
        (filtro === 'todos' || (filtro === 'vencidos' ? vencida(a, hoje) : a.situacao === filtro)) &&
        (!plano || a.planoId === plano) &&
        (!t || [a.nome, a.email, a.negocio?.nome, a.negocio?.municipio, a.telefone, a.negocio?.cnpj].some((v) => v?.toLowerCase().includes(t))),
    )
  }, [assinantes, busca, filtro, plano, hoje])
  if (!assinantes) return <Skeleton className="h-80" />
  const conta = (f: Filtro) => assinantes.filter((a) => (f === 'todos' ? true : f === 'vencidos' ? vencida(a, hoje) : a.situacao === f)).length
  const filtros: Filtro[] = ['todos', 'ativa', 'teste', 'atrasada', 'vencidos', 'suspensa', 'cancelada']
  const rotulo = (f: Filtro) => (f === 'todos' ? 'Todos' : f === 'vencidos' ? 'Vencidos' : SITUACOES_ASSINATURA.find((s) => s.valor === f)!.rotulo)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <Input
          label="Buscar"
          className="flex-1"
          icone={<Search size={16} />}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome, negócio, e-mail, cidade ou telefone"
        />
        <div className="flex gap-3">
          {planos.length > 1 && (
            <Select label="Plano" value={plano} onChange={(e) => setPlano(e.target.value)} opcoes={[{ valor: '', rotulo: 'Todos os planos' }, ...planos.map((p) => ({ valor: p.id, rotulo: p.nome }))]} />
          )}
          <Button variante="secundario" className="mt-auto" icone={<Download size={16} />} onClick={() => baixarContatos(lista)} title="Planilha com nome, e-mail, WhatsApp e plano">
            Baixar contatos
          </Button>
        </div>
      </div>
      <Chips rotulo="Situação" valor={filtro} onChange={setFiltro} opcoes={filtros.filter((f) => f === 'todos' || conta(f) > 0).map((f) => ({ valor: f, rotulo: rotulo(f), contagem: conta(f) }))} />

      <Card className="!p-0 overflow-hidden">
        {lista.length === 0 ? (
          <EstadoVazio icone={<Users size={24} />} titulo="Ninguém encontrado" texto={assinantes.length ? 'Mude a busca ou o filtro.' : 'Quando alguém criar uma conta no sistema, aparece aqui.'} />
        ) : (
          <>
            {/* Celular: um cartão por assinante. */}
            <ul className="divide-y divide-line lg:hidden">
              {lista.map((a) => (
                <li key={a.id}>
                  <button onClick={() => onAbrir(a.id)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-hover">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{a.negocio?.nome ?? a.nome}</span>
                      <span className="block truncate text-[13px] text-ink-2">{a.negocio ? a.nome : a.email}</span>
                      <span className="mt-1 block text-[12px] text-ink-2">
                        {a.planoNome} · <b className="num text-ink">{brl(mensalidadeDe(a))}</b>
                        {a.proximoVencimento && ` · vence ${dataBR(a.proximoVencimento)}`}
                      </span>
                    </span>
                    <SeloSituacao a={a} hoje={hoje} />
                  </button>
                </li>
              ))}
            </ul>
            {/* Computador: tabela. */}
            <div className="relative hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-[14px]">
                <thead className="border-b border-line bg-[#f8fafc] text-[12px] font-semibold tracking-wide text-ink-2 uppercase">
                  <tr>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-3 py-3">Plano</th>
                    <th className="px-3 py-3 text-right">Mensalidade</th>
                    <th className="px-3 py-3">Situação</th>
                    <th className="px-3 py-3">Vencimento</th>
                    <th className="hidden px-3 py-3 xl:table-cell">Último acesso</th>
                    <th className="px-3 py-3">
                      <span className="sr-only">Contato</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lista.map((a) => (
                    <tr key={a.id} onClick={() => onAbrir(a.id)} className="cursor-pointer transition-colors hover:bg-hover">
                      <td className="max-w-[280px] px-5 py-3">
                        <button className="block w-full truncate text-left font-semibold text-ink" onClick={() => onAbrir(a.id)}>
                          {a.negocio?.nome ?? a.nome}
                        </button>
                        <span className="block truncate text-[12px] text-ink-2">
                          {a.negocio ? `${a.nome} · ` : ''}
                          {a.email}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-ink">{a.planoNome}</td>
                      <td className="num px-3 py-3 text-right font-semibold text-ink">
                        {brl(mensalidadeDe(a))}
                        {a.valorCentavos !== undefined && <span className="block text-[11px] font-normal text-ink-2">combinado</span>}
                      </td>
                      <td className="px-3 py-3">
                        <SeloSituacao a={a} hoje={hoje} />
                      </td>
                      <td className={`px-3 py-3 ${vencida(a, hoje) ? 'font-semibold text-danger' : 'text-ink'}`}>{a.proximoVencimento ? dataBR(a.proximoVencimento) : '—'}</td>
                      <td className="hidden px-3 py-3 text-ink-2 xl:table-cell">{haQuanto(a.ultimoAcesso, hoje)}</td>
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {a.telefone && (
                          <a
                            href={linkWhatsapp(a.telefone, `Olá, ${a.nome.split(' ')[0]}! Aqui é do Gynfinance.`)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`WhatsApp de ${a.nome}`}
                            className="inline-flex size-9 items-center justify-center rounded-full text-success hover:bg-success-soft"
                          >
                            <MessageCircle size={18} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

// ---------- Ficha de um assinante ----------

export function FichaAssinante({
  fonte,
  assinante: a,
  planos,
  hoje,
  onFechar,
  onMudou,
}: {
  fonte: FonteAdmin
  assinante: Assinante | null
  planos: PlanoAdmin[]
  hoje: DataISO
  onFechar: () => void
  onMudou: () => Promise<void>
}) {
  const toast = useToast()
  const [planoId, setPlanoId] = useState('')
  const [situacao, setSituacao] = useState<SituacaoAssinatura>('teste')
  const [valorTxt, setValorTxt] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [telefone, setTelefone] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [pagamentos, setPagamentos] = useState<PagamentoMensalidade[] | null>(null)
  const [novo, setNovo] = useState(false)
  const id = a?.id

  useEffect(() => {
    if (!a) return
    setPlanoId(a.planoId)
    setSituacao(a.situacao)
    setValorTxt(a.valorCentavos !== undefined ? centavosParaTexto(a.valorCentavos) : '')
    setVencimento(a.proximoVencimento ?? '')
    setTelefone(a.telefone ?? '')
    setObservacao(a.observacao)
    setNovo(false)
    // Só ao abrir outra ficha: depois de salvar, a lista recarrega e o formulário fica como está.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  useEffect(() => {
    if (!id) return
    setPagamentos(null)
    fonte.pagamentos(id).then(setPagamentos, () => setPagamentos([]))
  }, [id, fonte])

  if (!a) return null
  const planoEscolhido = planos.find((p) => p.id === planoId)
  const salvar = async () => {
    setSalvando(true)
    try {
      await fonte.alterarAssinante(a.id, {
        planoId,
        situacao,
        valorCentavos: valorTxt.trim() ? lerValor(valorTxt) : null,
        proximoVencimento: vencimento || null,
        telefone: telefone.trim() || null,
        observacao: observacao.trim(),
      })
      await onMudou()
      toast('Assinatura salva.')
      onFechar()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  const copiar = (texto: string) => {
    navigator.clipboard?.writeText(texto).then(
      () => toast('Copiado.'),
      () => toast(texto),
    )
  }

  return (
    <Modal
      aberto
      larga
      onFechar={onFechar}
      titulo={a.negocio?.nome ?? a.nome}
      rodape={
        <>
          <Button variante="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} carregando={salvando}>
            Salvar assinatura
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Contato e negócio */}
        <div className="grid grid-cols-1 gap-3 rounded-[14px] bg-[#f5f7fa] p-4 text-[13px] sm:grid-cols-2">
          <div className="min-w-0">
            <p className="font-semibold text-ink">{a.nome}</p>
            <p className="mt-1 flex items-center gap-1.5 truncate">
              <Mail size={14} aria-hidden className="shrink-0 text-slate" />
              <span className="truncate">{a.email}</span>
              <button onClick={() => copiar(a.email)} aria-label="Copiar e-mail" className="rounded p-0.5 text-slate hover:text-ink">
                <Copy size={13} />
              </button>
            </p>
            {a.telefone && (
              <p className="mt-1 flex items-center gap-1.5">
                <Phone size={14} aria-hidden className="text-slate" />
                {telefoneLegivel(a.telefone)}
              </p>
            )}
            <p className="mt-1 text-ink-2">
              Cliente desde {dataBR(a.criadoEm.slice(0, 10))} · último acesso {haQuanto(a.ultimoAcesso, hoje)}
            </p>
          </div>
          <div className="min-w-0">
            {a.negocio ? (
              <>
                <p className="flex items-center gap-1.5 font-semibold text-ink">
                  <Building2 size={14} aria-hidden className="text-slate" />
                  {a.negocio.nome}
                </p>
                <p className="mt-1">
                  {a.negocio.ehMei ? 'MEI' : 'Empresa'} · {ATIVIDADES[a.negocio.atividade] ?? a.negocio.atividade}
                </p>
                <p className="mt-1">
                  {a.negocio.municipio ? `${a.negocio.municipio}/` : ''}
                  {a.negocio.uf}
                  {a.negocio.cnpj && ` · CNPJ ${a.negocio.cnpj}`}
                </p>
              </>
            ) : (
              <p className="text-ink-2">Ainda não fez a configuração inicial do negócio.</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={linkWhatsapp(telefone || a.telefone, mensagemCobranca(a))} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-line px-3.5 text-[13px] font-semibold text-success hover:bg-success-soft">
            <MessageCircle size={15} aria-hidden /> Cobrar no WhatsApp
          </a>
        </div>

        {/* Assinatura */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Plano" value={planoId} onChange={(e) => setPlanoId(e.target.value)} opcoes={planos.map((p) => ({ valor: p.id, rotulo: `${p.nome} · ${brl(p.precoCentavos)}${p.ativo ? '' : ' (inativo)'}` }))} />
          <Input
            label="Mensalidade combinada (opcional)"
            inputMode="decimal"
            value={valorTxt}
            onChange={(e) => setValorTxt(e.target.value)}
            placeholder={planoEscolhido ? `${brl(planoEscolhido.precoCentavos)} do plano` : 'R$ 0,00'}
          />
          <Input label="Próximo vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          <Input label="WhatsApp" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(62) 99999-0000" />
        </div>
        <div>
          <Label>Situação</Label>
          <Chips rotulo="Situação da assinatura" valor={situacao} onChange={setSituacao} opcoes={SITUACOES_ASSINATURA} />
          <p className="mt-2 text-[12px] text-ink-2">
            {situacao === 'suspensa' || situacao === 'cancelada'
              ? 'O cliente continua vendo e exportando os dados, mas não grava nada novo até você voltar para Ativa.'
              : situacao === 'atrasada'
                ? 'O cliente usa normalmente e vê um aviso de mensalidade em atraso.'
                : situacao === 'teste'
                  ? 'Tudo liberado. O cliente vê um aviso quando faltam 5 dias para o teste acabar.'
                  : 'Tudo liberado conforme o plano.'}
          </p>
        </div>
        <Texto label="Anotações (só você vê)" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: paga sempre no dia 10" />
        {(a.indicadoPor || !!a.indicacoes) && (
          <div className="rounded-[12px] border border-line bg-hover/60 px-3.5 py-3 text-[13px] text-ink-2">
            <p className="font-semibold text-ink">Indique e ganhe</p>
            {a.indicadoPor && (
              <p className="mt-1">
                Chegou pelo link de <b className="text-ink">{a.indicadoPor.nome}</b> ({a.indicadoPor.email}). Quando pagar a primeira mensalidade, dê 1 mês grátis para os dois (próximo vencimento + 1 mês).
              </p>
            )}
            {!!a.indicacoes && <p className="mt-1">Já trouxe {a.indicacoes} {a.indicacoes === 1 ? 'pessoa' : 'pessoas'} pelo link dela.</p>}
          </div>
        )}

        {/* Mensalidades */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-bold text-ink">Mensalidades pagas</h3>
            {!novo && (
              <Button tamanho="sm" variante="contorno" onClick={() => setNovo(true)}>
                Registrar pagamento
              </Button>
            )}
          </div>
          {novo && (
            <NovoPagamentoForm
              assinante={a}
              hoje={hoje}
              onCancelar={() => setNovo(false)}
              onSalvar={async (p) => {
                const r = await fonte.registrarPagamento(a.id, p)
                setNovo(false)
                setPagamentos(await fonte.pagamentos(a.id))
                if (p.avancarVencimento) {
                  setSituacao('ativa')
                  setVencimento(r.proximoVencimento ?? '')
                }
                await onMudou()
                toast(p.avancarVencimento && r.proximoVencimento ? `Pagamento registrado. Próximo vencimento: ${dataBR(r.proximoVencimento)}.` : 'Pagamento registrado.')
              }}
            />
          )}
          {pagamentos === null ? (
            <Skeleton className="h-16" />
          ) : pagamentos.length === 0 ? (
            <p className="text-[13px] text-ink-2">Nenhum pagamento registrado.</p>
          ) : (
            <ul className="divide-y divide-line rounded-[12px] border border-line">
              {pagamentos.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-ink">{mesAno(p.referente)}</span>
                    <span className="block text-ink-2">
                      Pago em {dataBR(p.pagoEm)} · {FORMAS_MENSALIDADE.find((f) => f.valor === p.forma)?.rotulo ?? p.forma}
                      {p.observacao && ` · ${p.observacao}`}
                    </span>
                  </span>
                  <span className="num font-bold text-success">{brl(p.valorCentavos)}</span>
                  <button
                    aria-label="Apagar pagamento"
                    title="Apagar pagamento"
                    className="rounded-lg p-1.5 text-slate hover:bg-danger-soft hover:text-danger"
                    onClick={async () => {
                      await fonte.apagarPagamento(p.id)
                      setPagamentos(await fonte.pagamentos(a.id))
                      await onMudou()
                      toast('Pagamento apagado. O vencimento não mudou; ajuste acima se precisar.')
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}

function NovoPagamentoForm({
  assinante: a,
  hoje,
  onCancelar,
  onSalvar,
}: {
  assinante: Assinante
  hoje: DataISO
  onCancelar: () => void
  onSalvar: (p: { valorCentavos: number; pagoEm: DataISO; referente: string; forma: FormaMensalidade; observacao: string; avancarVencimento: boolean }) => Promise<void>
}) {
  const ref = (a.proximoVencimento ?? hoje).slice(0, 7)
  const [valorTxt, setValorTxt] = useState(centavosParaTexto(mensalidadeDe(a)))
  const [pagoEm, setPagoEm] = useState(hoje)
  const [referente, setReferente] = useState(ref)
  const [forma, setForma] = useState<FormaMensalidade>('pix')
  const [observacao, setObservacao] = useState('')
  const [avancar, setAvancar] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const meses = Array.from({ length: 7 }, (_, i) => addMeses(ref, i - 3))
  const proximo = maisUmMes(a.proximoVencimento ?? pagoEm)

  return (
    <div className="mb-3 flex flex-col gap-3 rounded-[14px] border border-primary-line bg-primary-soft/40 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Input label="Valor" inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} erro={erro} />
        <Input label="Pago em" type="date" value={pagoEm} onChange={(e) => e.target.value && setPagoEm(e.target.value)} />
        <Select label="Mês que paga" value={referente} onChange={(e) => setReferente(e.target.value)} opcoes={meses.map((m) => ({ valor: m, rotulo: mesAno(m) }))} />
        <Select label="Forma" value={forma} onChange={(e) => setForma(e.target.value as FormaMensalidade)} opcoes={FORMAS_MENSALIDADE} />
      </div>
      <Input label="Observação (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: pagou com desconto" />
      <Toggle checked={avancar} onChange={setAvancar} label="Marcar como ativa e avançar o vencimento" descricao={`Próximo vencimento passa para ${dataBR(proximo)}.`} />
      <div className="flex justify-end gap-2">
        <Button variante="discreto" tamanho="sm" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          tamanho="sm"
          carregando={salvando}
          onClick={async () => {
            const valor = lerValor(valorTxt)
            if (valor <= 0) return setErro('Digite o valor pago.')
            setSalvando(true)
            try {
              await onSalvar({ valorCentavos: valor, pagoEm, referente, forma, observacao: observacao.trim(), avancarVencimento: avancar })
            } catch (e) {
              setErro((e as Error).message)
            } finally {
              setSalvando(false)
            }
          }}
        >
          Registrar {lerValor(valorTxt) > 0 ? brl(lerValor(valorTxt)) : ''}
        </Button>
      </div>
    </div>
  )
}
