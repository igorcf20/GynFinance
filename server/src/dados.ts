// Tradução entre as tabelas do banco e o formato Dados que o app usa (src/domain/types.ts).
import type { z } from 'zod'
import type { Categoria, Dados, Lancamento, PagamentoDas, Recorrencia } from '../../src/domain/types.ts'
import type { Cliente } from './db.ts'
import type { mudancas as esquemaMudancas, novoNegocio as esquemaNovoNegocio } from './esquemas.ts'

type Linha = Record<string, unknown>
// Campos opcionais: o banco devolve null, o app espera ausente.
const opc = <T>(v: T | null): T | undefined => (v === null ? undefined : v)

export class ErroDeDados extends Error {}

/** Empresa da pessoa logada (a primeira; o modelo já aceita várias). */
export async function empresaDaSessao(c: Cliente): Promise<string | null> {
  const r = await c.query<{ id: string }>('select id from empresa order by criado_em limit 1')
  return r.rows[0]?.id ?? null
}

export async function lerDados(c: Cliente): Promise<Dados | null> {
  const e = (await c.query<Linha>('select * from empresa order by criado_em limit 1')).rows[0]
  if (!e) return null
  const empresaId = e.id as string
  const [contas, categorias, desligadas, lancamentos, recorrencias, das, avisos] = await Promise.all([
    c.query<Linha>('select * from conta_financeira where empresa_id = $1 order by criado_em', [empresaId]),
    c.query<Linha>('select * from categoria where empresa_id is null or empresa_id = $1', [empresaId]),
    c.query<{ categoria_id: string }>('select categoria_id from categoria_desativada where empresa_id = $1', [empresaId]),
    c.query<Linha>(
      `select l.*, c.nome as comprovante_nome, c.tipo as comprovante_tipo, c.tamanho as comprovante_tamanho
       from lancamento l left join comprovante c on c.id = l.comprovante_id
       where l.empresa_id = $1 order by l.ordem`,
      [empresaId],
    ),
    c.query<Linha>('select * from recorrencia where empresa_id = $1 order by ordem', [empresaId]),
    c.query<Linha>("select *, to_char(competencia, 'YYYY-MM') as mes from pagamento_das where empresa_id = $1 order by competencia", [empresaId]),
    c.query<{ aviso_id: string }>('select aviso_id from aviso_dispensado where empresa_id = $1', [empresaId]),
  ])
  const fora = new Set(desligadas.rows.map((r) => r.categoria_id))
  // Ordem das categorias padrão igual à do app.
  const ordem = ['vendas', 'servicos', 'outras-entradas', 'mercadoria', 'aluguel', 'internet', 'luz', 'contador', 'sistema', 'transporte', 'embalagem', 'maquininha', 'marketing', 'manutencao', 'das', 'prolabore']
  const pos = (id: string) => (ordem.includes(id) ? ordem.indexOf(id) : 999)

  return {
    empresa: {
      id: empresaId,
      nomeDono: e.nome_dono as string,
      nomeFantasia: e.nome_fantasia as string,
      cnpj: opc(e.cnpj as string | null),
      ehMei: e.eh_mei as boolean,
      dataAbertura: e.data_abertura as string,
      atividade: e.atividade as Dados['empresa']['atividade'],
      uf: e.uf as string,
      municipio: opc(e.municipio as string | null),
      prolaboreDesejado: opc(e.prolabore_desejado as number | null),
      faturadoAntes: e.faturado_antes_ano !== null ? { ano: e.faturado_antes_ano as number, valor: e.faturado_antes_valor as number } : undefined,
      modulosAtivos: e.modulos_ativos as string[],
    },
    contas: contas.rows.map((r) => ({
      id: r.id as string,
      empresaId,
      nome: r.nome as string,
      tipo: r.tipo as 'caixa' | 'banco' | 'reserva',
      saldoInicial: r.saldo_inicial as number,
      ativa: r.ativa as boolean,
    })),
    categorias: categorias.rows
      .map(
        (r): Categoria => ({
          id: r.id as string,
          empresaId: opc(r.empresa_id as string | null),
          nome: r.nome as string,
          grupo: r.grupo as Categoria['grupo'],
          contaNoFaturamento: r.conta_no_faturamento as boolean,
          ativa: (r.ativa as boolean) && !fora.has(r.id as string),
        }),
      )
      .sort((a, b) => pos(a.id) - pos(b.id)),
    lancamentos: lancamentos.rows.map(
      (r): Lancamento => ({
        id: r.id as string,
        empresaId,
        natureza: r.natureza as Lancamento['natureza'],
        valor: r.valor as number,
        categoriaId: opc(r.categoria_id as string | null),
        contaFinanceiraId: r.conta_financeira_id as string,
        contaDestinoId: opc(r.conta_destino_id as string | null),
        situacao: r.situacao as Lancamento['situacao'],
        dataCompetencia: r.data_competencia as string,
        dataVencimento: opc(r.data_vencimento as string | null),
        dataPagamento: opc(r.data_pagamento as string | null),
        formaPagamento: r.forma_pagamento as Lancamento['formaPagamento'],
        descricao: opc(r.descricao as string | null),
        contraparte: opc(r.contraparte as string | null),
        notaEmitida: r.nota_emitida as Lancamento['notaEmitida'],
        recorrenciaId: opc(r.recorrencia_id as string | null),
        pagoComDinheiroPessoal: (r.pago_com_dinheiro_pessoal as boolean) || undefined,
        espelhoDe: opc(r.espelho_de as string | null),
        comprovante: r.comprovante_id
          ? { id: r.comprovante_id as string, nome: r.comprovante_nome as string, tipo: r.comprovante_tipo as string, tamanho: r.comprovante_tamanho as number }
          : undefined,
        observacao: opc(r.observacao as string | null),
        parcelaDe: opc(r.parcela_de as string | null),
        parcela: r.parcela_total ? { numero: r.parcela_numero as number, total: r.parcela_total as number } : undefined,
      }),
    ),
    recorrencias: recorrencias.rows.map(
      (r): Recorrencia => ({
        id: r.id as string,
        empresaId,
        modelo: {
          natureza: r.natureza as Lancamento['natureza'],
          valor: r.valor as number,
          categoriaId: opc(r.categoria_id as string | null),
          contaFinanceiraId: r.conta_financeira_id as string,
          formaPagamento: r.forma_pagamento as Lancamento['formaPagamento'],
          descricao: opc(r.descricao as string | null),
          contraparte: opc(r.contraparte as string | null),
        },
        frequencia: 'mensal',
        diaVencimento: r.dia_vencimento as number,
        inicio: r.inicio as string,
        fim: opc(r.fim as string | null),
        seFimDeSemana: r.se_fim_de_semana as Recorrencia['seFimDeSemana'],
        valorVaria: r.valor_varia as boolean,
        ativa: r.ativa as boolean,
        ultimaGeracao: opc(r.ultima_geracao as string | null),
      }),
    ),
    pagamentosDas: das.rows.map(
      (r): PagamentoDas => ({
        empresaId,
        competencia: r.mes as string,
        valor: r.valor as number,
        vencimento: r.vencimento as string,
        lancamentoId: opc(r.lancamento_id as string | null),
        pagoForaDoSistema: (r.pago_fora_do_sistema as boolean) || undefined,
      }),
    ),
    preferencias: { lembreteDias: e.lembrete_dias as 0 | 1 | 3, lembreteEmail: e.lembrete_email as boolean, resumoMensal: e.resumo_mensal as boolean },
    avisosDispensados: avisos.rows.map((r) => r.aviso_id),
  }
}

