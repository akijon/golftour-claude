import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, configured } from './supabase'
import PlayersAdmin from './PlayersAdmin'
import ScoresAdmin from './ScoresAdmin'
import Standings from './Standings'
import { friendlyError, fmtHcp } from './utils'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des']
const DAYS = ['Sunnudagur', 'Mánudagur', 'Þriðjudagur', 'Miðvikudagur', 'Fimmtudagur', 'Föstudagur', 'Laugardagur']
const VIEWS = ['rounds', 'standings', 'admin']
const NAV_LABELS = { rounds: 'Skráning', standings: 'Stigatafla', admin: 'Stjórnun' }

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${DAYS[dt.getDay()]} ${dt.getDate()}. ${MONTHS[dt.getMonth()]}`
}
function fmtTime(t) {
  return t ? t.slice(0, 5) : ''
}
function isPast(d) {
  return new Date(d + 'T23:59:59') < new Date()
}

// --- Hash routing ---
function getHashView() {
  const h = window.location.hash.replace('#', '')
  return VIEWS.includes(h) ? h : 'rounds'
}

export default function App() {
  const [view, setView] = useState(getHashView())
  const [players, setPlayers] = useState([])
  const [rounds, setRounds] = useState([])
  const [signups, setSignups] = useState([])
  const [scores, setScores] = useState([])
  const [me, setMe] = useState(() => localStorage.getItem('shs_player_id') || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const adminDirtyRef = useRef(false)

  const load = useCallback(async () => {
    if (!configured) { setLoading(false); return }
    setError('')
    const [p, r, s, sc] = await Promise.all([
      supabase.from('players').select('*').eq('active', true).order('name'),
      supabase.from('rounds').select('*').order('round_date'),
      supabase.from('signups').select('*'),
      supabase.from('scores').select('*'),
    ])
    const err = p.error || r.error || s.error || sc.error
    if (err) { setError(friendlyError(err)); setLoading(false); return }
    setPlayers(p.data); setRounds(r.data); setSignups(s.data); setScores(sc.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (me) localStorage.setItem('shs_player_id', me)
  }, [me])

  // Sync hash <-> state
  useEffect(() => {
    const onHash = () => setView(getHashView())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Warn before leaving if admin form is dirty
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (adminDirtyRef.current) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  function navigate(next) {
    if (next === view) return
    if (view === 'admin' && adminDirtyRef.current) {
      if (!window.confirm('Óvistaðar breytingar í stjórnunarformi. Halda áfram?')) return
    }
    if (next === 'admin' && adminDirtyRef.current) adminDirtyRef.current = false
    window.location.hash = next
    setView(next)
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  if (!configured) return <Shell view={view} setView={navigate}><SetupNotice /></Shell>
  if (loading) return <Shell view={view} setView={navigate}><p className="status">Sæki gögn…</p></Shell>

  return (
    <Shell view={view} setView={navigate}>
      {toast && <div className="toast" role="status">{toast}</div>}
      {error && <p className="status error">{error} <button className="link" onClick={load}>Reyna aftur</button></p>}
      {view === 'rounds' && (
        <RoundsView players={players} rounds={rounds} signups={signups} me={me} setMe={setMe} reload={load} />
      )}
      {view === 'standings' && (
        <Standings players={players} rounds={rounds} scores={scores} />
      )}
      {view === 'admin' && (
        <AdminGate>
          <AdminView rounds={rounds} signups={signups} players={players} scores={scores} reload={load} dirtyRef={adminDirtyRef} onToast={showToast} />
        </AdminGate>
      )}
    </Shell>
  )
}

function Shell({ view, setView, children }) {
  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <span className="brand-flag" aria-hidden="true" />
            <div>
              <h1>Golfhópur SHS</h1>
              <p className="season">Sumarið 2026 · 5 hringir</p>
            </div>
          </div>
          <nav className="nav">
            {VIEWS.map(v => (
              <button key={v} className={view === v ? 'nav-btn active' : 'nav-btn'} onClick={() => setView(v)}>
                {NAV_LABELS[v]}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">Slökkvilið höfuðborgarsvæðisins · golfhópur</footer>
    </div>
  )
}

/* ---------------- Searchable player combobox ---------------- */

function PlayerCombobox({ players, me, setMe }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const ref = useRef(null)
  const mePlayer = players.find(p => String(p.id) === String(me))

  const filtered = filterPlayers(players, query)

  // Close on outside click
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function pick(id) {
    setMe(id)
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight]) pick(filtered[highlight].id) }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <section className="who">
      <label htmlFor="who">Hver ert þú?</label>
      <div className="combobox" ref={ref}>
        <input
          id="who"
          type="text"
          autoComplete="off"
          placeholder={mePlayer ? mePlayer.name : '— Veldu nafnið þitt —'}
          value={open ? query : ''}
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={e => { setOpen(true); setQuery(e.target.value); setHighlight(0) }}
          onKeyDown={onKeyDown}
          aria-expanded={open}
          aria-controls="who-list"
          role="combobox"
        />
        {open && (
          <ul id="who-list" className="combobox-list" role="listbox">
            {filtered.length === 0 && <li className="cb-empty">Engin niðurstaða fyrir „{query}“</li>}
            {filtered.map((p, i) => (
              <li key={p.id} role="option" aria-selected={String(p.id) === String(me)}
                  className={i === highlight ? 'cb-hl' : ''}
                  onMouseDown={e => { e.preventDefault(); pick(p.id) }}
                  onMouseEnter={() => setHighlight(i)}
              >
                {p.name}{fmtHcp(p.handicap) !== null ? ` — Fgj. ${fmtHcp(p.handicap)}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
      {mePlayer && (
        <span className="who-pos">
          {mePlayer.position}
          {fmtHcp(mePlayer.handicap) !== null && <b className="hcp-badge">Fgj. {fmtHcp(mePlayer.handicap)}</b>}
        </span>
      )}
      {me && <button className="link who-clear" onClick={() => setMe('')}>Hreinsa val</button>}
      <span className="who-note">Val þitt er geymt í vafranum.</span>
    </section>
  )
}

