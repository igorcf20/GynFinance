import { AlarmClock, Hourglass, MessageCircle, Repeat, UserPlus, Users, Wallet, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Card, CardTitulo, IconeBox, Skeleton, type TomIcone } from '../../components/ui/Card'
import { Explica } from '../../components/ui/Explica'
import { ValorAnimado } from '../../components/ui/ValorAnimado'
import { linkWhatsapp } from '../../components/agenda/visual'
import { mensalidadeDe, resumir, vencida, type Assinante, type FonteAdmin } from '../../data/admin'
import type { DataISO } from '../../domain/types'
import { addDias, brl, dataBR, nomeMes } from '../../lib/format'
import { SeloSituacao } from './comum'

function Numero({ icone: Icone, tom, titulo, explica, children, rodape }: { icone: LucideIcon; tom: TomIcone; titulo: string; explica: ReactNode; children: ReactNode; rodape?: ReactNode }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3.5">
        <IconeBox tom={tom}>
          <Icone size={20} strokeWidth={2.1} />
        </IconeBox>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[14px] font-bold text-ink">
            {titulo}
            <Explica titulo={titulo}>{explica}</Explica>
          </p>
          <p className="valor-grande mt-1 text-[26px] text-ink">{children}</p>
        </div>
      </div>
      {rodape && <p className="mt-3 text-[13px] text-ink-2">{rodape}</p>}
    </Card>
  )
}

export function mensagemCobranca(a: Assinante): string {
  const nome = a.nome.split(' ')[0]
  const venc = a.proximoVencimento ? ` que venceu em ${dataBR(a.proximoVencimento)}` : ''
  return a.situacao === 'teste'
    ? `Olá, ${nome}! Aqui é do Gynfinance. Seu período de teste está acabando. Quer continuar? A mensalidade é de ${brl(mensalidadeDe(a))} e eu te passo o Pix.`
    : `Olá, ${nome}! Aqui é do Gynfinance. Passando para lembrar da mensalidade de ${brl(mensalidadeDe(a))}${venc}. Posso te mandar o Pix?`
}