type Empresa = z.infer<typeof esquemaNovoNegocio>['empresa']

async function gravarEmpresa(c: Cliente, empresaId: string, e: Omit<Empresa, 'id'>) {
  await c.query(
    `update empresa set nome_dono = $2, nome_fantasia = $3, cnpj = $4, eh_mei = $5, data_abertura = $6, atividade = $7, uf = $8,
       municipio = $9, prolabore_desejado = $10, faturado_antes_ano = $11, faturado_antes_valor = $12, modulos_ativos = $13, atualizado_em = now()
     where id = $1`,
    [empresaId, e.nomeDono, e.nomeFantasia, e.cnpj || null, e.ehMei, e.dataAbertura, e.atividade, e.uf.toUpperCase(), e.municipio || null, e.prolaboreDesejado ?? null, e.faturadoAntes?.ano ?? null, e.faturadoAntes?.valor ?? null, e.modulosAtivos],
  )
}

async function gravarDas(c: Cliente, empresaId: string, lista: z.infer<typeof esquemaNovoNegocio>['pagamentosDas']) {
  for (const p of lista) {
    await c.query(
      `insert into pagamento_das (empresa_id, competencia, valor, vencimento, lancamento_id, pago_fora_do_sistema)
       values ($1, ($2 || '-01')::date, $3, $4, $5, $6)
       on conflict (empresa_id, competencia) do update set valor = excluded.valor, vencimento = excluded.vencimento,
         lancamento_id = excluded.lancamento_id, pago_fora_do_sistema = excluded.pago_fora_do_sistema`,
      [empresaId, p.competencia, p.valor, p.vencimento, p.lancamentoId ?? null, !!p.pagoForaDoSistema],
    )
  }
}

