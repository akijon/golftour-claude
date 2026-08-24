import { useState } from 'react'
import { supabase } from './supabase'
import { fmtHcp, friendlyError } from './utils'
import { addMinutesToTime, buildDefaultOverride, overrideKey, validateOverride, OVERRIDE_VERSION } from './grouping'

/**
 * Admin editor for manual round groupings (Hópar).
 * Drafts live in React state as an override-shaped object
 * { version, groups: [{ teeTime, playerIds }] }; nothing persists until "Vista".
 * Saves/resets go through the audited admin_set_setting RPC into app_settings
 * under key `round_groupings_<id>` (public read, admin write — no schema change).
 */
export default function GroupingsAdmin({ rounds, signups, players, groupings, reload, dirtyRef, onToast }) {
  const [roundId, setRoundId] = useState('')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const round = rounds.find(r => String(r.id) === String(roundId))
  const list = signups.filter(s => String(s.round_id) === String(roundId))
  const overrideActive = Boolean(roundId && groupings[roundId])

  function open(rid) {
    const next = String(rid)
    if (next !== roundId && dirtyRef.current.has('groups')) {
      if (!window.confirm('Óvistaðar breytingar í hópum. Halda áfram?')) return
    }
    setRoundId(next)
    setMsg('')
    dirtyRef.current.delete('groups')
    if (!next) { setDraft(null); return }
    const r = rounds.find(c => String(c.id) === next)
    const listForRound = signups.filter(s => String(s.round_id) === next)
    setDraft(groupings[next] || buildDefaultOverride(listForRound, r, players))
  }

  function mark() { dirtyRef.current.add('groups') }

  function setTeeTime(gi, value) {
    setDraft(d => ({ ...d, groups: d.groups.map((g, i) => (i === gi ? { ...g, teeTime: value } : g)) }))
    mark()
  }

  function movePlayer(pid, fromGi, toGi) {
    setDraft(d => {
      let groups = d.groups.map((g, i) => (i === fromGi ? { ...g, playerIds: g.playerIds.filter(x => x !== pid) } : g))
      if (toGi >= 0 && toGi < groups.length) {
        groups = groups.map((g, i) => (i === toGi ? { ...g, playerIds: [...g.playerIds, pid] } : g))
      }
      return { ...d, groups }
    })
    mark()
  }

  function moveUp(gi, idx) {
    if (idx <= 0) return
    setDraft(d => {
      const playerIds = d.groups[gi].playerIds
      if (idx >= playerIds.length) return d
      const groups = d.groups.map((g, j) => {
        if (j !== gi) return g
        const next = [...playerIds]
        ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
        return { ...g, playerIds: next }
      })
      return { ...d, groups }
    })
    mark()
  }

  function moveDown(gi, idx) {
    moveUp(gi, idx + 1)
  }

  function addGroup() {
    setDraft(d => {
      const teeTime = round?.tee_time ? addMinutesToTime(round.tee_time, d.groups.length * 8) : ''
      return { ...d, groups: [...d.groups, { teeTime, playerIds: [] }] }
    })
    mark()
  }

  function removeGroup(gi) {
    setDraft(d => ({ ...d, groups: d.groups.filter((_, i) => i !== gi) }))
    mark()
  }

  async function save() {
    const normalized = {
      version: OVERRIDE_VERSION,
      groups: (draft?.groups || [])
        .filter(g => g.playerIds.length > 0)
        .map(g => ({ teeTime: g.teeTime || null, playerIds: g.playerIds.map(Number) })),
    }
    const v = validateOverride(normalized)
    if (!v.ok) { setMsg('Ekki hægt að vista hópa: ' + v.errors.join(', ')); return }

    setBusy(true)
    setMsg('')
    const { error } = await supabase.rpc('admin_set_setting', {
      p_key: overrideKey(roundId),
      p_value: normalized,
      p_description: 'Handvirkir hópar',
    })
    setBusy(false)
    if (error) { setMsg('Villa: ' + friendlyError(error)); return }
    dirtyRef.current.delete('groups')
    await reload()
    onToast('Hópar vistaðir')
  }

  async function reset() {
    if (!window.confirm('Henda vistuðu hópunum og fara aftur í sjálfvirka útreikninga?')) return
    setBusy(true)
    setMsg('')
    const { error } = await supabase.rpc('admin_set_setting', {
      p_key: overrideKey(roundId),
      p_value: { version: OVERRIDE_VERSION, groups: null },
      p_description: 'Hópar aftur sjálfvirkir',
    })
    setBusy(false)
    if (error) { setMsg('Villa: ' + friendlyError(error)); return }
    dirtyRef.current.delete('groups')
    setDraft(buildDefaultOverride(list, round, players))
    await reload()
    onToast('Hópar endurstilltir')
  }

  // Player id -> player lookup for names/handicap.
  const playerById = id => players.find(p => String(p.id) === String(id))
  // Draft playerIds are numbers; normalize to strings so the Set matches the
  // string lookup of signup.player_id (same normalization as grouping.js).
  const assigned = new Set((draft?.groups || []).flatMap(g => g.playerIds.map(pid => String(pid))))
  const unassignedPlayers = list.filter(s => !assigned.has(String(s.player_id)))

  const groupSelect = (pid, fromGi) => (
    <select
      value={fromGi < 0 ? '' : String(fromGi)}
      aria-label={`Færa leikmann ${playerById(pid)?.name || ''} í hóp`}
      onChange={e => movePlayer(Number(pid), fromGi, e.target.value === '' ? -1 : Number(e.target.value))}
    >
      <option value="">Óflokkaður</option>
      {draft.groups.map((_, i) => <option key={i} value={i}>{`Hópur ${i + 1}`}</option>)}
    </select>
  )

  return (
    <section className="panel">
      <h2 className="panel-title">Hópar</h2>
      <p style={{ marginTop: 0 }}>Ráða leikmönnum í hópa fyrir hendi, breyta rástímum, eða endurstilla á sjálfvirkan útreikning.</p>
      <div className="sync-row">
        <select value={roundId} onChange={e => open(e.target.value)} aria-label="Veldu hring fyrir hópa">
          <option value="">— Veldu hring til að stilla hópa —</option>
          {rounds.map((r, i) => <option key={r.id} value={r.id}>{`H${i + 1} · ${r.title} · ${r.course}`}</option>)}
        </select>
      </div>

      {round && draft && (
        <>
          <p className="status" style={{ margin: '10px 0' }}>
            {list.length} skráð{overrideActive ? ' · virkur hópastillingur' : ''}
          </p>

          {unassignedPlayers.length > 0 && (
            <ul className="admin-list groups-unassigned">
              <li className="list-label"><strong>Óflokkaðir</strong></li>
              {unassignedPlayers.map(s => {
                const p = playerById(s.player_id)
                return (
                  <li key={s.id} className="group-row">
                    <span className="grow">{p?.name}{fmtHcp(p?.handicap) !== null && <span className="hcp">{fmtHcp(p?.handicap)}</span>}</span>
                    {groupSelect(s.player_id, -1)}
                  </li>
                )
              })}
            </ul>
          )}

          <div className="group-editor">
            {draft.groups.map((g, gi) => (
              <div key={gi} className="group-card">
                <div className="group-card-head">
                  <strong>Hópur {gi + 1}</strong>
                  <label>Rástími<input type="time" value={g.teeTime || ''} onChange={e => setTeeTime(gi, e.target.value)} aria-label={`Rástími hóps ${gi + 1}`} /></label>
                  <button className="link danger" onClick={() => removeGroup(gi)}>Eyða hóp</button>
                </div>
                {g.playerIds.length === 0 ? (
                  <p className="empty">Tómur hópur.</p>
                ) : (
                  <ul className="admin-list">
                    {g.playerIds.map((pid, idx) => {
                      const p = playerById(pid)
                      return (
                        <li key={pid} className="group-row">
                          <span className="grow">{p?.name}{fmtHcp(p?.handicap) !== null && <span className="hcp">{fmtHcp(p?.handicap)}</span>}</span>
                          <div className="row-controls">
                            <button className="icon-btn" aria-label="Færa ofar" disabled={idx === 0} onClick={() => moveUp(gi, idx)}>↑</button>
                            <button className="icon-btn" aria-label="Færa neðar" disabled={idx === g.playerIds.length - 1} onClick={() => moveDown(gi, idx)}>↓</button>
                            {groupSelect(pid, gi)}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <button className="link" onClick={addGroup}>+ Bæta við hóp</button>

          {msg && <p className="status error" role="alert" style={{ marginTop: 10 }}>{msg}</p>}
          <div className="form-actions">
            <button className="cta" disabled={busy} onClick={save}>{busy ? '…' : 'Vista hópa'}</button>
            <button className="link" disabled={busy} onClick={reset}>Endurstilla á sjálfvirka</button>
          </div>
        </>
      )}
    </section>
  )
}