function Lista({ titulo, vazio, itens, hoje, onAbrir, cobrar }: { titulo: string; vazio: string; itens: Assinante[]; hoje: DataISO; onAbrir: (id: string) => void; cobrar?: boolean }) {
  return (
    <Card>
      <CardTitulo>
        {titulo}
        {itens.length > 0 && <span className="num ml-1.5 rounded-full bg-[#eef2f7] px-2 text-[12px] text-ink-2">{itens.length}</span>}
      </CardTitulo>
      {itens.length === 0 ? (
        <p className="text-[14px] text-ink-2">{vazio}</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {itens.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-[12px] px-2 py-2 hover:bg-hover">
              <button onClick={() => onAbrir(a.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{a.negocio?.nome ?? a.nome}</span>
                  <span className="block truncate text-[12px] text-ink-2">
                    {a.nome} · {a.proximoVencimento ? `vence ${dataBR(a.proximoVencimento)}` : 'sem vencimento'}
                  </span>
                </span>
                <span className="num hidden text-[14px] font-bold text-ink sm:block">{brl(mensalidadeDe(a))}</span>
                <SeloSituacao a={a} hoje={hoje} />
              </button>
              {cobrar && a.telefone && (
                <a
                  href={linkWhatsapp(a.telefone, mensagemCobranca(a))}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Cobrar ${a.nome} no WhatsApp`}
                  title="Cobrar no WhatsApp"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-success hover:bg-success-soft"
                >
                  <MessageCircle size={18} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function AbaResumo({
  fonte,
  assinantes,
  hoje,
  onAbrir,
  onIrPara,
}: {
  fonte: FonteAdmin
  assinantes: Assinante[] | null
  hoje: DataISO
  onAbrir: (id: string) => void
  onIrPara: (aba: 'assinantes') => void
}) {
  const [recebido, setRecebido] = useState<number | null>(null)
  const buscar = useCallback(() => fonte.recebidoNoMes(hoje).then(setRecebido, () => setRecebido(0)), [fonte, hoje])
  useEffect(() => {
    void buscar()
  }, [buscar, assinantes])
  if (!assinantes)
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    )
  const r = resumir(assinantes, hoje, recebido ?? 0)
  const semana = addDias(hoje, 7)
  const cobrar = assinantes.filter((a) => a.situacao === 'atrasada' || (vencida(a, hoje) && a.situacao !== 'teste'))
  const vencendo = assinantes
    .filter((a) => a.situacao === 'ativa' && a.proximoVencimento && a.proximoVencimento >= hoje && a.proximoVencimento <= semana)
    .sort((a, b) => a.proximoVencimento!.localeCompare(b.proximoVencimento!))
  const testes = assinantes.filter((a) => a.situacao === 'teste' && a.proximoVencimento && a.proximoVencimento <= semana).sort((a, b) => a.proximoVencimento!.localeCompare(b.proximoVencimento!))

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-4">
        <Numero
          icone={Repeat}
          tom="solido"
          titulo="Receita por mês"
          explica="Soma das mensalidades de quem está com a assinatura ativa ou atrasada. É quanto entra todo mês se todos pagarem. Clientes em teste ainda não contam."
          rodape={`${r.pagantes} cliente${r.pagantes === 1 ? '' : 's'} pagante${r.pagantes === 1 ? '' : 's'}`}
        >
          <ValorAnimado centavos={r.receitaMensal} />
        </Numero>
        <Numero
          icone={Wallet}
          tom="verde"
          titulo="Recebido no mês"
          explica={`Mensalidades que você registrou como pagas em ${nomeMes(hoje.slice(0, 7))}, na ficha de cada assinante.`}
          rodape={r.receitaMensal ? `${Math.min(100, Math.round(((recebido ?? 0) / r.receitaMensal) * 100))}% da receita do mês` : 'Nenhum cliente pagante ainda'}
        >
          {recebido === null ? '…' : <ValorAnimado centavos={recebido} />}
        </Numero>
        <Numero
          icone={AlarmClock}
          tom={r.atrasados ? 'vermelho' : 'neutro'}
          titulo="Atrasados"
          explica="Assinaturas marcadas como atrasadas e as que passaram do vencimento sem pagamento registrado (inclusive testes que acabaram)."
          rodape={`${r.bloqueados} suspensa${r.bloqueados === 1 ? '' : 's'} ou cancelada${r.bloqueados === 1 ? '' : 's'}`}
        >
          <span className="num">{r.atrasados}</span>
        </Numero>
        <Numero
          icone={Users}
          tom="azul"
          titulo="Assinantes"
          explica="Todas as contas criadas no sistema, em qualquer situação."
          rodape={
            <button onClick={() => onIrPara('assinantes')} className="inline-flex items-center gap-1 font-semibold text-primary">
              <UserPlus size={14} aria-hidden /> {r.novos30Dias} novo{r.novos30Dias === 1 ? '' : 's'} em 30 dias · {r.emTeste} em teste
            </button>
          }
        >
          <span className="num">{r.total}</span>
        </Numero>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-3">
        <Lista titulo="Cobrar agora" vazio="Ninguém atrasado. Tudo em dia." itens={cobrar} hoje={hoje} onAbrir={onAbrir} cobrar />
        <Lista titulo="Vencem nos próximos 7 dias" vazio="Nenhuma mensalidade vence esta semana." itens={vencendo} hoje={hoje} onAbrir={onAbrir} cobrar />
        <Lista titulo="Testes acabando" vazio="Nenhum teste termina esta semana." itens={testes} hoje={hoje} onAbrir={onAbrir} cobrar />
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-ink-2">
        <Hourglass size={13} aria-hidden /> O sistema não suspende ninguém sozinho: a situação de cada assinatura muda só quando você muda na ficha.
      </p>
    </div>
  )
}
