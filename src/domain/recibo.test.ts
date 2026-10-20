import { describe, expect, it } from 'vitest'
import { numeroPorExtenso, textoRecibo, valorPorExtenso } from './recibo'
import type { Empresa, Lancamento } from './types'

describe('valor por extenso', () => {
  it('escreve números comuns', () => {
    expect(numeroPorExtenso(1)).toBe('um')
    expect(numeroPorExtenso(15)).toBe('quinze')
    expect(numeroPorExtenso(21)).toBe('vinte e um')
    expect(numeroPorExtenso(100)).toBe('cem')
    expect(numeroPorExtenso(101)).toBe('cento e um')
    expect(numeroPorExtenso(999)).toBe('novecentos e noventa e nove')
    expect(numeroPorExtenso(1000)).toBe('mil')
    expect(numeroPorExtenso(1005)).toBe('mil e cinco')
    expect(numeroPorExtenso(1100)).toBe('mil e cem')
    expect(numeroPorExtenso(1250)).toBe('mil duzentos e cinquenta')
    expect(numeroPorExtenso(2000)).toBe('dois mil')
    expect(numeroPorExtenso(21300)).toBe('vinte e um mil e trezentos')
    expect(numeroPorExtenso(1_000_000)).toBe('um milhão')
    expect(numeroPorExtenso(2_500_000)).toBe('dois milhões e quinhentos mil')
  })
  it('escreve reais e centavos', () => {
    expect(valorPorExtenso(100)).toBe('um real')
    expect(valorPorExtenso(1)).toBe('um centavo')
    expect(valorPorExtenso(12550)).toBe('cento e vinte e cinco reais e cinquenta centavos')
    expect(valorPorExtenso(100000000)).toBe('um milhão de reais')
    expect(valorPorExtenso(0)).toBe('zero reais')
  })
})

describe('recibo', () => {
  it('monta o texto para o WhatsApp com valor, cliente e referência', () => {
    const l = { id: 'l1', natureza: 'entrada', situacao: 'realizado', valor: 15000, dataCompetencia: '2026-10-10', dataPagamento: '2026-10-12', contraparte: 'Maria', descricao: 'bolo de aniversário' } as Lancamento
    const e = { nomeFantasia: 'Doces da Ana', cnpj: '12.345.678/0001-90' } as Empresa
    const t = textoRecibo(l, e)
    expect(t).toContain('Doces da Ana recebeu de Maria o valor de R$ 150,00 (cento e cinquenta reais), referente a bolo de aniversário.')
    expect(t).toContain('Data: 12/10/2026')
    expect(t).toContain('CNPJ: 12.345.678/0001-90')
  })
})
