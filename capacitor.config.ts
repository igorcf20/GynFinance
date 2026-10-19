import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Apps do Gynfinance para Google Play e App Store (passo a passo em docs/APPS.md).
 *
 * O app abre o sistema publicado (gynfinance.kodemi.pt/app/), como o PWA: login, cookies e
 * comprovantes funcionam igual ao navegador, e cada publicação no servidor chega ao app na hora,
 * sem mandar versão nova para as lojas. Sem internet ao abrir pela primeira vez, mostra offline.html
 * (que vai dentro do app); depois disso, as telas ficam guardadas no aparelho.
 */
const config: CapacitorConfig = {
  appId: 'pt.kodemi.gynfinance',
  appName: 'Gynfinance',
  webDir: 'dist',
  server: {
    url: process.env.GYNFINANCE_URL ?? 'https://gynfinance.kodemi.pt/app/',
    errorPath: 'offline.html',
  },
  backgroundColor: '#F5F7FA',
  android: {
    // Nada de conteúdo http misturado: o servidor é só https.
    allowMixedContent: false,
  },
  ios: {
    // Libera o cache das telas (service worker) no iPhone: só o domínio do Gynfinance navega no app.
    limitsNavigationsToAppBoundDomains: true,
    contentInset: 'never',
    backgroundColor: '#F5F7FA',
  },
}

export default config
