// Páginas para salvar em PDF ou imprimir: o relatório do mês (para o contador, o banco ou guardar) e
// o recibo de um recebimento. "Salvar em PDF" usa a impressão do próprio navegador ou celular.
import { ArrowLeft, Printer, Share2 } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { LogoMarca } from '../components/layout/Logo'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Modal'
import { useStore } from '../data/store'
import { contasAbertas, gastosPorCategoria, receitasPorCategoria, resumoMes, situacaoMei } from '../domain/calc'
import { dataDoRecibo, numeroDoRecibo, podeTerRecibo, textoRecibo, valorPorExtenso } from '../domain/recibo'
import type { Lancamento } from '../domain/types'
import { brl, dataBR, mesAno, mesDe } from '../lib/format'

/** Na folha impressa o valor aparece sempre, mesmo com "esconder valores" ligado. */
const r = (c: number) => brl(c, { centavos: true, sempre: true })

function Barra({ titulo, children }: { titulo: string; children?: ReactNode }) {
  const navigate = useNavigate()
  useEffect(() => {
    const antes = document.title
    document.title = titulo
    return () => {
      document.title = antes
    }
  }, [titulo])
  return (
    <div className="nao-imprimir sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-[800px] flex-wrap items-center gap-2">
        <button onClick={() => navigate(-1)} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-2.5 text-[14px] font-semibold text-ink-2 hover:bg-hover hover:text-ink">
          <ArrowLeft size={17} aria-hidden /> Voltar
        </button>
        <span className="flex-1" />
        {children}
        <Button onClick={() => window.print()}>
          <Printer size={17} aria-hidden /> Salvar em PDF
        </Button>
      </div>
      <p className="mx-auto mt-1.5 max-w-[800px] text-right text-[12px] text-ink-2">Na janela que abrir, escolha "Salvar como PDF" no lugar da impressora.</p>
    </div>
  )
}

