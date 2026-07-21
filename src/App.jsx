import { useEffect, useState, useCallback } from 'react'
import { supabase, configured } from './supabase'
import PlayersAdmin from './PlayersAdmin'
import ScoresAdmin from './ScoresAdmin'
import Standings from './Standings'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des']
const DAYS = ['Sunnudagur', 'Mánudagur', 'Þriðjudagur', 'Miðvikudagur', 'Fimmtudagur', 'Föstudagur', 'Laugardagur']

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
function fmtHcp(h) {
  return h === null || h === undefined ? null : Number(h).toFixed(1).replace('.', ',')
}

export default function App() {
  const [view, setView] = useState('rounds') // 'rounds' | 'admin'
  const [players, setPlayers] = useState([])
  const [rounds, setRounds] = useState([])
  const [signups, setSignups] = useState([])
  const [scores, setScores] = useState([])
  const [me, setMe] = useState(() => localStorage.getItem('shs_player_id') || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    if (err) { setError(err.message); setLoading(false); return }
    setPlayers(p.data); setRounds(r.data); setSignups(s.data); setScores(sc.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (me) localStorage.setItem('shs_player_id', me)
  }, [me])

  if (!configured) return <Shell view={view} setView={setView}><SetupNotice /></Shell>
  if (loading) return <Shell view={view} setView={setView}><p className="status">Sæki gögn…</p></Shell>

  return (
    <Shell view={view} setView={setView}>
      {error && <p className="status error">Villa: {error} <button className="link" onClick={load}>Reyna aftur</button></p>}
      {view === 'rounds' && (
        <RoundsView players={players} rounds={rounds} signups={signups} me={me} setMe={setMe} reload={load} />
      )}
      {view === 'standings' && (
        <Standings players={players} rounds={rounds} scores={scores} />
      )}
      {view === 'admin' && (
        <AdminView rounds={rounds} signups={signups} players={players} scores={scores} reload={load} />
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
            <button className={view === 'rounds' ? 'nav-btn active' : 'nav-btn'} onClick={() => setView('rounds')}>Skráning</button>
            <button className={view === 'standings' ? 'nav-btn active' : 'nav-btn'} onClick={() => setView('standings')}>Stigatafla</button>
            <button className={view === 'admin' ? 'nav-btn active' : 'nav-btn'} onClick={() => setView('admin')}>Hringir</button>
          </nav>
        </div>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">Slökkvilið höfuðborgarsvæðisins · golfhópur</footer>
    </div>
  )
}

/* ---------------- Signup view ---------------- */

function RoundsView({ players, rounds, signups, me, setMe, reload }) {
  const [busy, setBusy] = useState(null)
  const mePlayer = players.find(p => String(p.id) === String(me))

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
      <section className="who">
        <label htmlFor="who">Hver ert þú?</label>
        <select id="who" value={me} onChange={e => setMe(e.target.value)}>
          <option value="">— Veldu nafnið þitt —</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}{fmtHcp(p.handicap) !== null ? ` — fgj ${fmtHcp(p.handicap)}` : ''}
            </option>
          ))}
        </select>
        {mePlayer && (
          <span className="who-pos">
            {mePlayer.position}
            {fmtHcp(mePlayer.handicap) !== null && <b className="hcp-badge">Fgj. {fmtHcp(mePlayer.handicap)}</b>}
          </span>
        )}
      </section>

      {rounds.length === 0 && <p className="status">Engir hringir skráðir enn. Bættu við á „Hringir“ síðunni.</p>}

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

function AdminView({ rounds, signups, players, scores, reload }) {
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function startEdit(r) {
    setEditing(r.id)
    setForm({
      title: r.title, course: r.course, round_date: r.round_date,
      tee_time: r.tee_time ? r.tee_time.slice(0, 5) : '',
      max_players: r.max_players ?? '', notes: r.notes,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancel() { setEditing(null); setForm(EMPTY); setMsg('') }

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
    if (error) { setMsg('Villa: ' + error.message); return }
    cancel()
    await reload()
  }

  async function remove(r) {
    const n = signups.filter(s => s.round_id === r.id).length
    if (!window.confirm(`Eyða „${r.title}“?${n ? ` ${n} skráningar eyðast líka.` : ''}`)) return
    await supabase.from('rounds').delete().eq('id', r.id)
    if (editing === r.id) cancel()
    await reload()
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

      <ScoresAdmin players={players} rounds={rounds} scores={scores} reload={reload} />

      <PlayersAdmin players={players} reload={reload} />
    </>
  )
}

function SetupNotice() {
  return (
    <section className="panel">
      <h2 className="panel-title">Uppsetning vantar</h2>
      <p>Settu <code>VITE_SUPABASE_URL</code> og <code>VITE_SUPABASE_ANON_KEY</code> í <code>.env</code> (eða í Cloudflare Pages umhverfisbreytur) og keyrðu <code>supabase-setup.sql</code> í Supabase SQL Editor.</p>
    </section>
  )
}
