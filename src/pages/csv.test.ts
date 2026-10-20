import { describe, expect, it } from 'vitest'
import { dadosDemo } from '../data/demo'
import { csvDoMes } from './Transactions'

describe('CSV para o contador', () => {
  it('tem BOM, separador ; e vírgula decimal', () => {
    const d = dadosDemo()
    const internet = d.lancamentos.filter((l) => l.descricao === 'Internet' && l.situacao === 'previsto').slice(0, 1)
    const csv = csvDoMes(internet, d.categorias)
    expect(csv.startsWith('﻿')).toBe(true)
    const [cab, linha] = csv.slice(1).split('\r\n')
    expect(cab.split(';')).toContain('Grupo da categoria')
    expect(cab.split(';')).toContain('Número da nota')
    expect(linha).toContain('-99,90')
    expect(linha).toContain('Despesa fixa')
  })
})
