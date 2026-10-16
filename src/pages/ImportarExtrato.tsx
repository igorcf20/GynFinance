import { ArrowDownLeft, ArrowUpRight, CheckCircle2, FileUp, Info, Link2, RotateCcw } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Explica } from '../components/ui/Explica'
import { Select } from '../components/ui/Field'
import { useToast } from '../components/ui/Modal'
import { Segmentado } from '../components/ui/Tabs'
import { decodificar, ErroExtrato, lerExtrato, prepararImportacao, type LinhaImportacao } from '../domain/extrato'
import { useStore } from '../data/store'
import { brl, dataBR } from '../lib/format'

type Filtro = 'todos' | 'novos' | 'contas' | 'repetidos'
const LIMITE_ARQUIVO = 5 * 1024 * 1024

/** Importar o extrato do banco: lê o arquivo, mostra o que vai entrar e grava de uma vez (com Desfazer). */
export function ImportarExtrato() {
  const { dados, importarExtrato } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const contas = dados.contas.filter((c) => c.ativa)
  const [contaId, setContaId] = useState(contas.find((c) => c.tipo === 'banco')?.id ?? contas[0]?.id ?? '')
  const [arquivo, setArquivo] = useState('')
  const [linhas, setLinhas] = useState<LinhaImportacao[] | null>(null)
  const [erro, setErro] = useState('')
  const [lendo, setLendo] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [feito, setFeito] = useState<{ novos: number; baixas: number } | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  const ler = async (f: File | undefined) => {
    if (!f) return
    setErro('')
    if (f.size > LIMITE_ARQUIVO) return setErro('O arquivo passa de 5 MB. Exporte um período menor, como um mês.')
    setLendo(true)
    try {
      const texto = decodificar(await f.arrayBuffer())
      const movs = lerExtrato(f.name, texto)
      setArquivo(f.name)
      setLinhas(prepararImportacao(dados, contaId, movs))
      setFiltro('todos')
      setFeito(null)
    } catch (e) {
      setErro(e instanceof ErroExtrato ? e.message : 'Não conseguimos ler este arquivo. Confira se é o extrato em OFX ou CSV.')
    } finally {
      setLendo(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  // Trocar a conta refaz a comparação com o que já está no sistema.
  const trocarConta = (id: string) => {
    setContaId(id)
    if (linhas) setLinhas(prepararImportacao(dados, id, linhas.map((l) => l.mov)))
  }

  const mudar = (i: number, m: Partial<LinhaImportacao>) => setLinhas((ls) => ls && ls.map((l, j) => (j === i ? { ...l, ...m } : l)))

  const resumo = useMemo(() => {
    const ls = linhas ?? []
    const marcadas = ls.filter((l) => l.incluir && l.acao !== 'repetido')
    return {
      novos: ls.filter((l) => l.acao === 'novo').length,
      contas: ls.filter((l) => l.acao === 'baixar').length,
      repetidos: ls.filter((l) => l.acao === 'repetido').length,
      marcadas: marcadas.length,
      entrou: marcadas.filter((l) => l.mov.valor > 0).reduce((t, l) => t + l.mov.valor, 0),
      saiu: marcadas.filter((l) => l.mov.valor < 0).reduce((t, l) => t - l.mov.valor, 0),
      de: ls[0]?.mov.data,
      ate: ls[ls.length - 1]?.mov.data,
    }
  }, [linhas])

  const importar = () => {
    if (!linhas || !resumo.marcadas) return
    const escolhidas = linhas.filter((l) => l.incluir && l.acao !== 'repetido')
    const desfazer = importarExtrato(contaId, escolhidas)
    const r = { novos: escolhidas.filter((l) => l.acao === 'novo').length, baixas: escolhidas.filter((l) => l.acao === 'baixar').length }
    setFeito(r)
    setLinhas(null)
    toast(`${resumo.marcadas} movimento${resumo.marcadas === 1 ? '' : 's'} do extrato importado${resumo.marcadas === 1 ? '' : 's'}.`, {
      desfazer: () => {
        desfazer()
        setFeito(null)
      },
    })
  }

  const visiveis = (linhas ?? [])
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => filtro === 'todos' || (filtro === 'novos' && l.acao === 'novo') || (filtro === 'contas' && l.acao === 'baixar') || (filtro === 'repetidos' && l.acao === 'repetido'))

  return (
    <>
      <Header titulo="Importar extrato" subtitulo="Traga as entradas e saídas do banco sem digitar uma por uma." />

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          {feito && (
            <Card className="anim-entrar flex flex-col items-start gap-3 !border-[#c6ebd7] !bg-gradient-to-r !from-[#ecf9f2] !to-[#f4fbf7] sm:flex-row sm:items-center">
              <CheckCircle2 size={28} className="shrink-0 text-success" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-ink">Extrato importado.</p>
                <p className="text-[14px] text-ink-2">
                  {feito.novos} lançamento{feito.novos === 1 ? '' : 's'} novo{feito.novos === 1 ? '' : 's'}
                  {feito.baixas ? ` e ${feito.baixas} conta${feito.baixas === 1 ? '' : 's'} marcada${feito.baixas === 1 ? '' : 's'} como paga${feito.baixas === 1 ? '' : 's'} ou recebida${feito.baixas === 1 ? '' : 's'}` : ''}. O painel já
                  está atualizado.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variante="secundario" onClick={() => navigate('/lancamentos')}>
                  Ver lançamentos
                </Button>
                <Button onClick={() => navigate('/')}>Ver o painel</Button>
              </div>
            </Card>
          )}

          <Card className="flex flex-col gap-4">
            <Select label="Conta do extrato" value={contaId} onChange={(e) => trocarConta(e.target.value)} opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setArrastando(true)
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault()
                setArrastando(false)
                void ler(e.dataTransfer.files[0])
              }}
              className={`flex flex-col items-center gap-3 rounded-[16px] border-[1.5px] border-dashed px-5 py-8 text-center transition-colors ${
                arrastando ? 'border-primary bg-primary-soft' : 'border-primary-line bg-primary-soft/30'
              }`}
            >
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-gradient-to-b from-[#eef4ff] to-[#dde9fd] text-primary">
                <FileUp size={22} aria-hidden />
              </span>
              <div>
                <p className="text-[15px] font-bold text-ink">{arquivo && linhas ? arquivo : 'Arraste o arquivo do extrato aqui'}</p>
                <p className="text-[13px] text-ink-2">OFX (recomendado) ou CSV, até 5 MB.</p>
              </div>
              <Button variante={linhas ? 'secundario' : 'primario'} carregando={lendo} onClick={() => entrada.current?.click()}>
                {linhas ? 'Escolher outro arquivo' : 'Escolher arquivo'}
              </Button>
              <input ref={entrada} type="file" accept=".ofx,.qfx,.csv,.txt,text/csv" className="hidden" aria-label="Arquivo do extrato" onChange={(e) => void ler(e.target.files?.[0])} />
            </div>
            {erro && (
              <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13px] text-[#9b1c2e]">
                {erro}
              </p>
            )}
          </Card>

          {linhas && (
            <Card className="anim-entrar !px-3 sm:!px-5">
              <div className="mb-3 flex flex-col gap-3 px-1 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-1 text-[17px] font-bold text-ink">
                    Confira antes de importar
                    <Explica titulo="Como o sistema confere o extrato">
                      Cada movimento é comparado com o que já está lançado nesta conta. Se já existe um lançamento com o mesmo dia, valor e tipo, ele fica de fora
                      para não contar duas vezes. Se há uma conta a pagar ou a receber em aberto com o mesmo valor e vencimento até 7 dias de distância, o movimento
                      marca essa conta como paga. O resto vira lançamento novo, com a categoria que você usou da última vez para o mesmo texto.
                    </Explica>
                  </h2>
                  {resumo.de && (
                    <p className="text-[13px] text-ink-2">
                      {linhas.length} movimentos de {dataBR(resumo.de)} a {dataBR(resumo.ate!)}
                    </p>
                  )}
                </div>
              </div>
              <Segmentado
                rotulo="Mostrar"
                valor={filtro}
                onChange={setFiltro}
                className="mb-2 w-full overflow-x-auto sm:w-auto"
                opcoes={[
                  { valor: 'todos', rotulo: 'Todos', contagem: linhas.length },
                  { valor: 'novos', rotulo: 'Novos', contagem: resumo.novos },
                  { valor: 'contas', rotulo: 'Pagam contas', contagem: resumo.contas },
                  { valor: 'repetidos', rotulo: 'Já lançados', contagem: resumo.repetidos },
                ]}
              />
              <ul className="divide-y divide-line">
                {visiveis.map(({ l, i }) => (
                  <LinhaExtrato key={l.mov.ref} l={l} onMudar={(m) => mudar(i, m)} />
                ))}
                {!visiveis.length && <li className="px-2 py-6 text-center text-[14px] text-ink-2">Nada neste filtro.</li>}
              </ul>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4 md:gap-5">
          {linhas ? (
            <Card className="flex flex-col gap-3 xl:sticky xl:top-6">
              <h2 className="text-[16px] font-bold text-ink">Vai entrar no sistema</h2>
              <dl className="num flex flex-col gap-2 text-[14px]">
                <div className="flex justify-between">
                  <dt className="text-ink-2">Entradas</dt>
                  <dd className="font-bold text-success">+{brl(resumo.entrou, { centavos: true })}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-2">Saídas</dt>
                  <dd className="font-bold text-ink">−{brl(resumo.saiu, { centavos: true })}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <dt className="text-ink-2">Movimentos marcados</dt>
                  <dd className="font-bold text-ink">{resumo.marcadas}</dd>
                </div>
              </dl>
              {resumo.repetidos > 0 && <p className="text-[12.5px] text-ink-2">{resumo.repetidos} já estavam lançados e ficam de fora.</p>}
              <Button onClick={importar} disabled={!resumo.marcadas}>
                Importar {resumo.marcadas} movimento{resumo.marcadas === 1 ? '' : 's'}
              </Button>
              <Button variante="discreto" icone={<RotateCcw size={15} />} onClick={() => setLinhas(null)}>
                Começar de novo
              </Button>
            </Card>
          ) : (
            <Card className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-[16px] font-bold text-ink">
                <Info size={18} className="text-primary" aria-hidden /> Onde pegar o arquivo
              </h2>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] text-ink-2">
                <li>No aplicativo ou site do banco, abra o extrato da conta da empresa.</li>
                <li>
                  Procure <b className="text-ink">Exportar</b> ou <b className="text-ink">Baixar extrato</b> e escolha <b className="text-ink">OFX</b> (às vezes aparece como
                  "Money" ou "Quicken"). Se não tiver, escolha CSV ou Excel salvo como CSV.
                </li>
                <li>Traga o arquivo para cá. Nada é gravado antes de você conferir.</li>
              </ol>
              <p className="text-[12.5px] text-ink-2">Pode importar o mesmo período de novo: o que já entrou é reconhecido e não duplica.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function LinhaExtrato({ l, onMudar }: { l: LinhaImportacao; onMudar: (m: Partial<LinhaImportacao>) => void }) {
  const { dados } = useStore()
  const entrada = l.mov.valor > 0
  const repetido = l.acao === 'repetido'
  const categorias = dados.categorias.filter((c) => c.ativa && (entrada ? c.grupo === 'receita' : c.grupo !== 'receita'))
  const nomePrevista = l.contaPrevista ? l.contaPrevista.descricao || l.contaPrevista.contraparte || 'conta' : ''
  return (
    <li className={`flex flex-col gap-2 px-1 py-3 sm:flex-row sm:items-center sm:gap-3 ${repetido || !l.incluir ? 'opacity-60' : ''}`}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={l.incluir && !repetido}
          disabled={repetido}
          onChange={(e) => onMudar({ incluir: e.target.checked })}
          className="size-[18px] shrink-0 accent-[var(--color-primary)]"
          aria-label={`Importar ${l.mov.descricao}`}
        />
        <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${entrada ? 'bg-success-soft text-success' : 'bg-[#fff2e6] text-[#e8640c]'}`}>
          {entrada ? <ArrowUpRight size={17} aria-hidden /> : <ArrowDownLeft size={17} aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink">{l.mov.descricao}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-2">
            {dataBR(l.mov.data)}
            {l.acao === 'baixar' && (
              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                <Link2 size={13} aria-hidden /> {entrada ? 'Recebe' : 'Paga'} a conta "{nomePrevista}"
              </span>
            )}
            {repetido && <span className="font-semibold">Já lançado{l.existente?.descricao ? `: ${l.existente.descricao}` : ''}</span>}
          </span>
        </span>
        <span className={`num shrink-0 text-[14px] font-bold ${entrada ? 'text-success' : 'text-ink'}`}>
          {entrada ? '+' : '−'}
          {brl(Math.abs(l.mov.valor), { centavos: true })}
        </span>
      </label>
      {!repetido && (
        <Select
          aria-label="Categoria"
          className="sm:w-[210px] sm:shrink-0"
          value={l.categoriaId ?? ''}
          disabled={!l.incluir}
          onChange={(e) => onMudar({ categoriaId: e.target.value })}
          opcoes={categorias.map((c) => ({ valor: c.id, rotulo: c.nome }))}
        />
      )}
    </li>
  )
}
