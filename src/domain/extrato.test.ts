import { describe, expect, it } from 'vitest'
import { dadosDemo } from '../data/demo'
import { aplicarImportacao, formaDoTexto, lerCsv, lerExtrato, lerOfx, prepararImportacao, valorComSinal } from './extrato'

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261016100000[-3:BRT]
<TRNAMT>-1200.00
<FITID>A1
<MEMO>PAGTO BOLETO IMOBILIARIA LAR
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261016
<TRNAMT>480.50
<FITID>A2
<NAME>PIX RECEBIDO
<MEMO>MARIA SOUZA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261017
<TRNAMT>-12,90
<FITID>A3
<MEMO>TARIFA PACOTE DE SERVICOS
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

describe('extrato', () => {
  it('lê valores no jeito brasileiro e americano', () => {
    expect(valorComSinal('-1.234,56')).toBe(-123456)
    expect(valorComSinal('1,234.56')).toBe(123456)
    expect(valorComSinal('R$ 50')).toBe(5000)
    expect(valorComSinal('12.5')).toBe(1250)
    expect(valorComSinal('1.500')).toBe(150000)
    expect(valorComSinal('(30,00)')).toBe(-3000)
    expect(valorComSinal('abc')).toBeNull()
  })

  it('lê OFX', () => {
    const m = lerOfx(OFX)
    expect(m).toHaveLength(3)
    expect(m[0]).toMatchObject({ ref: 'ofx-A1', data: '2026-10-16', valor: -120000 })
    expect(m[1]).toMatchObject({ valor: 48050, descricao: 'PIX RECEBIDO · MARIA SOUZA' })
    expect(m[2].valor).toBe(-1290)
  })

  it('lê CSV do Nubank e do Inter (com linhas antes do título)', () => {
    const nubank = 'Data,Valor,Identificador,Descrição\n15/10/2026,-45.90,abc-1,Compra no débito - Atacadão\n16/10/2026,300.00,abc-2,Transferência recebida pelo Pix - JOÃO'
    const n = lerCsv(nubank)
    expect(n.map((x) => [x.data, x.valor, x.ref])).toEqual([
      ['2026-10-15', -4590, 'csv-abc-1'],
      ['2026-10-16', 30000, 'csv-abc-2'],
    ])
    const inter = 'Extrato Conta Corrente\nConta ;123\n\nData Lançamento;Histórico;Descrição;Valor;Saldo\n14/10/2026;Pix enviado;Embala Fácil;-380,00;1.200,00\n14/10/2026;Saldo do dia;;0;1.200,00'
    const i = lerExtrato('extrato.csv', inter)
    expect(i).toHaveLength(1)
    expect(i[0]).toMatchObject({ valor: -38000, data: '2026-10-14' })
    // Sem identificador: o mesmo arquivo gera os mesmos códigos.
    expect(lerExtrato('extrato.csv', inter)[0].ref).toBe(i[0].ref)
  })

  it('crédito e débito em colunas separadas', () => {
    const m = lerCsv('Data;Descrição;Crédito;Débito\n01/10/2026;Venda;150,00;\n02/10/2026;Luz;;99,90')
    expect(m.map((x) => x.valor)).toEqual([15000, -9990])
  })

  it('arquivo sem colunas reconhecíveis dá um erro claro', () => {
    expect(() => lerCsv('a;b\n1;2')).toThrow(/colunas de data e valor/)
  })

  it('forma de pagamento pelo texto', () => {
    expect(formaDoTexto('PIX RECEBIDO')).toBe('pix')
    expect(formaDoTexto('PAGTO BOLETO')).toBe('boleto')
    expect(formaDoTexto('Compra no débito')).toBe('debito')
  })

  it('separa repetidos, liga contas em aberto e sugere categoria', () => {
    const d = dadosDemo()
    const banco = d.contas.find((c) => c.tipo === 'banco')!.id
    const movs = [
      ...lerOfx(OFX),
      // Já lançado na demonstração: ingredientes de 02/10 (R$ 1.300 no banco).
      { ref: 'x1', data: '2026-10-02', valor: -130000, descricao: 'Atacadão' },
      { ref: 'x2', data: '2026-10-20', valor: -5000, descricao: 'Ingredientes' },
    ]
    const linhas = prepararImportacao(d, banco, movs)
    const [aluguel, pix, tarifa, repetido, novo] = linhas
    expect(aluguel.acao).toBe('baixar')
    expect(aluguel.contaPrevista?.descricao).toBe('Aluguel')
    expect(pix.acao).toBe('novo')
    expect(pix.categoriaId).toBe('vendas')
    expect(tarifa.categoriaId).toBe('tarifas')
    expect(repetido.acao).toBe('repetido')
    expect(repetido.incluir).toBe(false)
    expect(novo.categoriaId).toBe('mercadoria')

    const depois = aplicarImportacao(d, banco, linhas, () => crypto.randomUUID())
    expect(depois.lancamentos.find((l) => l.id === aluguel.contaPrevista!.id)).toMatchObject({ situacao: 'realizado', dataPagamento: '2026-10-16', refExtrato: 'ofx-A1' })
    expect(depois.lancamentos.length - d.lancamentos.length).toBe(3)
    // Importar de novo o mesmo arquivo não duplica nada.
    const outraVez = prepararImportacao(depois, banco, lerOfx(OFX))
    expect(outraVez.every((l) => l.acao === 'repetido')).toBe(true)
  })
})
