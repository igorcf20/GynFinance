import type { ParametroMei } from './types'

// Valores do MEI por ano. Ficam aqui, fora das telas, para serem trocados sem mexer no resto.
// A confirmar antes do lançamento: limite de 2027 (há projeto de lei para aumentar) e salário mínimo.
export const PARAMETROS_MEI: ParametroMei[] = [
  {
    ano: 2026,
    limiteAnual: 81000,
    limiteMensalProporcional: 6750,
    salarioMinimo: 1621,
    // 5% do salário mínimo (INSS) + R$ 1 de ICMS (comércio/indústria) e/ou R$ 5 de ISS (serviço)
    dasValorPorAtividade: { comercio: 82.05, industria: 82.05, servico: 86.05, misto: 87.05 },
    dasDiaVencimento: 20,
  },
]

export function parametroDoAno(ano: number): ParametroMei {
  const exato = PARAMETROS_MEI.find((p) => p.ano === ano)
  if (exato) return exato
  // Sem parâmetro para o ano: usa o mais recente conhecido.
  return [...PARAMETROS_MEI].sort((a, b) => b.ano - a.ano)[0]
}

export const LINKS = {
  pgmei: 'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao',
  nfse: 'https://www.nfse.gov.br/EmissorNacional',
  nfe: 'https://www.nfe.fazenda.gov.br/portal/principal.aspx',
  dasn: 'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app/Identificacao',
}
