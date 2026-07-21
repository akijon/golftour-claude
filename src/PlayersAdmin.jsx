import { useState } from 'react'
import { supabase } from './supabase'

export default function PlayersAdmin({ players, reload }) {
  const [edit, setEdit] = useState(null) // { id, handicap, golfbox_id }
  const [msg, setMsg] = useState('')

  async function save() {
    const hcp = edit.handicap === '' ? null : Number(String(edit.handicap).replace(',', '.'))
    if (hcp !== null && Number.isNaN(hcp)) { setMsg('Forgjöf verður að vera tala, t.d. 12,4'); return }
    const patch = {
      handicap: hcp,
      golfbox_id: edit.golfbox_id.trim() || null,
    }
    const { error } = await supabase.from('players').update(patch).eq('id', edit.id)
    if (error) { setMsg('Villa: ' + error.message); return }
    setMsg('')
    setEdit(null)
    await reload()
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Leikmenn &amp; forgjöf</h2>

      {msg && <p className="status error">{msg}</p>}
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
