/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// base relativa: o build roda em qualquer pasta ou hospedagem estática
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // App instalável (PWA): guarda as telas no aparelho para abrir rápido e sem internet. Os dados
    // do negócio (api/) nunca entram nesse cache. Versão nova: o app avisa e a pessoa toca em Atualizar.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // O manifesto fica em public/manifest.webmanifest, já ligado no index.html.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // Mapas do código: um erro no navegador aponta o arquivo e a linha de verdade (o código já é aberto).
  build: { sourcemap: true },
  // npm run dev junto com npm run servidor: as chamadas /api vão para o servidor local.
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'node' },
})
