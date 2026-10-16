// Endereços: site de venda na raiz, sistema em /app/ e a API também por /app/api/.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('endereços do site e do sistema', () => {
  let app: Awaited<ReturnType<typeof import('./app.ts').criarApp>>

  beforeAll(async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'gyn-rotas-'))
    mkdirSync(join(pasta, 'dist', 'assets'), { recursive: true })
    mkdirSync(join(pasta, 'site'))
    writeFileSync(join(pasta, 'dist', 'index.html'), 'sistema')
    writeFileSync(join(pasta, 'dist', 'assets', 'index-abc.js'), 'js')
    writeFileSync(join(pasta, 'site', 'index.html'), 'vitrine')
    process.env.PASTA_SITE = join(pasta, 'dist')
    process.env.PASTA_VITRINE = join(pasta, 'site')
    const { criarApp } = await import('./app.ts')
    app = await criarApp({} as pg.Pool)
  })
  afterAll(async () => {
    await app?.close()
    delete process.env.PASTA_SITE
    delete process.env.PASTA_VITRINE
  })

  it('a raiz abre o site de venda e /app/ abre o sistema', async () => {
    const raiz = await app.inject({ url: '/' })
    expect(raiz.body).toBe('vitrine')
    expect(raiz.headers['cache-control']).toBe('no-cache')
    const sistema = await app.inject({ url: '/app/' })
    expect(sistema.body).toBe('sistema')
    const semBarra = await app.inject({ url: '/app' })
    expect(semBarra.statusCode).toBe(301)
    expect(semBarra.headers.location).toBe('/app/')
    const js = await app.inject({ url: '/app/assets/index-abc.js' })
    expect(js.headers['cache-control']).toContain('immutable')
  })

  it('/app/api/ chega na API', async () => {
    const r = await app.inject({ url: '/app/api/nao-existe' })
    expect(r.statusCode).toBe(404)
    expect(r.json()).toEqual({ erro: 'Endereço não encontrado.' })
  })
})
