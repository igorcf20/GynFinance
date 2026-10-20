import { describe, expect, it } from 'vitest'
import { linkCobranca, textoCobranca } from './cobranca'
import type { Dados, Lancamento } from './types'

const empresa = { id: 'e', nomeDono: 'Ana', nomeFantasia: 'Doces da Ana', ehMei: true, dataAbertura: '2024-01-01', atividade: 'comercio', uf: 'GO', modulosAtivos: [] } as Dados['empresa']
const conta: Lancamento = {
  id: 'l1', empresaId: 'e', natureza: 'entrada', valor: 15050, contaFinanceiraId: 'b', situacao: 'previsto', dataCompetencia: '2026-10-01',
  dataVencimento: '2026-10-10', formaPagamento: 'pix', notaEmitida: 'nao', contraparte: 'Maria Souza', descricao: 'Bolo de aniversário', parceiroId: 'p1',
}

describe('cobrança pelo WhatsApp', () => {
  it('texto padrão com e sem chave Pix', () => {
    expect(textoCobranca(conta, empresa)).toBe(
      'Olá, Maria! Aqui é da Doces da Ana. Passando para lembrar do pagamento de R$ 150,50 (bolo de aniversário), com vencimento em 10/10/2026. Pode ser por Pix. Obrigado!',
    )
    expect(textoCobranca(conta, { ...empresa, chavePix: '62999990000' })).toContain('Pode ser por Pix: 62999990000. Obrigado!')
  })

  it('texto próprio do dono', () => {
    expect(textoCobranca(conta, { ...empresa, chavePix: 'ana@pix', mensagemCobranca: '{nome}, faltam {valor}. Pix {pix}' })).toBe('Maria, faltam R$ 150,50. Pix ana@pix')
  })

  it('abre a conversa do cliente quando sabe o telefone', () => {
    const comFicha = linkCobranca(conta, { empresa, atendimentos: [], parceiros: [{ id: 'p1', empresaId: 'e', tipo: 'cliente', nome: 'Maria', telefone: '(62) 99999-1234', ativo: true, criadoEm: '2026-01-01' }] })
    expect(comFicha.comNumero).toBe(true)
    expect(comFicha.url.startsWith('https://wa.me/5562999991234?text=')).toBe(true)
    const daAgenda = linkCobranca({ ...conta, parceiroId: undefined }, { empresa, parceiros: [], atendimentos: [{ id: 'a', empresaId: 'e', cliente: 'Maria', telefone: '62 98888-0000', data: '2026-10-01', inicio: '10:00', duracaoMin: 60, situacao: 'concluido', lancamentoId: 'l1' }] })
    expect(daAgenda.url.startsWith('https://wa.me/5562988880000?')).toBe(true)
    expect(linkCobranca({ ...conta, parceiroId: undefined }, { empresa, parceiros: [], atendimentos: [] })).toMatchObject({ comNumero: false })
  })
})
