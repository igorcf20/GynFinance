import { CalendarClock, CircleDollarSign, MessageCircle, Pencil, Trash2, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SITUACOES, type Evento } from '../../domain/agenda'
import type { SituacaoAtendimento } from '../../domain/types'
import { useStore } from '../../data/store'
import { brl, dataBR, prazo } from '../../lib/format'
import { Badge } from '../ui/Badge'
import { Button, classesBotao } from '../ui/Button'
import { Label } from '../ui/Field'
import { Modal, useToast } from '../ui/Modal'
import { Chips } from '../ui/Tabs'
import { dataPorExtenso, linkWhatsapp, rotuloTipo } from './visual'

/** O que aparece ao tocar num item da agenda: dá para mudar a situação, receber, pagar ou alterar. */
export function DetalheEvento({ evento, onFechar, onEditar }: { evento: Evento | null; onFechar: () => void; onEditar: () => void }) {
  const { dados, hoje, salvarAtendimento, excluirAtendimento, marcarComoPago } = useStore()
  const toast = useToast()
  if (!evento) return null
  // Lê o atendimento atual (a situação pode ter mudado com a janela aberta).
  const a = evento.atendimento ? (dados.atendimentos.find((x) => x.id === evento.atendimento!.id) ?? evento.atendimento) : undefined
  const conta = a?.lancamentoId ? dados.lancamentos.find((l) => l.id === a.lancamentoId) : evento.conta
  const aberta = conta?.situacao === 'previsto'
  const receber = conta?.natureza === 'entrada'

  const mudarSituacao = (s: SituacaoAtendimento) => {
    if (!a) return
    const { id, empresaId: _e, lancamentoId, ...resto } = a
    const desfazer = salvarAtendimento({ ...resto, situacao: s }, id, !!lancamentoId)
    const texto = SITUACOES.find((x) => x.valor === s)!.rotulo
    toast(s === 'cancelado' || s === 'faltou' ? `${texto}. ${lancamentoId && aberta ? 'A conta a receber saiu de Contas.' : 'O horário ficou livre.'}` : `Atendimento: ${texto.toLowerCase()}.`, { desfazer })
  }
  const baixar = () => {
    if (!conta) return
    const desfazer = marcarComoPago(conta.id)
    toast(`${receber ? 'Recebimento' : 'Pagamento'} de ${brl(conta.valor)} registrado.`, { desfazer })
    if (!a) onFechar()
  }
  const excluir = () => {
    if (!a) return
    const desfazer = excluirAtendimento(a.id)
    onFechar()
    toast('Atendimento apagado.', { desfazer })
  }

  const confirmar = a
    ? `Olá, ${a.cliente.split(' ')[0]}! Aqui é da ${dados.empresa.nomeFantasia}. Confirmando ${a.servico ? `${a.servico.toLowerCase()} ` : 'seu horário '}${a.data === hoje ? 'hoje' : `em ${dataBR(a.data).slice(0, 5)}`} às ${a.inicio}. Podemos confirmar?`
    : ''

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={a ? a.cliente : evento.titulo}
      rodape={
        a ? (
          <>
            <Button variante="discreto" onClick={excluir} icone={<Trash2 size={16} />} aria-label="Apagar atendimento" className="mr-auto !px-3 text-danger hover:!text-danger">
              Apagar
            </Button>
            <Button variante="secundario" onClick={onEditar} icone={<Pencil size={16} />}>
              Alterar
            </Button>
          </>
        ) : (
          <Link to={`/contas?aba=${receber ? 'receber' : 'pagar'}`} className={classesBotao('secundario')} onClick={onFechar}>
            Ver em Contas
          </Link>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tom={evento.atrasada ? 'vermelho' : evento.tipo === 'atendimento' ? 'azul' : evento.tipo === 'receber' ? 'verde' : 'ambar'}>{rotuloTipo(evento)}</Badge>
          {a?.servico && <span className="text-[14px] font-medium text-ink">{a.servico}</span>}
          {!a && evento.detalhe && <span className="text-[14px] text-ink-2">{evento.detalhe}</span>}
        </div>

        <ul className="flex flex-col gap-2.5 text-[14px] text-ink">
          <li className="flex items-center gap-2.5">
            <CalendarClock size={17} className="text-slate" aria-hidden />
            {dataPorExtenso(evento.data, true)}
            {evento.inicio && ` · ${evento.inicio} às ${evento.fim}`}
          </li>
          {(evento.valor ?? conta?.valor) ? (
            <li className="flex items-center gap-2.5">
              <CircleDollarSign size={17} className="text-slate" aria-hidden />
              <span className="num font-bold">{brl(evento.valor ?? conta!.valor)}</span>
              {conta && (
                <span className={`text-[13px] ${conta.situacao === 'realizado' ? 'text-success' : evento.atrasada || (aberta && conta.dataVencimento! < hoje) ? 'text-danger' : 'text-ink-2'}`}>
                  {conta.situacao === 'realizado'
                    ? receber
                      ? `recebido em ${dataBR(conta.dataPagamento!)}`
                      : `pago em ${dataBR(conta.dataPagamento!)}`
                    : `${receber ? 'a receber' : 'a pagar'}, ${prazo(conta.dataVencimento!, hoje, !receber)}`}
                </span>
              )}
            </li>
          ) : null}
          {a?.telefone && (
            <li className="flex items-center gap-2.5">
              <UserRound size={17} className="text-slate" aria-hidden />
              {a.telefone}
            </li>
          )}
        </ul>
        {a?.observacao && <p className="rounded-[12px] bg-[#f5f7fa] px-3 py-2.5 text-[13px] text-ink-2">{a.observacao}</p>}

        {a && (
          <div>
            <Label>Situação</Label>
            <Chips rotulo="Situação do atendimento" valor={a.situacao} onChange={mudarSituacao} opcoes={SITUACOES} />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {conta && aberta && (
            <Button variante="contorno" className="flex-1" onClick={baixar}>
              {receber ? `Recebi ${brl(conta.valor)}` : `Paguei ${brl(conta.valor)}`}
            </Button>
          )}
          {a && a.situacao !== 'cancelado' && a.situacao !== 'concluido' && a.situacao !== 'faltou' && (
            <a href={linkWhatsapp(a.telefone, confirmar)} target="_blank" rel="noreferrer" className={classesBotao('secundario', 'md', 'flex-1 !text-success')}>
              <MessageCircle size={16} aria-hidden />
              Confirmar no WhatsApp
            </a>
          )}
        </div>
      </div>
    </Modal>
  )
}
