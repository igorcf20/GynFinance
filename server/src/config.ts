// Configuração do servidor, toda por variáveis de ambiente (ver .env.example).
import { fileURLToPath } from 'node:url'

function exigir(nome: string): string {
  const v = process.env[nome]
  if (!v) throw new Error(`Falta a variável de ambiente ${nome} (veja .env.example).`)
  return v
}

export const config = {
  porta: Number(process.env.PORT ?? 3000),
  /** Conexão do servidor: usuário gynfinance_app, que obedece às regras de acesso (RLS). */
  bancoApp: () => exigir('APP_DATABASE_URL'),
  /** Conexão de administrador, usada só pelo script de migração. */
  bancoAdmin: () => exigir('DATABASE_URL'),
  /** Pasta com o site já compilado (npm run build). */
  pastaSite: process.env.PASTA_SITE ?? fileURLToPath(new URL('../../dist', import.meta.url)),
  /** Em produção o cookie só anda por HTTPS. */
  cookieSeguro: process.env.COOKIE_SEGURO ? process.env.COOKIE_SEGURO === 'true' : process.env.NODE_ENV === 'production',
  diasSessao: 30,
}
