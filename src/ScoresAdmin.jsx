import { useState } from 'react'
import { supabase } from './supabase'
import { friendlyError } from './utils'

export default function ScoresAdmin({ players, rounds, scores, signups, reload, onToast }) {
  const [roundId, setRoundId] = useState('')
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  function open(rid) {
    setRoundId(rid)
    const existing = {}
    for (const s of scores.filter(s => String(s.round_id) === String(rid))) {
      existing[s.player_id] = String(s.points)
    }
    setDraft(existing)
    setMsg('')
  }

  async function save() {
    setBusy(true); setMsg('')
    const rows = Object.entries(draft)
      .filter(([, v]) => v !== '' && !isNaN(Number(v)))
      .map(([pid, v]) => ({ round_id: Number(roundId), player_id: Number(pid), points: Number(v) }))
    const cleared = Object.entries(draft)
      .filter(([, v]) => v === '')
      .map(([pid]) => Number(pid))
      .filter(pid => scores.some(s => String(s.round_id) === String(roundId) && s.player_id === pid))

    let error = null
    if (rows.length) {
      ;({ error } = await supabase.from('scores').upsert(rows, { onConflict: 'round_id,player_id' }))
    }
    if (!error && cleared.length) {
      ;({ error } = await supabase.from('scores').delete()
        .eq('round_id', roundId).in('player_id', cleared))
    }
    setBusy(false)
    if (error) { setMsg('Villa: ' + friendlyError(error)); return }
    setMsg(`Vistað: ${rows.length} stig.`)
    onToast(`Vistað: ${rows.length} stig`)
    await reload()
  }

  const round = rounds.find(r => String(r.id) === String(roundId))

  // Signed-up players first, then the rest — so admin doesn't scroll past 40+ non-participants
  const signedIds = new Set(
    signups.filter(s => String(s.round_id) === String(roundId)).map(s => s.player_id)
  )
  const sortedPlayers = [...players].sort((a, b) => {
    const aIn = signedIds.has(a.id) ? 0 : 1
    const bIn = signedIds.has(b.id) ? 0 : 1
    return aIn - bIn || a.name.localeCompare(b.name)
  })

  return (
    <section className="panel">
      <h2 className="panel-title">Stig eftir hring</h2>
      <div className="sync-row">
        <select value={roundId} onChange={e => open(e.target.value)} aria-label="Veldu hring">
          <option value="">— Veldu hring til að skrá stig —</option>
          {rounds.map((r, i) => <option key={r.id} value={r.id}>{`H${i + 1} · ${r.title} · ${r.course}`}</option>)}
        </select>
      </div>

      {round && (
        <>
          <ul className="score-grid">
            {sortedPlayers.map(p => (
              <li key={p.id} className={signedIds.has(p.id) ? 'signed-up' : 'not-signed'}>
                <span className="sname">{p.name}</span>
                <input
                  inputMode="numeric" placeholder="·"
                  value={draft[p.id] ?? ''}
                  onChange={e => setDraft(d => ({ ...d, [p.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                  aria-label={`Stig: ${p.name}`}
                />
              </li>
            ))}
          </ul>
          {msg && <p className="status" style={{ marginTop: 10 }}>{msg}</p>}
          <div className="form-actions">
            <button className="cta" disabled={busy} onClick={save}>{busy ? '…' : 'Vista stig'}</button>
            <span className="empty">Tómt reit = ekkert stig (eyðir skráningu ef til). Skráðir leikmenn birtast efst.</span>
          </div>
        </>
      )}
    </section>
  )
}
