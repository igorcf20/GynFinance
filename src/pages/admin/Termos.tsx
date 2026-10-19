// Termos de uso e política de privacidade: o texto em vigor, as versões antigas (com quantas contas
// aceitaram cada uma) e a publicação de uma versão nova, que pede novo aceite de todos os clientes.
import { AlertTriangle, ExternalLink, FileCheck2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardTitulo, Skeleton } from '../../components/ui/Card'
import { Modal, useToast } from '../../components/ui/Modal'
import { Segmentado } from '../../components/ui/Tabs'
import type { DocumentoLegal, FonteAdmin } from '../../data/admin'
import { linkDocumento } from '../../lib/legal'
import { Texto, useCarregar } from './comum'

type Tipo = DocumentoLegal['tipo']
const TITULO: Record<Tipo, string> = { termos: 'Termos de Uso', privacidade: 'Política de Privacidade' }

// O que a lei pede que apareça no site (Decreto 7.962/2013, art. 2º, e LGPD, art. 41) e é usado nos textos.
const OBRIGATORIOS: { chave: string; rotulo: string }[] = [
  { chave: 'empresa.cnpj', rotulo: 'CNPJ (ou documento da empresa)' },
  { chave: 'empresa.endereco', rotulo: 'Endereço' },
  { chave: 'contato.email', rotulo: 'E-mail de contato' },
]

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function AbaTermos({ fonte }: { fonte: FonteAdmin }) {
  const toast = useToast()
  const [tipo, setTipo] = useState<Tipo>('termos')
  const buscar = useCallback(() => fonte.documentos(), [fonte])
  const docs = useCarregar(buscar)
  const buscarSite = useCallback(() => fonte.site(), [fonte])
  const site = useCarregar(buscarSite)
  const versoes = useMemo(() => (docs.dados ?? []).filter((d) => d.tipo === tipo), [docs.dados, tipo])
  const atual = versoes[0]
  const [texto, setTexto] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [publicando, setPublicando] = useState(false)
  useEffect(() => setTexto(atual?.texto ?? ''), [atual])

  if (!docs.dados) return <Skeleton className="h-96" />
  const faltando = site.dados ? OBRIGATORIOS.filter((o) => !site.dados!.conteudo[o.chave]?.trim()) : []
  const mudou = texto.trim() !== (atual?.texto ?? '')

  async function publicar() {
    setPublicando(true)
    try {
      const versao = await fonte.publicarDocumento(tipo, texto)
      await docs.recarregar()
      toast(`${TITULO[tipo]} publicados. Versão ${versao}.`)
      setConfirmar(false)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setPublicando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {faltando.length > 0 && (
        <div className="flex gap-3 rounded-[14px] border border-[#f5d9a8] bg-[#fff8eb] p-4 text-[13px] text-[#7a4b00]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            Falta preencher em <b>Site &gt; Empresa e atendimento</b>: {faltando.map((f) => f.rotulo).join(', ')}. A lei pede que o site mostre quem vende (nome, documento e endereço) e um
            contato para assuntos de dados pessoais. Enquanto isso, os textos mostram "(a informar)".
          </p>
        </div>
      )}
      <Segmentado
        rotulo="Documento"
        valor={tipo}
        onChange={setTipo}
        opcoes={[
          { valor: 'termos', rotulo: 'Termos de Uso' },
          { valor: 'privacidade', rotulo: 'Política de Privacidade' },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardTitulo
            acao={
              <a href={linkDocumento(tipo)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline">
                Ver no site <ExternalLink size={14} aria-hidden />
              </a>
            }
          >
            {TITULO[tipo]}
          </CardTitulo>
          <Texto label="Texto" rows={22} value={texto} onChange={(e) => setTexto(e.target.value)} className="[&_textarea]:font-mono [&_textarea]:text-[13px] [&_textarea]:font-normal" />
          <p className="mt-2 text-[12px] leading-relaxed text-ink-2">
            Use <b>## Título</b> para seções e <b>- texto</b> para itens de lista. Os campos <b>{'{{empresa.nome}}'}</b>, <b>{'{{empresa.cnpj}}'}</b>, <b>{'{{empresa.endereco}}'}</b>,{' '}
            <b>{'{{contato.email}}'}</b>, <b>{'{{contato.whatsapp}}'}</b> e <b>{'{{atendimento.horario}}'}</b> são trocados pelo que está em Site &gt; Empresa e atendimento.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button icone={<FileCheck2 size={16} />} disabled={!mudou || texto.trim().length < 100} onClick={() => setConfirmar(true)}>
              Publicar nova versão
            </Button>
            {mudou && (
              <Button variante="secundario" onClick={() => setTexto(atual?.texto ?? '')}>
                Desfazer mudanças
              </Button>
            )}
          </div>
        </Card>
        <Card>
          <CardTitulo>Versões</CardTitulo>
          <ul className="flex flex-col divide-y divide-line">
            {versoes.map((v, i) => (
              <li key={v.id} className="py-3 first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">Versão {v.versao}</span>
                  {i === 0 ? <Badge tom="verde">Em vigor</Badge> : <Badge>Antiga</Badge>}
                </div>
                <p className="mt-0.5 text-[12px] text-ink-2">
                  {dataHora(v.publicadoEm)} · {v.publicadoPor || 'sistema'} · {v.aceites} {v.aceites === 1 ? 'aceite' : 'aceites'}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-2">As versões antigas ficam guardadas: elas provam o que cada cliente aceitou e quando.</p>
        </Card>
      </div>
      <Modal
        aberto={confirmar}
        onFechar={() => setConfirmar(false)}
        titulo={`Publicar ${TITULO[tipo]}?`}
        rodape={
          <>
            <Button variante="secundario" onClick={() => setConfirmar(false)}>
              Voltar
            </Button>
            <Button carregando={publicando} onClick={publicar}>
              Publicar
            </Button>
          </>
        }
      >
        <p className="text-[14px]">
          O texto novo aparece no site na hora, e todos os clientes vão precisar ler e aceitar de novo na próxima vez que abrirem o sistema. Mudanças grandes merecem a revisão de um advogado
          antes.
        </p>
      </Modal>
    </div>
  )
}
