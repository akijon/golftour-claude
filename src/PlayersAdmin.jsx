import { useState } from 'react'
import { supabase } from './supabase'

export default function PlayersAdmin({ players, reload }) {
  const [edit, setEdit] = useState(null) // { id, handicap, golfbox_id }
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [syncResults, setSyncResults] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('shs_sync_token') || '')

  async function save() {
    const patch = {
      handicap: edit.handicap === '' ? null : Number(String(edit.handicap).replace(',', '.')),
      golfbox_id: edit.golfbox_id.trim() || null,
    }
    const { error } = await supabase.from('players').update(patch).eq('id', edit.id)
    if (error) { setSyncMsg('Villa: ' + error.message); return }
    setEdit(null)
    await reload()
  }

  async function sync() {
    if (!token) { setSyncMsg('Settu inn sync-lykil fyrst (SYNC_TOKEN úr Cloudflare).'); return }
    localStorage.setItem('shs_sync_token', token)
    setSyncing(true); setSyncMsg(''); setSyncResults(null)
    try {
      const res = await fetch('/api/sync-handicaps', {
        method: 'POST',
        headers: { 'X-Sync-Token': token },
      })
      const data = await res.json()
      if (!res.ok) {
        setSyncMsg(`Samstilling mistókst: ${data.error}${data.detail ? ' — ' + data.detail : ''}`)
      } else {
        setSyncMsg(`Samstillt: ${data.synced} af ${data.total} leikmönnum uppfærðir.`)
        setSyncResults(data.results.filter(r => r.status !== 'ok'))
        await reload()
      }
    } catch (e) {
      setSyncMsg('Netvilla: ' + e.message)
    }
    setSyncing(false)
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Leikmenn &amp; forgjöf</h2>

      <div className="sync-row">
        <input
          type="password"
          placeholder="Sync-lykill"
          value={token}
          onChange={e => setToken(e.target.value)}
          aria-label="Sync-lykill"
        />
        <button className="cta" disabled={syncing} onClick={sync}>
          {syncing ? 'Sæki frá GolfBox…' : 'Sækja forgjafir frá GolfBox'}
        </button>
      </div>
      {syncMsg && <p className="status" style={{ marginTop: 10 }}>{syncMsg}</p>}
      {syncResults && syncResults.length > 0 && (
        <details className="sync-details">
          <summary>{syncResults.length} fundust ekki / villur</summary>
          <ul>{syncResults.map(r => <li key={r.id}><b>{r.name}</b>: {r.status} <small>{r.detail}</small></li>)}</ul>
        </details>
      )}

      <ul className="admin-list players">
        {players.map(p => (
          <li key={p.id}>
            {edit?.id === p.id ? (
              <div className="player-edit">
                <strong>{p.name}</strong>
                <label>Forgjöf
                  <input value={edit.handicap} inputMode="decimal" placeholder="12,4"
                    onChange={e => setEdit({ ...edit, handicap: e.target.value })} />
                </label>
                <label>GolfBox ID
                  <input value={edit.golfbox_id} placeholder="—"
                    onChange={e => setEdit({ ...edit, golfbox_id: e.target.value })} />
                </label>
                <button className="link" onClick={save}>Vista</button>
                <button className="link" onClick={() => setEdit(null)}>Hætta við</button>
              </div>
            ) : (
              <>
                <div className="admin-info">
                  <strong>{p.name}</strong>
                  <span>{p.handicap != null ? `fgj ${String(p.handicap).replace('.', ',')}` : 'engin forgjöf'}</span>
                  <span>{p.golfbox_id ? `GB ${p.golfbox_id}` : ''}</span>
                </div>
                <div className="admin-actions">
                  <button className="link" onClick={() =>
                    setEdit({ id: p.id, handicap: p.handicap ?? '', golfbox_id: p.golfbox_id ?? '' })
                  }>Breyta</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