function Cabecalho({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  const { dados } = useStore()
  const e = dados.empresa
  return (
    <header className="folha-cabecalho">
      <div>
        <p className="folha-negocio">{e.nomeFantasia}</p>
        <p className="folha-miudo">
          {[e.cnpj && `CNPJ ${e.cnpj}`, e.municipio ? `${e.municipio}/${e.uf}` : e.uf].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="folha-direita">
        <p className="folha-titulo">{titulo}</p>
        <p className="folha-miudo">{subtitulo}</p>
      </div>
    </header>
  )
}

function Rodape() {
  const { hoje } = useStore()
  return (
    <footer className="folha-rodape">
      <LogoMarca size={16} /> Feito no Gynfinance em {dataBR(hoje)}
    </footer>
  )
}

function Tabela({ titulo, linhas, total, vazio }: { titulo: string; linhas: [string, number][]; total?: number; vazio: string }) {
  return (
    <section className="folha-secao">
      <h2>{titulo}</h2>
      {linhas.length ? (
        <table>
          <tbody>
            {linhas.map(([k, v], i) => (
              <tr key={`${k}${i}`}>
                <td>{k}</td>
                <td className="num">{r(v)}</td>
              </tr>
            ))}
          </tbody>
          {total !== undefined && (
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{r(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      ) : (
        <p className="folha-miudo">{vazio}</p>
      )}
    </section>
  )
}

export function RelatorioImpresso() {
  const { dados, mes: mesAtual, hoje } = useStore()
  const [busca] = useSearchParams()
  const mes = busca.get('mes') ?? mesAtual
  const res = resumoMes(dados.lancamentos, mes)
  const receitas = receitasPorCategoria(dados.lancamentos, dados.categorias, mes)
  const despesas = gastosPorCategoria(dados.lancamentos, dados.categorias, mes)
  const nomeCat = (id?: string) => dados.categorias.find((c) => c.id === id)?.nome ?? ''
  const nomeConta = (l: Lancamento) => l.descricao || l.contraparte || nomeCat(l.categoriaId) || 'Sem descrição'
  const doMes = dados.lancamentos
    .filter((l) => l.situacao === 'realizado' && l.dataPagamento && mesDe(l.dataPagamento) === mes && l.natureza !== 'transferencia')
    .sort((a, b) => a.dataPagamento!.localeCompare(b.dataPagamento!))
  const aReceber = contasAbertas(dados.lancamentos, 'receber')
  const aPagar = contasAbertas(dados.lancamentos, 'pagar')
  const somar = (ls: Lancamento[]) => ls.reduce((t, l) => t + l.valor, 0)
  const mei = dados.empresa.ehMei ? situacaoMei(dados, hoje) : null
  const titulo = `Relatório de ${mesAno(mes)}`
  return (
    <div className="min-h-dvh bg-bg">
      <Barra titulo={`${dados.empresa.nomeFantasia} · ${titulo}`} />
      <article className="folha">
        <Cabecalho titulo={titulo} subtitulo="Dinheiro que entrou e saiu no mês" />

        <section className="folha-resumo">
          {(
            [
              ['Entrou', res.entrou],
              ['Saiu', res.saiu],
              ['Sobrou', res.sobrou],
              ['Tirei para mim', res.retirei],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <p className="folha-miudo">{k}</p>
              <p className="folha-valor">{r(v)}</p>
            </div>
          ))}
        </section>

        <div className="folha-duas">
          <Tabela titulo="Entradas por categoria" linhas={receitas.map((c) => [c.nome, c.valor])} total={res.entrou} vazio="Nenhuma entrada no mês." />
          <Tabela titulo="Saídas por categoria" linhas={despesas.map((c) => [c.nome, c.valor])} total={res.saiu} vazio="Nenhuma saída no mês." />
        </div>

        <div className="folha-duas">
          <Tabela
            titulo="A receber (em aberto)"
            linhas={aReceber.slice(0, 12).map((l) => [`${dataBR(l.dataVencimento!)} · ${nomeConta(l)}${l.dataVencimento! < hoje ? ' (atrasada)' : ''}`, l.valor])}
            total={aReceber.length ? somar(aReceber) : undefined}
            vazio="Nada a receber."
          />
          <Tabela
            titulo="A pagar (em aberto)"
            linhas={aPagar.slice(0, 12).map((l) => [`${dataBR(l.dataVencimento!)} · ${nomeConta(l)}${l.dataVencimento! < hoje ? ' (atrasada)' : ''}`, l.valor])}
            total={aPagar.length ? somar(aPagar) : undefined}
            vazio="Nada a pagar."
          />
        </div>

        {mei && (
          <section className="folha-secao">
            <h2>Limite do MEI em {mei.ano}</h2>
            <p>
              Faturado no ano: <strong>{r(mei.faturado)}</strong> de {r(mei.limite)} ({Math.round(mei.usado * 100)}%). Ainda pode faturar {r(mei.restante)}.
            </p>
          </section>
        )}

        <section className="folha-secao folha-quebra">
          <h2>Lançamentos do mês</h2>
          {doMes.length ? (
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {doMes.map((l) => (
                  <tr key={l.id}>
                    <td>{dataBR(l.dataPagamento!).slice(0, 5)}</td>
                    <td>{l.descricao || l.contraparte || '—'}</td>
                    <td>{nomeCat(l.categoriaId) || (l.natureza === 'retirada' ? 'Retirada' : '')}</td>
                    <td className={`num ${l.natureza === 'entrada' ? 'folha-entrada' : ''}`}>
                      {l.natureza === 'entrada' ? '+' : '−'} {r(l.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="folha-miudo">Nenhum lançamento pago ou recebido no mês.</p>
          )}
        </section>
        <Rodape />
      </article>
    </div>
  )
}

export function ReciboImpresso() {
  const { dados } = useStore()
  const { id } = useParams()
  const toast = useToast()
  const l = dados.lancamentos.find((x) => x.id === id)
  if (!l || !podeTerRecibo(l)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
        <p className="text-[16px] font-bold text-ink">Recibo não encontrado</p>
        <p className="text-[14px] text-ink-2">Só dá para fazer recibo de um valor que já foi recebido.</p>
        <Link to="/lancamentos" className="font-semibold text-primary hover:underline">
          Ir para Lançamentos
        </Link>
      </div>
    )
  }
  const e = dados.empresa
  const texto = textoRecibo(l, e)
  const compartilhar = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: texto })
        return
      } catch {
        /* cancelou: tenta o WhatsApp */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
    toast('Abrimos o WhatsApp com o recibo. É só escolher o cliente.')
  }
  return (
    <div className="min-h-dvh bg-bg">
      <Barra titulo={`Recibo ${numeroDoRecibo(l)} · ${e.nomeFantasia}`}>
        <Button variante="secundario" onClick={compartilhar}>
          <Share2 size={17} aria-hidden /> Mandar pelo WhatsApp
        </Button>
      </Barra>
      <article className="folha folha-recibo">
        <Cabecalho titulo={`Recibo nº ${numeroDoRecibo(l)}`} subtitulo={dataBR(dataDoRecibo(l))} />
        <p className="folha-valor-recibo">{r(l.valor)}</p>
        <p className="folha-texto">
          Recebi{l.contraparte ? (
            <>
              {' '}
              de <strong>{l.contraparte}</strong>
            </>
          ) : null}{' '}
          a importância de <strong>{r(l.valor)}</strong> ({valorPorExtenso(l.valor)})
          {l.descricao ? (
            <>
              , referente a <strong>{l.descricao}</strong>
            </>
          ) : null}
          .
        </p>
        <p className="folha-texto">
          {e.municipio ? `${e.municipio}/${e.uf}, ` : ''}
          {dataBR(dataDoRecibo(l))}.
        </p>
        <div className="folha-assinatura">
          <span />
          <p>
            <strong>{e.nomeDono}</strong>
          </p>
          <p className="folha-miudo">
            {e.nomeFantasia}
            {e.cnpj ? ` · CNPJ ${e.cnpj}` : ''}
          </p>
        </div>
        <p className="folha-miudo folha-aviso">Este recibo não substitui a nota fiscal.</p>
        <Rodape />
      </article>
    </div>
  )
}