function filterPlayers(players, query) {
  return players.filter(p => {
    if (!query) return true
    const q = query.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.position && p.position.toLowerCase().includes(q))
  })
}

/* ---------------- Signup view ---------------- */

function RoundsView({ players, rounds, signups, me, setMe, reload }) {
  const [busy, setBusy] = useState(null)

  async function toggle(round, signedUp) {
    if (!me) return
    setBusy(round.id)
    if (signedUp) {
      await supabase.from('signups').delete().eq('round_id', round.id).eq('player_id', me)
    } else {
      await supabase.from('signups').insert({ round_id: round.id, player_id: Number(me) })
    }
    await reload()
    setBusy(null)
  }

  return (
    <>
      <PlayerCombobox players={players} me={me} setMe={setMe} />

      {rounds.length === 0 && <p className="status">Engir hringir skráðir enn. Bættu við á „Stjórnun“ síðunni.</p>}

      <div className="cards">
        {rounds.map((r, i) => {
          const list = signups.filter(s => s.round_id === r.id)
          const signedUp = me && list.some(s => String(s.player_id) === String(me))
          const full = r.max_players && list.length >= r.max_players && !signedUp
          const past = isPast(r.round_date)
          return (
            <article key={r.id} className={past ? 'card past' : 'card'}>
              <div className="card-head">
                <span className="round-no">{i + 1}</span>
                <div className="card-title">
                  <h2>{r.title}</h2>
                  <p className="course">{r.course}</p>
                </div>
                <div className="card-when">
                  <span className="date">{fmtDate(r.round_date)}</span>
                  {r.tee_time && <span className="tee">Rástími {fmtTime(r.tee_time)}</span>}
                </div>
              </div>
              {r.notes && <p className="notes">{r.notes}</p>}
              <div className="card-body">
                <div className="roster">
                  <p className="roster-count">
                    {list.length} skráð{r.max_players ? ` / ${r.max_players}` : ''}
                  </p>
                  <ul>
                    {list.map(s => {
                      const p = players.find(pl => pl.id === s.player_id)
                      return p ? (
                        <li key={s.id}>
                          {p.name}
                          {fmtHcp(p.handicap) !== null && <span className="hcp">{fmtHcp(p.handicap)}</span>}
                        </li>
                      ) : null
                    })}
                  </ul>
                  {list.length === 0 && <p className="empty">Enginn skráður enn — vertu fyrst(ur)!</p>}
                </div>
              </div>
              {!past && (
                <button
                  className={signedUp ? 'cta out' : 'cta'}
                  disabled={!me || busy === r.id || full}
                  onClick={() => toggle(r, signedUp)}
                >
                  {busy === r.id ? '…' : !me ? 'Veldu nafn fyrst' : full ? 'Fullbókað' : signedUp ? 'Afskrá mig' : 'Skrá mig'}
                </button>
              )}
              {past && <p className="past-label">Lokið</p>}
            </article>
          )
        })}
      </div>
    </>
  )
}

/* ---------------- Admin view: new / edit / remove rounds ---------------- */

const EMPTY = { title: '', course: '', round_date: '', tee_time: '', max_players: '', notes: '' }

