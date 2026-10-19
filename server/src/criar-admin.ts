// Cria (ou troca a senha de) a conta de um e-mail de superadmin. Pelo site esses e-mails não se
// cadastram: quem chegasse primeiro ganharia o painel. Uso na VPS:
//   docker compose run --rm -e NOME="Igor" -e EMAIL=igor@exemplo.com -e SENHA='senha-forte' app node server/src/criar-admin.ts
import bcrypt from 'bcryptjs'
import { config } from './config.ts'
import { criarPool } from './db.ts'

const nome = process.env.NOME?.trim() || 'Administrador'
const email = process.env.EMAIL?.trim().toLowerCase() ?? ''
const senha = process.env.SENHA ?? ''
if (!config.adminEmails().includes(email)) throw new Error('EMAIL precisa estar em ADMIN_EMAILS no .env.')
if (senha.length < 12) throw new Error('SENHA precisa de pelo menos 12 caracteres.')

const pool = criarPool(config.bancoApp())
const hash = await bcrypt.hash(senha, 12)
const r = await pool.query(
  `insert into usuario (nome, email, senha_hash, aceite_termos_em) values ($1, $2, $3, now())
   on conflict (lower(email)) do update set senha_hash = excluded.senha_hash, atualizado_em = now() returning (xmax = 0) as nova`,
  [nome, email, hash],
)
console.log(r.rows[0].nova ? `Conta de admin criada: ${email}` : `Senha trocada: ${email}`)
await pool.query('delete from sessao where usuario_id = (select id from usuario where lower(email) = $1)', [email])
await pool.end()
