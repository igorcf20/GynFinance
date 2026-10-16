// Envio de e-mail (SMTP) e os e-mails que o sistema manda: senha nova e lembretes do dia.
// Sem SMTP_HOST no .env, nada é enviado: o servidor só anota no log que deixou de enviar.
import nodemailer from 'nodemailer'
import type pg from 'pg'
import { config } from './config.ts'

export interface Email {
  para: string
  assunto: string
  texto: string
  html: string
}

export interface Carteiro {
  /** Há provedor configurado? Sem ele, enviar() só registra no log. */
  ligado: boolean
  enviar(e: Email): Promise<void>
}

export function criarCarteiro(): Carteiro {
  const smtp = config.smtp()
  if (!smtp) {
    return {
      ligado: false,
      enviar: async (e) => console.warn(`E-mail não enviado (falta SMTP_HOST no .env): "${e.assunto}"`),
    }
  }
  const transporte = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.porta,
    secure: smtp.porta === 465,
    auth: smtp.usuario ? { user: smtp.usuario, pass: smtp.senha } : undefined,
    disableFileAccess: true,
    disableUrlAccess: true,
  })
  return {
    ligado: true,
    enviar: async (e) => {
      await transporte.sendMail({ from: smtp.remetente, to: e.para, subject: e.assunto, text: e.texto, html: e.html })
    },
  }
}

// ---------- Modelo ----------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export const brl = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: centavos % 100 ? 2 : 0, maximumFractionDigits: 2 }).replace(/ /g, ' ')
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Corpo comum: logo em texto, conteúdo, botão e rodapé, em HTML simples que abre em qualquer leitor. */
function moldura(titulo: string, corpoHtml: string, botao?: { texto: string; url: string }, rodape = '') {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f7fa;font-family:Inter,Segoe UI,Arial,sans-serif;color:#13213d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:20px;font-weight:700;color:#3478f6;padding-bottom:16px">Gynfinance</td></tr>
<tr><td style="font-size:18px;font-weight:700;padding-bottom:8px">${esc(titulo)}</td></tr>
<tr><td style="font-size:15px;line-height:1.55;color:#3d5170">${corpoHtml}</td></tr>
${botao ? `<tr><td style="padding-top:20px"><a href="${esc(botao.url)}" style="display:inline-block;background:#3478f6;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px">${esc(botao.texto)}</a></td></tr>` : ''}
<tr><td style="font-size:12px;color:#7a8aa3;padding-top:24px">${rodape}</td></tr>
</table></td></tr></table></body></html>`
}

export function emailSenhaNova(para: string, nome: string, link: string): Email {
  const primeiro = nome.split(' ')[0]
  return {
    para,
    assunto: 'Crie uma senha nova no Gynfinance',
    texto: `Olá, ${primeiro}!\n\nRecebemos um pedido para criar uma senha nova. Abra o link abaixo (vale por 1 hora):\n${link}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`,
    html: moldura(
      `Olá, ${primeiro}!`,
      'Recebemos um pedido para criar uma senha nova na sua conta. O link vale por 1 hora.',
      { texto: 'Criar senha nova', url: link },
      'Se não foi você, ignore este e-mail: sua senha continua a mesma.',
    ),
  }
}

export interface ItemLembrete {
  tipo: string
  chave: string
  titulo: string
  valor: number | null
  data: string
}

/** Uma linha de texto para cada lembrete do dia. */
export function fraseDoLembrete(i: ItemLembrete, hoje: string): string {
  const dias = Math.round((Date.parse(i.data) - Date.parse(hoje)) / 864e5)
  const quando = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias (${dataBR(i.data)})`
  switch (i.tipo) {
    case 'pagar':
      return `Vence ${quando}: ${i.titulo}, ${brl(i.valor ?? 0)}.`
    case 'receber':
      return `${i.titulo} paga hoje: ${brl(i.valor ?? 0)}. Se não chegar, dá para cobrar pelo WhatsApp no sistema.`
    case 'atrasada':
      return `Venceu ontem e continua em aberto: ${i.titulo}, ${brl(i.valor ?? 0)}.`
    case 'das':
      return `O ${i.titulo} vence dia 20. Pague pelo portal do Simples Nacional e marque como pago no sistema.`
    case 'das-atrasado':
      return `O ${i.titulo} venceu dia 20 e ainda não foi marcado como pago. Pague logo para a multa não crescer.`
    case 'fechamento': {
      const v = i.valor ?? 0
      return `O mês ${i.titulo} fechou: ${v >= 0 ? `sobrou ${brl(v)}` : `saiu ${brl(-v)} a mais do que entrou`}. Veja o resumo completo no Fechamento do mês.`
    }
    case 'dasn':
      return `A declaração anual do MEI (${i.titulo}) vence em 31/05. O sistema já somou o seu faturamento do ano passado em Meu MEI.`
    default:
      return i.titulo
  }
}

