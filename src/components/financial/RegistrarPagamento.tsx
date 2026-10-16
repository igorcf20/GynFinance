// Pagamento com detalhes: total, parcial ou parcelado, data, por onde saiu, como foi pago e comprovante.
import { CalendarDays, FileText, Landmark, Paperclip, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ACEITOS, enderecoDoComprovante, tamanhoLegivel } from '../../data/comprovante'
import { FORMAS } from '../../data/formas'
import { useStore } from '../../data/store'
import { dividirEmParcelas, type DetalhesPagamento, type ModoPagamento } from '../../domain/pagamento'
import type { Comprovante, ContaFinanceira, FormaPagamento, Lancamento } from '../../domain/types'
import { addDias, addMeses, brl, centavosParaTexto, dataBR, lerValor } from '../../lib/format'
import { Button } from '../ui/Button'
import { Input, Label, Select } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { temModulo } from '../../domain/planos'
import { Chips, Segmentado } from '../ui/Tabs'

const PARCELAS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => ({ valor: String(n), rotulo: `${n} vezes` }))

function umMesDepois(data: string): string {
  const mes = addMeses(data.slice(0, 7), 1)
  const [a, m] = mes.split('-').map(Number)
  return `${mes}-${String(Math.min(Number(data.slice(8, 10)), new Date(a, m, 0).getDate())).padStart(2, '0')}`
}

function contaPara(contas: ContaFinanceira[], forma: FormaPagamento, atual: string): string {
  const caixa = contas.find((c) => c.tipo === 'caixa')
  const banco = contas.find((c) => c.tipo === 'banco')
  if (forma === 'dinheiro' && caixa) return caixa.id
  if (forma !== 'dinheiro' && atual === caixa?.id && banco) return banco.id
  return atual
}