/** Configuração inicial: apaga o negócio anterior da pessoa (se houver) e cria o novo. */
export async function criarNegocio(c: Cliente, usuarioId: string, n: z.infer<typeof esquemaNovoNegocio>): Promise<void> {
  await c.query('delete from empresa where usuario_id = $1', [usuarioId])
  await c.query(
    `insert into empresa (id, usuario_id, nome_dono, nome_fantasia, eh_mei, data_abertura, atividade, uf, lembrete_dias, lembrete_email, resumo_mensal)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [n.empresa.id, usuarioId, n.empresa.nomeDono, n.empresa.nomeFantasia, n.empresa.ehMei, n.empresa.dataAbertura, n.empresa.atividade, n.empresa.uf, n.preferencias.lembreteDias, n.preferencias.lembreteEmail, n.preferencias.resumoMensal],
  )
  await gravarEmpresa(c, n.empresa.id, n.empresa)
  for (const k of n.contas) {
    await c.query('insert into conta_financeira (id, empresa_id, nome, tipo, saldo_inicial, ativa) values ($1, $2, $3, $4, $5, $6)', [k.id, n.empresa.id, k.nome, k.tipo, k.saldoInicial, k.ativa])
  }
  for (const cat of n.categoriasDesativadas) {
    await c.query('insert into categoria_desativada (empresa_id, categoria_id) values ($1, $2) on conflict do nothing', [n.empresa.id, cat])
  }
  await gravarDas(c, n.empresa.id, n.pagamentosDas)
}

/** Grava o que mudou no app (ver src/data/sincronizar.ts), tudo numa transação. */
export async function aplicarMudancas(c: Cliente, empresaId: string, m: z.infer<typeof esquemaMudancas>): Promise<void> {
  if (m.empresa) await gravarEmpresa(c, empresaId, m.empresa)
  if (m.preferencias) {
    await c.query('update empresa set lembrete_dias = $2, lembrete_email = $3, resumo_mensal = $4, atualizado_em = now() where id = $1', [
      empresaId,
      m.preferencias.lembreteDias,
      m.preferencias.lembreteEmail,
      m.preferencias.resumoMensal,
    ])
  }

  // As contas citadas precisam ser desta empresa (a chave estrangeira sozinha não garante).
  const contas = new Set((await c.query<{ id: string }>('select id from conta_financeira where empresa_id = $1', [empresaId])).rows.map((r) => r.id))
  const confere = (...ids: (string | undefined)[]) => {
    for (const i of ids) if (i && !contas.has(i)) throw new ErroDeDados('Conta financeira desconhecida.')
  }

  for (const r of m.recorrencias?.salvar ?? []) {
    confere(r.modelo.contaFinanceiraId)
    await c.query(
      `insert into recorrencia (id, empresa_id, natureza, valor, categoria_id, conta_financeira_id, forma_pagamento, descricao, contraparte,
         frequencia, dia_vencimento, inicio, fim, se_fim_de_semana, valor_varia, ativa, ultima_geracao)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'mensal', $10, $11, $12, $13, $14, $15, $16)
       on conflict (id) do update set natureza = excluded.natureza, valor = excluded.valor, categoria_id = excluded.categoria_id,
         conta_financeira_id = excluded.conta_financeira_id, forma_pagamento = excluded.forma_pagamento, descricao = excluded.descricao,
         contraparte = excluded.contraparte, dia_vencimento = excluded.dia_vencimento, inicio = excluded.inicio, fim = excluded.fim,
         se_fim_de_semana = excluded.se_fim_de_semana, valor_varia = excluded.valor_varia, ativa = excluded.ativa,
         ultima_geracao = excluded.ultima_geracao, atualizado_em = now()`,
      [r.id, empresaId, r.modelo.natureza, r.modelo.valor, r.modelo.categoriaId ?? null, r.modelo.contaFinanceiraId, r.modelo.formaPagamento, r.modelo.descricao ?? null, r.modelo.contraparte ?? null, r.diaVencimento, r.inicio, r.fim ?? null, r.seFimDeSemana, r.valorVaria, r.ativa, r.ultimaGeracao ?? null],
    )
  }

  // Apagar antes de salvar: ao editar uma conta fixa, os previstos antigos saem e os novos entram no mesmo mês.
  if (m.lancamentos?.excluir.length) {
    await c.query('delete from lancamento where empresa_id = $1 and id = any($2::uuid[])', [empresaId, m.lancamentos.excluir])
  }
  for (const l of m.lancamentos?.salvar ?? []) {
    confere(l.contaFinanceiraId, l.contaDestinoId)
    // O banco só mostra comprovantes da própria empresa: id de outra empresa não passa daqui.
    if (l.comprovante && !(await c.query('select 1 from comprovante where id = $1', [l.comprovante.id])).rowCount) {
      throw new ErroDeDados('Comprovante não encontrado. Anexe de novo.')
    }
    await c.query(
      `insert into lancamento (id, empresa_id, natureza, valor, categoria_id, conta_financeira_id, conta_destino_id, situacao, data_competencia,
         data_vencimento, data_pagamento, forma_pagamento, descricao, contraparte, nota_emitida, recorrencia_id, pago_com_dinheiro_pessoal, espelho_de,
         comprovante_id, observacao, parcela_de, parcela_numero, parcela_total)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
       on conflict (id) do update set natureza = excluded.natureza, valor = excluded.valor, categoria_id = excluded.categoria_id,
         conta_financeira_id = excluded.conta_financeira_id, conta_destino_id = excluded.conta_destino_id, situacao = excluded.situacao,
         data_competencia = excluded.data_competencia, data_vencimento = excluded.data_vencimento, data_pagamento = excluded.data_pagamento,
         forma_pagamento = excluded.forma_pagamento, descricao = excluded.descricao, contraparte = excluded.contraparte,
         nota_emitida = excluded.nota_emitida, recorrencia_id = excluded.recorrencia_id,
         pago_com_dinheiro_pessoal = excluded.pago_com_dinheiro_pessoal, espelho_de = excluded.espelho_de,
         comprovante_id = excluded.comprovante_id, observacao = excluded.observacao, parcela_de = excluded.parcela_de,
         parcela_numero = excluded.parcela_numero, parcela_total = excluded.parcela_total, atualizado_em = now()`,
      [l.id, empresaId, l.natureza, l.valor, l.categoriaId ?? null, l.contaFinanceiraId, l.contaDestinoId ?? null, l.situacao, l.dataCompetencia, l.dataVencimento ?? null, l.dataPagamento ?? null, l.formaPagamento, l.descricao ?? null, l.contraparte ?? null, l.notaEmitida, l.recorrenciaId ?? null, !!l.pagoComDinheiroPessoal, l.espelhoDe ?? null, l.comprovante?.id ?? null, l.observacao ?? null, l.parcelaDe ?? null, l.parcela?.numero ?? null, l.parcela?.total ?? null],
    )
  }

  if (m.pagamentosDas) await gravarDas(c, empresaId, m.pagamentosDas.salvar)
  for (const a of m.avisosDispensados ?? []) {
    await c.query('insert into aviso_dispensado (empresa_id, aviso_id) values ($1, $2) on conflict do nothing', [empresaId, a])
  }
}

/** Guarda o arquivo de um comprovante (foto ou PDF) da empresa da sessão. */
export async function gravarComprovante(c: Cliente, empresaId: string, comp: { id: string; nome: string; tipo: string; dados: Buffer }) {
  await c.query(
    `insert into comprovante (id, empresa_id, nome, tipo, tamanho, dados) values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do nothing`,
    [comp.id, empresaId, comp.nome, comp.tipo, comp.dados.length, comp.dados],
  )
}

export async function lerComprovante(c: Cliente, id: string) {
  const r = await c.query<{ nome: string; tipo: string; dados: Buffer }>('select nome, tipo, dados from comprovante where id = $1', [id])
  return r.rows[0]
}
