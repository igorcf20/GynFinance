import { describe, expect, it } from 'vitest'
import { brl, lerValor, textoSeguro } from './format'

describe('valores em centavos', () => {
  it('lê o que a pessoa digita', () => {
    expect(lerValor('1.234,56')).toBe(123456)
    expect(lerValor('1234,5')).toBe(123450)
    expect(lerValor('R$ 50')).toBe(5000)
    expect(lerValor('1.500')).toBe(150000)
    expect(lerValor('99.90')).toBe(9990)
    expect(lerValor('0,1')).toBe(10)
    expect(lerValor('')).toBe(0)
  })
  it('soma sem erro de ponto flutuante', () => {
    expect(lerValor('0,1') + lerValor('0,2')).toBe(30)
  })
  it('formata em reais', () => {
    expect(brl(248000)).toBe('R$ 2.480')
    expect(brl(9990)).toBe('R$ 99,90')
    expect(brl(35000, { centavos: true })).toBe('R$ 350,00')
  })
})

describe('textoSeguro', () => {
  it('não deixa texto virar fórmula no Excel', () => {
    expect(textoSeguro('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`)
    expect(textoSeguro('-2+3')).toBe(`'-2+3`)
    expect(textoSeguro('@SUM(A1)')).toBe(`'@SUM(A1)`)
    expect(textoSeguro('Pix recebido')).toBe('Pix recebido')
  })
})
