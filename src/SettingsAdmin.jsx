import { useEffect, useState } from 'react'
import { fetchSettings, saveSetting } from './adminApi'
import { friendlyError } from './utils'

export default function SettingsAdmin({ onToast }) {
  const [rows, setRows] = useState(null)
  const [edit, setEdit] = useState(null)   // { key, text }
  const [adding, setAdding] = useState(null) // { key, text, description }
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try { setRows(await fetchSettings()) }
    catch (e) { setMsg(friendlyError(e)) }
  }

  // Settings are jsonb. Accept bare words as strings so admins do not have to
  // type surrounding quotes, but keep real JSON (numbers, booleans, objects)
  // intact when it parses.
  function parseValue(text) {
    const t = text.trim()
    if (t === '') return null
    try { return JSON.parse(t) } catch { return t }
  }

  async function commit(key, text, description) {
    try {
      await saveSetting(key, parseValue(text), description ?? null)
      setEdit(null); setAdding(null); setMsg('')
      onToast('Stilling vistuð')
      await load()
    } catch (e) { setMsg('Villa: ' + friendlyError(e)) }
  }

  if (rows === null && !msg) return <p className="status">Sæki stillingar…</p>

  return (
    <section className="panel">
      <h2 className="panel-title">Kerfisstillingar</h2>
      {msg && <p className="status error">{msg}</p>}

      <ul className="admin-list">
        {rows?.map(s => (
          <li key={s.key}>
            {edit?.key === s.key ? (
              <div className="player-edit">
                <strong>{s.key}</strong>
                <label>Gildi
                  <input value={edit.text} autoFocus
                    onChange={e => setEdit({ ...edit, text: e.target.value })} />
                </label>
                <button className="link" onClick={() => commit(s.key, edit.text)}>Vista</button>
                <button className="link" onClick={() => setEdit(null)}>Hætta við</button>
              </div>
            ) : (
              <>
                <div className="admin-info">
                  <strong>{s.key}</strong>
                  <span>{JSON.stringify(s.value)}</span>
                  <span>{s.description || ''}</span>
                </div>
                <div className="admin-actions">
                  <button className="link" onClick={() =>
                    setEdit({ key: s.key, text: typeof s.value === 'string' ? s.value : JSON.stringify(s.value) })
                  }>Breyta</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="player-edit">
          <label>Lykill
            <input value={adding.key} autoFocus placeholder="t.d. signup_open"
              onChange={e => setAdding({ ...adding, key: e.target.value })} />
          </label>
          <label>Gildi
            <input value={adding.text} placeholder="true"
              onChange={e => setAdding({ ...adding, text: e.target.value })} />
          </label>
          <label>Lýsing
            <input value={adding.description} placeholder="valfrjálst"
              onChange={e => setAdding({ ...adding, description: e.target.value })} />
          </label>
          <button className="link" disabled={!adding.key.trim()}
            onClick={() => commit(adding.key.trim(), adding.text, adding.description.trim() || null)}>
            Bæta við
          </button>
          <button className="link" onClick={() => setAdding(null)}>Hætta við</button>
        </div>
      ) : (
        <button className="link" onClick={() => setAdding({ key: '', text: '', description: '' })}>
          + Ný stilling
        </button>
      )}
    </section>
  )
}