function AdminView({ rounds, signups, players, scores, reload, dirtyRef, onToast }) {
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); dirtyRef.current = true }

  function startEdit(r) {
    setEditing(r.id)
    setForm({
      title: r.title, course: r.course, round_date: r.round_date,
      tee_time: r.tee_time ? r.tee_time.slice(0, 5) : '',
      max_players: r.max_players ?? '', notes: r.notes,
    })
    dirtyRef.current = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancel() { setEditing(null); setForm(EMPTY); setMsg(''); dirtyRef.current = false }

  async function save() {
    if (!form.title.trim() || !form.round_date) { setMsg('Titill og dagsetning eru nauðsynleg.'); return }
    setBusy(true); setMsg('')
    const row = {
      title: form.title.trim(),
      course: form.course.trim(),
      round_date: form.round_date,
      tee_time: form.tee_time || null,
      max_players: form.max_players ? Number(form.max_players) : null,
      notes: form.notes.trim(),
    }
    const q = editing
      ? supabase.from('rounds').update(row).eq('id', editing)
      : supabase.from('rounds').insert(row)
    const { error } = await q
    setBusy(false)
    if (error) { setMsg('Villa: ' + friendlyError(error)); return }
    cancel()
    await reload()
    onToast(editing ? 'Hring uppfærður' : 'Hringur vistaður')
  }

  async function remove(r) {
    const n = signups.filter(s => s.round_id === r.id).length
    if (!window.confirm(`Eyða „${r.title}“?${n ? ` ${n} skráningar eyðast líka.` : ''}`)) return
    const { error } = await supabase.from('rounds').delete().eq('id', r.id)
    if (error) { setMsg('Villa: ' + friendlyError(error)); return }
    if (editing === r.id) cancel()
    await reload()
    onToast('Hringi eytt')
  }

  return (
    <>
      <section className="panel">
        <h2 className="panel-title">{editing ? 'Breyta hring' : 'Nýr hringur'}</h2>
        <div className="form-grid">
          <label>Titill<input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Hringur 6" /></label>
          <label>Völlur<input value={form.course} onChange={e => set('course', e.target.value)} placeholder="Grafarholt" /></label>
          <label>Dagsetning<input type="date" value={form.round_date} onChange={e => set('round_date', e.target.value)} /></label>
          <label>Rástími<input type="time" value={form.tee_time} onChange={e => set('tee_time', e.target.value)} /></label>
          <label>Hámark leikmanna<input type="number" min="1" value={form.max_players} onChange={e => set('max_players', e.target.value)} placeholder="Ótakmarkað" /></label>
          <label className="wide">Athugasemd<input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="T.d. verðlaun, grill…" /></label>
        </div>
        {msg && <p className="status error">{msg}</p>}
        <div className="form-actions">
          <button className="cta" disabled={busy} onClick={save}>{busy ? '…' : editing ? 'Vista breytingar' : 'Bæta við hring'}</button>
          {editing && <button className="link" onClick={cancel}>Hætta við</button>}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Allir hringir</h2>
        {rounds.length === 0 && <p className="empty">Engir hringir enn.</p>}
        <ul className="admin-list">
          {rounds.map(r => (
            <li key={r.id} className={editing === r.id ? 'editing' : ''}>
              <div className="admin-info">
                <strong>{r.title}</strong>
                <span>{r.course}</span>
                <span>{fmtDate(r.round_date)}{r.tee_time ? ` · ${fmtTime(r.tee_time)}` : ''}</span>
                <span className="count">{signups.filter(s => s.round_id === r.id).length} skráð</span>
              </div>
              <div className="admin-actions">
                <button className="link" onClick={() => startEdit(r)}>Breyta</button>
                <button className="link danger" onClick={() => remove(r)}>Eyða</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ScoresAdmin players={players} rounds={rounds} scores={scores} signups={signups} reload={reload} onToast={onToast} />

      <PlayersAdmin players={players} reload={reload} onToast={onToast} />
    </>
  )
}

function AdminGate({ children }) {
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function login() {
    setBusy(true); setMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    setBusy(false)
    if (error) setMsg(friendlyError(error))
  }

  if (session === undefined) return <p className="status">Athugar aðgang…</p>
  if (session) {
    return (
      <>
        <div className="admin-bar">
          <span>Innskráð: <b>{session.user.email}</b></span>
          <button className="link" onClick={() => supabase.auth.signOut()}>Útskrá</button>
        </div>
        {children}
      </>
    )
  }
  return (
    <section className="panel gate">
      <h2 className="panel-title">Aðgangur stjórnanda</h2>
      <p>Stjórnunarsíðan er læst. Skráðu þig inn.</p>
      <div className="login-form">
        <input type="email" value={email} placeholder="Netfang" autoComplete="username"
          onChange={e => setEmail(e.target.value)} aria-label="Netfang" />
        <input type="password" value={pw} placeholder="Lykilorð" autoComplete="current-password"
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()} aria-label="Lykilorð" />
        <button className="cta" disabled={busy || !email || !pw} onClick={login}>{busy ? '…' : 'Innskrá'}</button>
      </div>
      {msg && <p className="status error" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}

function SetupNotice() {
  return (
    <section className="panel">
      <h2 className="panel-title">Uppsetning vantar</h2>
      <p>Settu <code>VITE_SUPABASE_URL</code> og <code>VITE_SUPABASE_ANON_KEY</code> í <code>.env</code> (eða Cloudflare umhverfisbreytur) og keyrðu <code>supabase-setup.sql</code> í Supabase SQL Editor.</p>
    </section>
  )
}