export function RegistrarPagamento({
  conta,
  aberto,
  onFechar,
  onConfirmar,
}: {
  conta: Lancamento
  aberto: boolean
  onFechar: () => void
  onConfirmar: (d: DetalhesPagamento) => void
}) {
  const { dados, hoje, anexarComprovante, modulos } = useStore()
  const receber = conta.natureza === 'entrada'
  const contas = dados.contas.filter((c) => c.ativa)
  const [modo, setModo] = useState<ModoPagamento>('total')
  const [valorTxt, setValorTxt] = useState('')
  const [data, setData] = useState(hoje)
  const [contaId, setContaId] = useState(conta.contaFinanceiraId)
  const [forma, setForma] = useState<FormaPagamento>(conta.formaPagamento)
  const [restanteVence, setRestanteVence] = useState('')
  const [parcelas, setParcelas] = useState(3)
  const [primeiraAgora, setPrimeiraAgora] = useState(true)
  const [proxima, setProxima] = useState('')
  const [comprovante, setComprovante] = useState<Comprovante | undefined>()
  const [enviandoArquivo, setEnviandoArquivo] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const arquivo = useRef<HTMLInputElement>(null)

  // Cada vez que abre, começa do jeito da conta: valor cheio, hoje, conta e forma de costume.
  useEffect(() => {
    if (!aberto) return
    const venc = conta.dataVencimento ?? hoje
    setModo('total')
    setValorTxt(centavosParaTexto(conta.valor))
    setData(hoje)
    setContaId(conta.contaFinanceiraId)
    setForma(conta.formaPagamento)
    setRestanteVence(venc > hoje ? venc : addDias(hoje, 7))
    setParcelas(3)
    setPrimeiraAgora(true)
    setProxima(umMesDepois(venc > hoje ? venc : hoje))
    setComprovante(undefined)
    setObservacao('')
    setErro('')
  }, [aberto, conta, hoje])

  const valor = lerValor(valorTxt)
  const valoresParcelas = useMemo(() => dividirEmParcelas(conta.valor, parcelas), [conta.valor, parcelas])
  const pagoAgora = modo === 'parcelado' ? (primeiraAgora ? valoresParcelas[0] : 0) : valor
  const verbo = receber ? 'recebido' : 'pago'

  const escolherArquivo = async (f: File | undefined) => {
    if (!f) return
    setErro('')
    setEnviandoArquivo(true)
    try {
      setComprovante(await anexarComprovante(f))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviandoArquivo(false)
      if (arquivo.current) arquivo.current.value = ''
    }
  }

  const confirmar = () => {
    setErro('')
    if (modo !== 'parcelado' && valor <= 0) return setErro(`Informe o valor ${verbo}.`)
    if (modo === 'parcial' && valor >= conta.valor) return setErro(`No pagamento parcial, o valor ${verbo} fica abaixo de ${brl(conta.valor, { centavos: true })}. Se foi tudo, escolha Total.`)
    if (modo === 'parcial' && !restanteVence) return setErro('Diga quando vence o que ficou faltando.')
    if (modo === 'parcelado' && !proxima) return setErro('Diga quando vence a próxima parcela.')
    if ((modo !== 'parcelado' || primeiraAgora) && data > hoje) return setErro(`A data do pagamento não pode ser no futuro.`)
    onConfirmar({
      modo,
      valorPago: valor,
      dataPagamento: data,
      contaFinanceiraId: contaId,
      formaPagamento: forma,
      comprovante,
      observacao,
      restanteVence,
      parcelas,
      primeiraPagaAgora: primeiraAgora,
      proximaVence: proxima,
    })
  }

  const nome = (receber ? conta.contraparte || conta.descricao : conta.descricao || conta.contraparte) ?? 'Conta'
  const mostraPagamento = modo !== 'parcelado' || primeiraAgora

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={receber ? 'Registrar recebimento' : 'Registrar pagamento'}
      rodape={
        <>
          <Button variante="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={enviandoArquivo}>
            {pagoAgora > 0 ? `Confirmar ${brl(pagoAgora, { centavos: true })}` : 'Confirmar parcelas'}
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          confirmar()
        }}
        className="flex flex-col gap-4 text-ink"
      >
        <div className="flex items-center justify-between gap-3 rounded-[14px] bg-[#f3f6fa] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold">{nome}</p>
            <p className="text-[12px] text-ink-2">{conta.dataVencimento ? `Vence em ${dataBR(conta.dataVencimento)}` : 'Conta prevista'}</p>
          </div>
          <span className="num shrink-0 text-[16px] font-bold">{brl(conta.valor, { centavos: true })}</span>
        </div>

        <Segmentado
          rotulo="Como foi o pagamento"
          valor={modo}
          onChange={(v) => {
            setModo(v)
            setErro('')
            if (v === 'parcial') setValorTxt(centavosParaTexto(Math.round(conta.valor / 2)))
            if (v === 'total') setValorTxt(centavosParaTexto(conta.valor))
          }}
          opcoes={[
            { valor: 'total', rotulo: 'Total' },
            { valor: 'parcial', rotulo: 'Parcial' },
            { valor: 'parcelado', rotulo: 'Parcelado' },
          ]}
          className="flex w-full"
        />

        {modo === 'total' && (
          <div>
            <Input label={`Valor ${verbo}`} inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value.replace(/[^\d.,]/g, ''))} icone={<span className="text-[13px] font-semibold">R$</span>} />
            <p className="mt-1 text-[12px] text-ink-2">Mude se houve juros, multa ou desconto.</p>
          </div>
        )}

        {modo === 'parcial' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label={`Valor ${verbo} agora`} inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value.replace(/[^\d.,]/g, ''))} icone={<span className="text-[13px] font-semibold">R$</span>} />
            <Input label="O resto vence em" type="date" value={restanteVence} min={hoje} onChange={(e) => setRestanteVence(e.target.value)} />
            <p className="text-[13px] text-ink-2 sm:col-span-2">
              Fica faltando <b className="num text-ink">{brl(Math.max(conta.valor - valor, 0), { centavos: true })}</b>, que volta para {receber ? 'Contas a receber' : 'Contas a pagar'}.
            </p>
          </div>
        )}

        {modo === 'parcelado' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Em quantas parcelas" value={String(parcelas)} onChange={(e) => setParcelas(Number(e.target.value))} opcoes={PARCELAS} />
              <Input label={primeiraAgora ? 'A 2ª parcela vence em' : 'A 1ª parcela vence em'} type="date" value={proxima} min={hoje} onChange={(e) => setProxima(e.target.value)} />
            </div>
            <p className="text-[13px] text-ink-2">
              {parcelas} parcelas de <b className="num text-ink">{brl(valoresParcelas[parcelas - 1], { centavos: true })}</b>
              {valoresParcelas[0] !== valoresParcelas[parcelas - 1] && ` (as primeiras com ${brl(valoresParcelas[0], { centavos: true })})`}, uma por mês.
            </p>
            <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-medium">
              <input type="checkbox" checked={primeiraAgora} onChange={(e) => setPrimeiraAgora(e.target.checked)} className="size-4 accent-[#3478f6]" />A 1ª parcela foi {verbo} agora
            </label>
          </div>
        )}

        {mostraPagamento && (
          <>
            <Input label={`Data em que foi ${verbo}`} type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} icone={<CalendarDays size={16} />} />
            <div>
              <Label>{receber ? 'Entrou em' : 'Saiu de'}</Label>
              <Chips rotulo={receber ? 'Entrou em' : 'Saiu de'} valor={contaId} onChange={setContaId} opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.nome, icone: <Landmark size={15} aria-hidden /> }))} />
            </div>
            <div>
              <Label>{receber ? 'Como recebeu' : 'Como pagou'}</Label>
              <Chips
                rotulo={receber ? 'Como recebeu' : 'Como pagou'}
                valor={forma}
                onChange={(f) => {
                  setForma(f)
                  setContaId((atual) => contaPara(contas, f, atual))
                }}
                opcoes={FORMAS}
              />
            </div>
            {temModulo(modulos, 'comprovantes') && (
            <div>
              <Label>Comprovante (opcional)</Label>
              {comprovante ? (
                <div className="flex items-center gap-3 rounded-[12px] border border-line px-3 py-2.5">
                  {comprovante.tipo.startsWith('image/') && comprovante.dados ? (
                    <img src={comprovante.dados} alt="" className="size-11 shrink-0 rounded-[8px] object-cover" />
                  ) : (
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[8px] bg-primary-soft text-primary">
                      <FileText size={20} aria-hidden />
                    </span>
                  )}
                  <a href={enderecoDoComprovante(comprovante)} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{comprovante.nome}</span>
                    <span className="text-[12px] text-ink-2">{tamanhoLegivel(comprovante.tamanho)}</span>
                  </a>
                  <button type="button" onClick={() => setComprovante(undefined)} aria-label="Tirar o comprovante" className="rounded-lg p-1.5 text-slate hover:bg-hover hover:text-ink">
                    <X size={17} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => arquivo.current?.click()}
                  disabled={enviandoArquivo}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-primary-line bg-primary-soft/40 px-4 py-3.5 text-[14px] font-semibold text-primary transition-colors hover:bg-primary-soft disabled:opacity-60"
                >
                  <Paperclip size={17} aria-hidden />
                  {enviandoArquivo ? 'Anexando…' : 'Anexar foto ou PDF'}
                </button>
              )}
              <input ref={arquivo} type="file" accept={ACEITOS} className="hidden" aria-label="Arquivo do comprovante" onChange={(e) => void escolherArquivo(e.target.files?.[0])} />
            </div>
            )}
          </>
        )}

        <Input label="Observação (opcional)" placeholder={receber ? 'Ex.: recebeu com desconto' : 'Ex.: pago com juros de atraso'} maxLength={300} value={observacao} onChange={(e) => setObservacao(e.target.value)} />

        {erro && (
          <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13px] text-[#9b1c2e]">
            {erro}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
