// Sobe o servidor. Uso: APP_DATABASE_URL=... node server/src/index.ts
import { config } from './config.ts'
import { criarApp } from './app.ts'
import { criarPool } from './db.ts'
import { agendarLembretes, criarCarteiro } from './email.ts'

const pool = criarPool(config.bancoApp())
const carteiro = criarCarteiro()
const app = await criarApp(pool, { logger: true, carteiro })
await app.listen({ port: config.porta, host: '0.0.0.0' })
if (!carteiro.ligado) app.log.warn('Sem provedor de e-mail (SMTP_HOST): lembretes e "Esqueci minha senha" não enviam nada.')
const pararLembretes = agendarLembretes(pool, carteiro)

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, async () => {
    pararLembretes()
    await app.close()
    await pool.end()
    process.exit(0)
  })
}
