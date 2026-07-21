// POST /api/sync-handicaps — manual GolfBox handicap sync
// Cloudflare Pages Function. Secrets (CF Pages -> Settings -> Environment):
//   GOLFBOX_USER, GOLFBOX_PASS  — Aki's personal golfbox.dk login
//   SYNC_TOKEN                  — shared secret; UI sends X-Sync-Token
//   SUPABASE_URL, SUPABASE_SERVICE_KEY — service-role key for writes
// Never expose these as VITE_* vars (those are public in the bundle).

import { golfboxLogin, golfboxFindPlayer } from '../lib/golfbox.js'

export async function onRequestPost({ request, env }) {
  const json = (o, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } })

  if (request.headers.get('X-Sync-Token') !== env.SYNC_TOKEN || !env.SYNC_TOKEN) {
    return json({ error: 'unauthorized' }, 401)
  }
  for (const k of ['GOLFBOX_USER', 'GOLFBOX_PASS', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
    if (!env[k]) return json({ error: `missing secret: ${k}` }, 500)
  }

  const sb = async (path, opts = {}) => {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
        ...(opts.headers || {}),
      },
    })
    if (!r.ok) throw new Error(`supabase ${path}: ${r.status} ${await r.text()}`)
    return r.status === 204 ? null : r.json()
  }

  let jar
  try {
    jar = await golfboxLogin(env.GOLFBOX_USER, env.GOLFBOX_PASS)
  } catch (e) {
    return json({ error: 'golfbox-login-failed', detail: String(e.message) }, 502)
  }

  const players = await fetch(
    `${env.SUPABASE_URL}/rest/v1/players?active=eq.true&select=id,name,golfbox_id`,
    { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
  ).then(r => r.json())

  const results = []
  for (const p of players) {
    try {
      const found = await golfboxFindPlayer(jar, p.name)
      if (found.error) {
        results.push({ id: p.id, name: p.name, status: 'not-found', detail: found.diagnostics })
        continue
      }
      const patch = {}
      if (found.handicap !== null) patch.handicap = found.handicap
      if (found.golfbox_id && !p.golfbox_id) patch.golfbox_id = found.golfbox_id
      if (Object.keys(patch).length) {
        await sb(`players?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      }
      results.push({ id: p.id, name: p.name, status: 'ok', ...patch })
    } catch (e) {
      results.push({ id: p.id, name: p.name, status: 'error', detail: String(e.message) })
    }
    await new Promise(r => setTimeout(r, 400)) // be polite to GolfBox
  }

  const ok = results.filter(r => r.status === 'ok').length
  return json({ synced: ok, total: players.length, results })
}
