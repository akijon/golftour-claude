// POST /api/admin-login — gate for the Hringir (admin) page.
// Secret: ADMIN_PIN (Worker -> Settings -> Variables and Secrets).
// CORS: same-origin in practice, but handled explicitly so the endpoint
// also works from preview URLs (*.workers.dev) during testing.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function onRequestPost({ request, env }) {
  const json = (o, status = 200) =>
    new Response(JSON.stringify(o), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  if (!env.ADMIN_PIN) return json({ ok: false, error: 'ADMIN_PIN not configured' }, 500)

  let pin = ''
  try { ({ pin } = await request.json()) } catch { /* fallthrough */ }
  if (typeof pin !== 'string' || pin.length === 0) return json({ ok: false }, 400)

  const a = new TextEncoder().encode(pin)
  const b = new TextEncoder().encode(env.ADMIN_PIN)
  const equal = a.length === b.length && a.every((v, i) => v === b[i])
  return equal ? json({ ok: true }) : json({ ok: false }, 401)
}
