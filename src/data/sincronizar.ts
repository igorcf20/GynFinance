// O que mudou entre dois estados do app, no formato que o servidor grava (POST /api/sincronizar).
// As ações do store trocam objetos inteiros sem mexer nos antigos, então basta comparar
// as referências para saber o que foi criado, alterado ou apagado.
import type { Atendimento, Dados, Empresa, Lancamento, PagamentoDas, Preferencias, Recorrencia } from '../domain/types'

export interface Mudancas {
  empresa?: Omit<Empresa, 'id'>
  preferencias?: Preferencias
  lancamentos?: { salvar: Lancamento[]; excluir: string[] }
  recorrencias?: { salvar: Recorrencia[] }
  pagamentosDas?: { salvar: PagamentoDas[] }
  atendimentos?: { salvar: Atendimento[]; excluir: string[] }
  avisosDispensados?: string[]
}

function porId<T>(lista: T[], id: (x: T) => string): Map<string, T> {
  return new Map(lista.map((x) => [id(x), x]))
}

export function diferencas(antes: Dados, depois: Dados): Mudancas | null {
  const m: Mudancas = {}
  if (antes.empresa !== depois.empresa) {
    const { id: _, ...resto } = depois.empresa
    m.empresa = resto
  }
  if (antes.preferencias !== depois.preferencias) m.preferencias = depois.preferencias

  if (antes.lancamentos !== depois.lancamentos) {
    const velhos = porId(antes.lancamentos, (l) => l.id)
    const novos = porId(depois.lancamentos, (l) => l.id)
    const salvar = depois.lancamentos.filter((l) => velhos.get(l.id) !== l)
    const excluir = antes.lancamentos.filter((l) => !novos.has(l.id)).map((l) => l.id)
    if (salvar.length || excluir.length) m.lancamentos = { salvar, excluir }
  }
  if (antes.recorrencias !== depois.recorrencias) {
    const velhas = porId(antes.recorrencias, (r) => r.id)
    const salvar = depois.recorrencias.filter((r) => velhas.get(r.id) !== r)
    if (salvar.length) m.recorrencias = { salvar }
  }
  if (antes.pagamentosDas !== depois.pagamentosDas) {
    const velhos = porId(antes.pagamentosDas, (p) => p.competencia)
    const salvar = depois.pagamentosDas.filter((p) => velhos.get(p.competencia) !== p)
    if (salvar.length) m.pagamentosDas = { salvar }
  }
  if (antes.atendimentos !== depois.atendimentos) {
    const velhos = porId(antes.atendimentos ?? [], (a) => a.id)
    const novos = porId(depois.atendimentos ?? [], (a) => a.id)
    const salvar = (depois.atendimentos ?? []).filter((a) => velhos.get(a.id) !== a)
    const excluir = (antes.atendimentos ?? []).filter((a) => !novos.has(a.id)).map((a) => a.id)
    if (salvar.length || excluir.length) m.atendimentos = { salvar, excluir }
  }
  const dispensados = new Set(antes.avisosDispensados ?? [])
  const novosAvisos = (depois.avisosDispensados ?? []).filter((a) => !dispensados.has(a))
  if (novosAvisos.length) m.avisosDispensados = novosAvisos

  return Object.keys(m).length ? m : null
}

/** Junta mudanças que esperam na fila, para mandar tudo de uma vez. */
export function juntar(a: Mudancas, b: Mudancas): Mudancas {
  const ultimoPorId = <T>(xs: T[], id: (x: T) => string) => [...porId(xs, id).values()]
  const r: Mudancas = { ...a, ...b }
  if (a.lancamentos || b.lancamentos) {
    const excluir = new Set([...(a.lancamentos?.excluir ?? []), ...(b.lancamentos?.excluir ?? [])])
    const salvar = ultimoPorId([...(a.lancamentos?.salvar ?? []), ...(b.lancamentos?.salvar ?? [])], (l) => l.id)
    // Criado e apagado antes de chegar ao servidor: não manda nenhum dos dois.
    r.lancamentos = { salvar: salvar.filter((l) => !(b.lancamentos?.excluir ?? []).includes(l.id)), excluir: [...excluir] }
  }
  if (a.recorrencias || b.recorrencias) r.recorrencias = { salvar: ultimoPorId([...(a.recorrencias?.salvar ?? []), ...(b.recorrencias?.salvar ?? [])], (x) => x.id) }
  if (a.pagamentosDas || b.pagamentosDas)
    r.pagamentosDas = { salvar: ultimoPorId([...(a.pagamentosDas?.salvar ?? []), ...(b.pagamentosDas?.salvar ?? [])], (x) => x.competencia) }
  if (a.atendimentos || b.atendimentos) {
    const salvar = ultimoPorId([...(a.atendimentos?.salvar ?? []), ...(b.atendimentos?.salvar ?? [])], (x) => x.id)
    r.atendimentos = {
      salvar: salvar.filter((x) => !(b.atendimentos?.excluir ?? []).includes(x.id)),
      excluir: [...new Set([...(a.atendimentos?.excluir ?? []), ...(b.atendimentos?.excluir ?? [])])],
    }
  }
  if (a.avisosDispensados || b.avisosDispensados) r.avisosDispensados = [...new Set([...(a.avisosDispensados ?? []), ...(b.avisosDispensados ?? [])])]
  return r
}

/** Corpo de POST /api/negocio: o negócio recém-configurado, sem lançamentos. */
export function paraNovoNegocio(d: Dados) {
  return {
    empresa: d.empresa,
    contas: d.contas.map(({ empresaId: _, ...k }) => k),
    categoriasDesativadas: d.categorias.filter((c) => !c.ativa).map((c) => c.id),
    pagamentosDas: d.pagamentosDas.map(({ empresaId: _, ...p }) => p),
    preferencias: d.preferencias,
  }
}
