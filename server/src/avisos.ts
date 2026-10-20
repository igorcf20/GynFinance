// Avisos no celular (notificações do navegador): os mesmos lembretes do dia que vão por e-mail,
// para quem ligou "Avisos neste aparelho" em Configurações. Não depende de provedor de e-mail.
import type pg from 'pg'
import webpush from 'web-push'
import { config } from './config.ts'
import { fraseDoLembrete, type ItemLembrete } from './email.ts'

let chaves: { publica: string; privada: string } | null = null

/** Chaves do servidor para os avisos: geradas uma vez e guardadas no banco. */
async function lerChaves(pool: pg.Pool) {
  if (chaves) return chaves
  let r = (await pool.query<{ publica: string; privada: string }>('select publica, privada from push_chaves')).rows[0]
  if (!r) {
    const novas = webpush.generateVAPIDKeys()
    await pool.query('insert into push_chaves (publica, privada) values ($1, $2) on conflict do nothing', [novas.publicKey, novas.privateKey])
    r = (await pool.query<{ publica: string; privada: string }>('select publica, privada from push_chaves')).rows[0]
  }
  chaves = r
  return r
}

export async function chavePublicaAvisos(pool: pg.Pool): Promise<string> {
  return (await lerChaves(pool)).publica
}

export interface Aviso {
  titulo: string
  texto: string
  /** Tela que abre ao tocar no aviso. */
  url: string
  /** Avisos com a mesma marca se substituem no celular. */
  marca: string
}

/** Um aviso por negócio: o primeiro lembrete como título e o resto resumido. */
export function montarAviso(negocio: string, itens: ItemLembrete[], hoje: string): Aviso {
  const frases = itens.map((i) => fraseDoLembrete(i, hoje))
  const tela = itens.every((i) => i.tipo.startsWith('das') || i.tipo === 'dasn') ? 'mei' : itens.length === 1 && itens[0].tipo === 'fechamento' ? 'fechamento' : 'contas'
  return {
    titulo: itens.length === 1 ? negocio : `${itens.length} lembretes para hoje · ${negocio}`,
    texto: itens.length === 1 ? frases[0] : frases.slice(0, 3).join(' ') + (frases.length > 3 ? ` E mais ${frases.length - 3}.` : ''),
    url: `${config.urlSistema()}/app/#/${tela}`,
    marca: `lembretes:${hoje}`,
  }
}

export type Mensageiro = (inscricao: webpush.PushSubscription, conteudo: string) => Promise<void>

/** Envia pelo serviço de avisos do navegador (Google, Apple, Mozilla), assinado com as chaves do servidor. */
export function mensageiroPadrao(pool: pg.Pool): Mensageiro {
  return async (inscricao, conteudo) => {
    const k = await lerChaves(pool)
    await webpush.sendNotification(inscricao, conteudo, {
      vapidDetails: { subject: `mailto:${config.adminEmails()[0] ?? 'contato@kodemi.pt'}`, publicKey: k.publica, privateKey: k.privada },
      TTL: 12 * 3600,
    })
  }
}

/** Manda os lembretes do dia que ainda não foram para os aparelhos de cada negócio. Devolve quantos avisos saíram. */
export async function enviarAvisos(pool: pg.Pool, hoje: string, enviar: Mensageiro = mensageiroPadrao(pool)): Promise<number> {
  const r = await pool.query<{ empresa_id: string; nome_fantasia: string } & ItemLembrete>('select * from lembretes_do_dia($1)', [hoje])
  const porEmpresa = new Map<string, typeof r.rows>()
  for (const l of r.rows) porEmpresa.set(l.empresa_id, [...(porEmpresa.get(l.empresa_id) ?? []), l])
  let enviados = 0
  for (const [empresaId, todos] of porEmpresa) {
    const aparelhos = (await pool.query<{ endpoint: string; p256dh: string; auth: string }>('select * from aparelhos_do_negocio($1)', [empresaId])).rows
    if (!aparelhos.length) continue
    // Mesmo controle do e-mail, com "push:" na frente: cada lembrete sai uma vez por canal.
    const chaves = todos.map((l) => `push:${l.chave}`)
    const ja = new Set((await pool.query<{ emails_enviados: string }>('select emails_enviados($1, $2)', [empresaId, chaves])).rows.map((x) => x.emails_enviados))
    const itens = todos.filter((l) => !ja.has(`push:${l.chave}`)).sort((a, b) => String(a.data).localeCompare(String(b.data)))
    if (!itens.length) continue
    const conteudo = JSON.stringify(montarAviso(itens[0].nome_fantasia, itens, hoje))
    let saiu = false
    for (const a of aparelhos) {
      try {
        await enviar({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, conteudo)
        saiu = true
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        // O navegador desligou os avisos ou o aparelho sumiu: esquece este endereço.
        if (status === 404 || status === 410) await pool.query('select esquecer_aparelho($1)', [a.endpoint])
        else console.error(`Aviso não enviado para ${empresaId}:`, (e as Error).message)
      }
    }
    if (saiu) {
      await pool.query('select marcar_email_enviado($1, $2)', [empresaId, itens.map((l) => `push:${l.chave}`)])
      enviados++
    }
  }
  return enviados
}