export function emailLembretes(para: string, nome: string, negocio: string, itens: ItemLembrete[], hoje: string, urlSistema: string): Email {
  const primeiro = nome.split(' ')[0]
  const frases = itens.map((i) => fraseDoLembrete(i, hoje))
  const fechamento = itens.length === 1 && itens[0].tipo === 'fechamento'
  const assunto = fechamento
    ? `Resumo de ${itens[0].titulo}: ${negocio}`
    : itens.length === 1
      ? frases[0].replace(/\.$/, '')
      : `${itens.length} lembretes para hoje: ${negocio}`
  const rodape = 'Você recebe este e-mail porque deixou os avisos por e-mail ligados. Para desligar, abra Configurações, Notificações no sistema.'
  return {
    para,
    assunto: assunto.length > 110 ? `${assunto.slice(0, 107)}...` : assunto,
    texto: `Olá, ${primeiro}!\n\n${frases.map((f) => `- ${f}`).join('\n')}\n\nAbrir o Gynfinance: ${urlSistema}\n\n${rodape}`,
    html: moldura(
      `Olá, ${primeiro}!`,
      `<ul style="padding-left:18px;margin:8px 0">${frases.map((f) => `<li style="margin:6px 0">${esc(f)}</li>`).join('')}</ul>`,
      { texto: 'Abrir o Gynfinance', url: urlSistema },
      esc(rodape),
    ),
  }
}

// ---------- Envio diário ----------

/** Data de hoje e hora no horário de Brasília. */
export function agoraBrasilia(d = new Date()): { hoje: string; hora: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  )
  return { hoje: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) }
}

/**
 * Manda um e-mail por negócio com os lembretes do dia que ainda não foram. Devolve quantos e-mails
 * saíram. Sem provedor configurado não marca nada, para os lembretes saírem quando ele for ligado.
 */
export async function enviarLembretes(pool: pg.Pool, carteiro: Carteiro, hoje: string): Promise<number> {
  if (!carteiro.ligado) return 0
  const r = await pool.query<{ empresa_id: string; email: string; nome_dono: string; nome_fantasia: string } & ItemLembrete>('select * from lembretes_do_dia($1)', [hoje])
  const porEmpresa = new Map<string, typeof r.rows>()
  for (const l of r.rows) porEmpresa.set(l.empresa_id, [...(porEmpresa.get(l.empresa_id) ?? []), l])
  let enviados = 0
  for (const [empresaId, todos] of porEmpresa) {
    const ja = new Set((await pool.query<{ emails_enviados: string }>('select emails_enviados($1, $2)', [empresaId, todos.map((l) => l.chave)])).rows.map((x) => x.emails_enviados))
    // Na ordem em que vencem; o que já venceu e o resumo do mês ficam no começo.
    const itens = todos.filter((l) => !ja.has(l.chave)).sort((a, b) => String(a.data).localeCompare(String(b.data)))
    if (!itens.length) continue
    const p = itens[0]
    try {
      await carteiro.enviar(emailLembretes(p.email, p.nome_dono, p.nome_fantasia, itens, hoje, `${config.urlSistema()}/app/`))
      await pool.query('select marcar_email_enviado($1, $2)', [empresaId, itens.map((l) => l.chave)])
      enviados++
    } catch (e) {
      // Um endereço com problema não para os outros; tenta de novo na próxima volta.
      console.error(`Lembrete não enviado para ${empresaId}:`, (e as Error).message)
    }
  }
  return enviados
}

/** A cada 15 minutos, a partir das 8h de Brasília, manda os lembretes do dia que faltam. */
export function agendarLembretes(pool: pg.Pool, carteiro: Carteiro): () => void {
  if (!carteiro.ligado) return () => {}
  let rodando = false
  const volta = async () => {
    const { hoje, hora } = agoraBrasilia()
    if (hora < 8 || rodando) return
    rodando = true
    try {
      const n = await enviarLembretes(pool, carteiro, hoje)
      if (n) console.log(`Lembretes do dia enviados: ${n} e-mail(s).`)
    } catch (e) {
      console.error('Falha ao enviar lembretes:', (e as Error).message)
    } finally {
      rodando = false
    }
  }
  const t = setInterval(() => void volta(), 15 * 60 * 1000)
  void volta()
  return () => clearInterval(t)
}
