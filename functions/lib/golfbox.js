// GolfBox classic-portal adapter (golfbox.dk, Iceland/GSÍ region)
// ---------------------------------------------------------------
// STATUS: UNVERIFIED against a live login — GolfBox has no public API for
// personal accounts, so this drives the classic ASP portal with a member
// session. Endpoints/selectors below are best-effort from research
// (2026-07-21) and WILL likely need adjustment after the first authenticated
// run. Every step reports precisely what it saw to make that adjustment easy.
//
// Flow: login (form POST, session cookie) -> search player by name
//       -> parse golfbox member id + WHS handicap.

const BASE = 'https://www.golfbox.dk'
const UA = 'Mozilla/5.0 (X11; Linux x86_64) golfhopur-shs-sync/1.0'

function cookieJar() {
  const jar = new Map()
  return {
    absorb(res) {
      // Workers' Headers exposes getSetCookie(); fall back to single header.
      const cookies = res.headers.getSetCookie?.() ??
        (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : [])
      for (const c of cookies) {
        const [pair] = c.split(';')
        const eq = pair.indexOf('=')
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    },
  }
}

async function req(jar, url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    redirect: 'manual',
    headers: {
      'User-Agent': UA,
      'Cookie': jar.header(),
      ...(opts.headers || {}),
    },
  })
  jar.absorb(res)
  // follow one redirect chain manually so cookies set mid-chain are kept
  const loc = res.headers.get('location')
  if (loc && res.status >= 300 && res.status < 400) {
    return req(jar, new URL(loc, url).href)
  }
  return res
}

export async function golfboxLogin(username, password) {
  const jar = cookieJar()
  // warm up: get portal front page + any session cookie
  await req(jar, `${BASE}/portal/login/`)
  const res = await req(jar, `${BASE}/site/login/login.asp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      loginform: 'true',
      username,
      password,
    }).toString(),
  })
  const html = await res.text()
  const loggedIn = !/password/i.test(html) || /logout|Útskrá|Log af/i.test(html)
  if (!loggedIn) {
    throw new Error(
      `GolfBox login not confirmed (HTTP ${res.status}). ` +
      `Page signature: ${html.slice(0, 300).replace(/\s+/g, ' ')}`
    )
  }
  return jar
}

// Search a player by full name. Returns { golfbox_id, handicap, matchedName }
// or { error } with diagnostics.
export async function golfboxFindPlayer(jar, fullName) {
  const url = `${BASE}/site/memberSearch/memberSearch.asp?` +
    new URLSearchParams({ name: fullName, search: '1' })
  const res = await req(jar, url)
  const html = await res.text()

  // Heuristic parses — adjust after first live run:
  // member id pattern in links like memberInfo.asp?memberid=123456 or IS-format
  const idMatch = html.match(/member(?:id|guid)=([A-Za-z0-9{}-]+)/i)
  // handicap like 12,4 / 12.4 near "hcp"/"forgjöf"/"handicap"
  const hcpMatch = html.match(/(?:hcp|handicap|forgj[öo]f)[^0-9-]{0,40}(-?\d{1,2}[.,]\d)/i)

  if (!idMatch && !hcpMatch) {
    return {
      error: 'no-match',
      diagnostics: `HTTP ${res.status}, len ${html.length}, ` +
        `head: ${html.slice(0, 200).replace(/\s+/g, ' ')}`,
    }
  }
  return {
    golfbox_id: idMatch ? idMatch[1] : null,
    handicap: hcpMatch ? Number(hcpMatch[1].replace(',', '.')) : null,
    matchedName: fullName,
  }
}
