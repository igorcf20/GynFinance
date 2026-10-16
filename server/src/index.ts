// Sobe o servidor. Uso: APP_DATABASE_URL=... node server/src/index.ts
import { config } from './config.ts'
import { criarApp } from './app.ts'
import { criarPool } from './db.ts'

const pool = criarPool(config.bancoApp())
const app = await criarApp(pool, { logger: true })
await app.listen({ port: config.porta, host: '0.0.0.0' })

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, async () => {
    await app.close()
    await pool.end()
    process.exit(0)
  })
}
