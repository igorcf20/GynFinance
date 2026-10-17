import { describe, expect, it } from 'vitest'
import { dadosDemo, DEMO_HOJE } from '../data/demo'
import { diferencas } from '../data/sincronizar'
import { cadastrarSugeridos, excluirParceiro, nomesSemCadastro, resumoParceiro, salvarParceiro, serieParceiro, vincularLancamentos } from './parceiros'

const porNome = (d: ReturnType<typeof dadosDemo>, nome: string) => d.parceiros!.find((p) => p.nome === nome)!

describe('clientes e fornecedores', () => {
  it('ao cadastrar, liga o histórico com o mesmo nome (sem acento nem maiúscula)', () => {
    const d = dadosDemo()
    const atacadao = porNome(d, 'Atacadão')
    const ligados = d.lancamentos.filter((l) => l.parceiroId === atacadao.id)
    expect(ligados.length).toBeGreaterThan(9)
    expect(ligados.every((l) => l.natureza === 'saida')).toBe(true)
    // A conta fixa do aluguel passa a gerar os próximos meses já ligados.
    expect(d.recorrencias.find((r) => r.id === 'rec-aluguel')!.modelo.parceiroId).toBe(porNome(d, 'Imobiliária Lar').id)
    const novo = salvarParceiro(excluirParceiro(d, porNome(d, 'Maria Souza').id), { tipo: 'cliente', nome: 'maria  SOUZA', ativo: true }, 'x', DEMO_HOJE)
    expect(novo.lancamentos.filter((l) => l.parceiroId === 'x').length).toBeGreaterThan(0)
    expect(novo.atendimentos.some((a) => a.parceiroId === 'x')).toBe(true)
  })

  it('resume recebido, pago, em aberto e atrasado', () => {
    const d = dadosDemo()
    const buffet = porNome(d, 'Buffet Estrela')
    const r = resumoParceiro(d.lancamentos, buffet.id, { de: '2026-10-01', ate: DEMO_HOJE }, DEMO_HOJE)
    expect(r.recebido).toBe(125000)
    expect(r.vendas).toBe(1)
    expect(r.aReceber).toBe(90000)
    expect(r.atrasadoReceber).toBe(0)
    const joao = resumoParceiro(d.lancamentos, porNome(d, 'João Silva').id, {}, DEMO_HOJE)
    expect(joao.atrasadoReceber).toBe(35000)
    const serie = serieParceiro(d.lancamentos, buffet.id, '2026-10', 3)
    expect(serie.map((s) => s.mes)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(serie[2].recebido).toBe(125000)
  })

  it('sugere nomes sem ficha e cadastra todos de uma vez', () => {
    const d = dadosDemo()
    const sugestoes = nomesSemCadastro(d)
    expect(sugestoes.map((s) => s.nome)).toContain('Balcão')
    expect(sugestoes.find((s) => s.nome === 'Carla Mendes')?.telefone).toBe('(62) 98111-2233')
    let n = 0
    const depois = cadastrarSugeridos(d, sugestoes, DEMO_HOJE, () => `novo-${++n}`)
    expect(nomesSemCadastro(depois)).toEqual([])
    const m = diferencas(d, depois)!
    expect(m.parceiros?.salvar.length).toBe(sugestoes.length)
  })

  it('renomear muda o nome nos lançamentos; apagar só solta o vínculo', () => {
    const d = dadosDemo()
    const p = porNome(d, 'Padaria Central')
    const renomeado = salvarParceiro(d, { ...p, nome: 'Padaria Central Ltda' }, p.id, DEMO_HOJE)
    expect(renomeado.lancamentos.filter((l) => l.parceiroId === p.id).every((l) => l.contraparte === 'Padaria Central Ltda')).toBe(true)
    expect(renomeado.atendimentos.find((a) => a.parceiroId === p.id)?.cliente).toBe('Padaria Central Ltda')
    const qtd = d.lancamentos.length
    const sem = excluirParceiro(renomeado, p.id)
    expect(sem.lancamentos.length).toBe(qtd)
    expect(sem.lancamentos.some((l) => l.parceiroId === p.id)).toBe(false)
    expect(sem.parceiros!.some((x) => x.id === p.id)).toBe(false)
  })

  it('atribui e tira lançamentos da ficha', () => {
    const d = dadosDemo()
    const maria = porNome(d, 'Maria Souza')
    const balcao = d.lancamentos.find((l) => l.contraparte === 'Balcão')!
    const ligado = vincularLancamentos(d, [balcao.id], maria.id)
    const l = ligado.lancamentos.find((x) => x.id === balcao.id)!
    expect(l.parceiroId).toBe(maria.id)
    expect(l.contraparte).toBe('Maria Souza')
    const solto = vincularLancamentos(ligado, [balcao.id], undefined)
    expect(solto.lancamentos.find((x) => x.id === balcao.id)!.parceiroId).toBeUndefined()
  })
})
