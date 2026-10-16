/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// base relativa: o build roda em qualquer pasta ou hospedagem estática
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // Mapas do código: um erro no navegador aponta o arquivo e a linha de verdade (o código já é aberto).
  build: { sourcemap: true },
  // npm run dev junto com npm run servidor: as chamadas /api vão para o servidor local.
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'node' },
})
