import { useState } from 'react'
import { supabase } from './supabase'
import { softDeletePlayer } from './adminApi'
import { friendlyError } from './utils'

export default function PlayersAdmin({ players, reload, onToast }) {
  const [edit, setEdit] = useState(null) // { id, handicap, golfbox_id }
  const [confirmDel, setConfirmDel] = useState(null) // player pending confirmation
  const [msg, setMsg] = useState('')

  async function remove(player) {
    try {
      await softDeletePlayer(player.id)
      setConfirmDel(null)
      setMsg('')
      onToast(`${player.name} fjarlægður`)
      await reload()
    } catch (e) { setMsg('Villa: ' + friendlyError(e)) }
  }

  async function save() {
    const hcp = edit.handicap === '' ? null : Number(String(edit.handicap).replace(',', '.'))
    if (hcp !== null && Number.isNaN(hcp)) { setMsg('Forgjöf verður að vera tala, t.d. 12,4'); return }
    const patch = {
      handicap: hcp,
      golfbox_id: edit.golfbox_id.trim() || null,
    }
    const { error } = await supabase.from('players').update(patch).eq('id', edit.id)
    if (error) { setMsg('Villa: ' + friendlyError(error)); return }
    setMsg('')
    setEdit(null)
    onToast('Leikmanni uppfærður')
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
                  <span>{p.handicap != null ? `Fgj. ${String(p.handicap).replace('.', ',')}` : 'engin forgjöf'}</span>
                  <span>{p.golfbox_id ? `GB ${p.golfbox_id}` : ''}</span>
                </div>
                <div className="admin-actions">
                  {confirmDel?.id === p.id ? (
                    <>
                      <span className="confirm-q">Fjarlægja?</span>
                      <button className="link danger" onClick={() => remove(p)}>Já</button>
                      <button className="link" onClick={() => setConfirmDel(null)}>Nei</button>
                    </>
                  ) : (
                    <>
                      <button className="link" onClick={() =>
                        setEdit({ id: p.id, handicap: p.handicap ?? '', golfbox_id: p.golfbox_id ?? '' })
                      }>Breyta</button>
                      <button className="link danger" onClick={() => setConfirmDel(p)}>Fjarlægja</button>
                    </>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
