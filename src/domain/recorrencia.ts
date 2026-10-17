// Contas fixas: a Recorrencia guarda a regra; o gerador cria os lançamentos previstos.
// Ideia de separar regra e lançamento gerado veio do Firefly III; o código é próprio.
import { addDays, format, getDay, lastDayOfMonth, parseISO } from 'date-fns'
import { addMeses, mesDe } from '../lib/format'
import type { DataISO, Lancamento, MesISO, Recorrencia, SeFimDeSemana } from './types'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** Sábado ou domingo vão para a sexta anterior (antecipar) ou a segunda seguinte (adiar). Feriados ficam fora por enquanto. */
export function ajustarFimDeSemana(data: DataISO, regra: SeFimDeSemana): DataISO {
  if (regra === 'manter') return data
  const d = parseISO(data)
  const dia = getDay(d) // 0 = domingo, 6 = sábado
  if (dia !== 0 && dia !== 6) return data
  if (regra === 'antecipar') return iso(addDays(d, dia === 6 ? -1 : -2))
  return iso(addDays(d, dia === 6 ? 2 : 1))
}

/** Data nominal da conta no mês (dia 31 em fevereiro vira o último dia). */
export function dataNominal(rec: Recorrencia, mes: MesISO): DataISO {
  const ultimo = lastDayOfMonth(parseISO(`${mes}-01`)).getDate()
  return `${mes}-${String(Math.min(rec.diaVencimento, ultimo)).padStart(2, '0')}`
}

/** Vencimento real no mês, já com a regra de fim de semana. */
export function vencimentoNoMes(rec: Recorrencia, mes: MesISO): DataISO {
  return ajustarFimDeSemana(dataNominal(rec, mes), rec.seFimDeSemana)
}

/** Até onde o gerador cria previstos: o fim do mês seguinte a hoje. */
export function limiteGeracao(hoje: DataISO): DataISO {
  return iso(lastDayOfMonth(parseISO(`${addMeses(mesDe(hoje), 1)}-01`)))
}

const chave = (recorrenciaId: string, mes: MesISO) => `${recorrenciaId}|${mes}`

/**
 * Cria os lançamentos previstos que faltam até o fim do mês seguinte.
 * Nunca gera duas vezes a mesma competência (recorrência + mês), mesmo que já esteja paga.
 */
export function gerarPrevistos(
  recorrencias: Recorrencia[],
  lancamentos: Lancamento[],
  hoje: DataISO,
  novoId: () => string,
): { novos: Lancamento[]; recorrencias: Recorrencia[] } {
  const existentes = new Set(lancamentos.filter((l) => l.recorrenciaId && l.situacao !== 'cancelado').map((l) => chave(l.recorrenciaId!, mesDe(l.dataCompetencia))))
  const limite = limiteGeracao(hoje)
  const novos: Lancamento[] = []

  const atualizadas = recorrencias.map((rec) => {
    if (!rec.ativa) return rec
    let mes = rec.ultimaGeracao ? addMeses(mesDe(rec.ultimaGeracao), 1) : mesDe(rec.inicio)
    let ultima = rec.ultimaGeracao
    for (let guarda = 0; guarda < 36; guarda++, mes = addMeses(mes, 1)) {
      const nominal = dataNominal(rec, mes)
      if (nominal > limite || (rec.fim && nominal > rec.fim)) break
      if (nominal < rec.inicio) continue
      ultima = nominal
      if (existentes.has(chave(rec.id, mes))) continue
      existentes.add(chave(rec.id, mes))
      novos.push({
        ...rec.modelo,
        id: novoId(),
        empresaId: rec.empresaId,
        situacao: 'previsto',
        dataCompetencia: nominal,
        dataVencimento: vencimentoNoMes(rec, mes),
        notaEmitida: rec.modelo.natureza === 'entrada' ? 'nao' : 'nao_se_aplica',
        recorrenciaId: rec.id,
      })
    }
    return ultima === rec.ultimaGeracao ? rec : { ...rec, ultimaGeracao: ultima }
  })
  return { novos, recorrencias: atualizadas }
}
