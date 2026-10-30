import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'

// Builds the dev server with the pause flag in a second port and checks that
// only the splash renders and no Supabase request is made.
test('paused season shows only the splash and never calls Supabase', async ({ page }) => {
  const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '4175'], {
    env: { ...process.env, VITE_SEASON_PAUSED: 'true', VITE_SUPABASE_URL: 'http://127.0.0.1:9999', VITE_SUPABASE_ANON_KEY: 'k' },
  })
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch('http://127.0.0.1:4175/')).ok) break } catch {}
      await new Promise(r => setTimeout(r, 500))
    }
    const apiCalls = []
    page.on('request', req => { if (req.url().includes(':9999')) apiCalls.push(req.url()) })
    await page.goto('http://127.0.0.1:4175/')
    await expect(page.getByRole('heading', { name: 'Síða tilbúin og bíður eftir að Golfsumarið byrjar' })).toBeVisible()
    await expect(page.getByRole('navigation')).toHaveCount(0)
    expect(apiCalls).toEqual([])
  } finally {
    server.kill()
  }
})
