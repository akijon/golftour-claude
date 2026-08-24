import { useCallback, useEffect, useState } from 'react'
import {
  createPlayer,
  fetchAdminPlayers,
  restorePlayer,
  softDeletePlayer,
  updatePlayer,
} from './adminApi'
import { fmtHcp, friendlyError } from './utils'

const EMPTY_PLAYER = {
  name: '',
  position: '',
  active: true,
  handicap: '',
  golfbox_id: '',
}

function formFromPlayer(player = EMPTY_PLAYER) {
  return {
    name: player.name ?? '',
    position: player.position ?? '',
    active: player.active ?? true,
    handicap: player.handicap ?? '',
    golfbox_id: player.golfbox_id ?? '',
  }
}

function playerPayload(form) {
  const name = form.name.trim()
  if (!name) throw new Error('player name is required')

  const handicap = form.handicap === ''
    ? null
    : Number(String(form.handicap).replace(',', '.'))
  if (handicap !== null && !Number.isFinite(handicap)) {
    throw new Error('handicap must be a number')
  }

  return {
    name,
    position: String(form.position).trim(),
    active: Boolean(form.active),
    handicap,
    golfbox_id: form.golfbox_id.trim() || null,
  }
}

function PlayerFields({ form, setForm, disabled = false }) {
  function set(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  return (
    <>
      <label className="player-name-field">Nafn
        <input required value={form.name} disabled={disabled}
          onChange={event => set('name', event.target.value)} />
      </label>
      <label>Staða
        <input value={form.position} disabled={disabled} placeholder="Valfrjálst"
          onChange={event => set('position', event.target.value)} />
      </label>
      <label>Fgj.
        <input value={form.handicap} disabled={disabled} inputMode="decimal" placeholder="12,4"
          onChange={event => set('handicap', event.target.value)} />
      </label>
      <label>GolfBox ID
        <input value={form.golfbox_id} disabled={disabled} placeholder="Valfrjálst"
          onChange={event => set('golfbox_id', event.target.value)} />
      </label>
      <label className="checkbox-field">
        <input type="checkbox" checked={form.active} disabled={disabled}
          onChange={event => set('active', event.target.checked)} />
        Virkur í skráningu
      </label>
    </>
  )
}

export default function PlayersAdmin({ reload, onToast }) {
  const [players, setPlayers] = useState([])
  const [createForm, setCreateForm] = useState(formFromPlayer())
  const [edit, setEdit] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [busy, setBusy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const loadPlayers = useCallback(async () => {
    setLoading(true)
    try {
      setPlayers(await fetchAdminPlayers())
    } catch (error) {
      setMsg('Villa: ' + friendlyError(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadPlayers() }, [loadPlayers])

  async function refreshPlayers() {
    await Promise.all([loadPlayers(), reload()])
  }

  async function addPlayer(event) {
    event.preventDefault()
    setBusy('create')
    setMsg('')
    try {
      const payload = playerPayload(createForm)
      await createPlayer(payload)
      setCreateForm(formFromPlayer())
      await refreshPlayers()
      onToast(`${payload.name} bætt við`)
    } catch (error) {
      setMsg('Villa: ' + friendlyError(error))
    } finally {
      setBusy(null)
    }
  }

  function startEdit(player) {
    setEdit({ id: player.id, originalName: player.name, ...formFromPlayer(player) })
    setMsg('')
  }

  async function saveEdit() {
    let payload
    try {
      payload = playerPayload(edit)
    } catch (error) {
      setMsg('Villa: ' + friendlyError(error))
      return
    }

    if (payload.name !== edit.originalName.trim()) {
      const confirmed = window.confirm(
        `Breyta nafni „${edit.originalName}“ í „${payload.name}“? ` +
        'Fyrri skráningar og stig haldast tengd leikmanninum.',
      )
      if (!confirmed) return
    }

    setBusy(`edit-${edit.id}`)
    setMsg('')
    try {
      await updatePlayer(edit.id, payload)
      setEdit(null)
      await refreshPlayers()
      onToast('Leikmaður uppfærður')
    } catch (error) {
      setMsg('Villa: ' + friendlyError(error))
    } finally {
      setBusy(null)
    }
  }

  async function remove(player) {
    setBusy(`remove-${player.id}`)
    setMsg('')
    try {
      await softDeletePlayer(player.id)
      setConfirmDel(null)
      await refreshPlayers()
      onToast(`${player.name} fjarlægður`)
    } catch (error) {
      setMsg('Villa: ' + friendlyError(error))
    } finally {
      setBusy(null)
    }
  }

  async function restore(player) {
    setBusy(`restore-${player.id}`)
    setMsg('')
    try {
      await restorePlayer(player.id)
      await refreshPlayers()
      onToast(`${player.name} endurheimtur`)
    } catch (error) {
      setMsg('Villa: ' + friendlyError(error))
    } finally {
      setBusy(null)
    }
  }

  const currentPlayers = players.filter(player => !player.deleted_at)
  const deletedPlayers = players.filter(player => player.deleted_at)

  return (
    <section className="panel">
      <h2 className="panel-title">Leikmenn &amp; forgjöf</h2>

      <h3 className="admin-subtitle">Bæta við leikmann</h3>
      <form onSubmit={addPlayer} noValidate>
        <div className="form-grid player-create">
          <PlayerFields form={createForm} setForm={setCreateForm} disabled={busy === 'create'} />
        </div>
        <div className="form-actions">
          <button className="cta" type="submit" disabled={busy === 'create'}>
            {busy === 'create' ? 'Bæti við…' : 'Bæta við leikmann'}
          </button>
        </div>
      </form>

      {msg && <p className="status error" role="alert">{msg}</p>}

      <h3 className="admin-subtitle player-list-title">Leikmenn</h3>
      {loading && <p className="status">Sæki leikmenn…</p>}
      {!loading && currentPlayers.length === 0 && <p className="empty">Engir leikmenn enn.</p>}
      <ul className="admin-list players">
        {currentPlayers.map(player => (
          <li key={player.id} className={edit?.id === player.id ? 'editing' : ''}>
            {edit?.id === player.id ? (
              <div className="player-edit">
                <PlayerFields form={edit} setForm={setEdit} disabled={busy === `edit-${player.id}`} />
                <button className="link" type="button" disabled={busy === `edit-${player.id}`} onClick={saveEdit}>
                  {busy === `edit-${player.id}` ? 'Vista…' : 'Vista'}
                </button>
                <button className="link" type="button" onClick={() => setEdit(null)}>Hætta við</button>
              </div>
            ) : (
              <>
                <div className="admin-info">
                  <strong>{player.name}</strong>
                  {player.position && <span>{player.position}</span>}
                  <span>{player.active ? 'Virkur' : 'Óvirkur'}</span>
                  <span>{player.handicap != null ? `Fgj. ${fmtHcp(player.handicap)}` : 'engin forgjöf'}</span>
                  {player.golfbox_id && <span>GB {player.golfbox_id}</span>}
                </div>
                <div className="admin-actions">
                  {confirmDel?.id === player.id ? (
                    <>
                      <span className="confirm-q">Fjarlægja?</span>
                      <button className="link danger" type="button" disabled={busy === `remove-${player.id}`}
                        onClick={() => remove(player)}>Já</button>
                      <button className="link" type="button" onClick={() => setConfirmDel(null)}>Nei</button>
                    </>
                  ) : (
                    <>
                      <button className="link" type="button" onClick={() => startEdit(player)}>Breyta</button>
                      <button className="link danger" type="button" onClick={() => setConfirmDel(player)}>Fjarlægja</button>
                    </>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <h3 className="admin-subtitle player-list-title">Fjarlægðir leikmenn</h3>
      {!loading && deletedPlayers.length === 0 && <p className="empty">Engir fjarlægðir leikmenn.</p>}
      <ul className="admin-list removed-players">
        {deletedPlayers.map(player => (
          <li key={player.id}>
            <div className="admin-info"><strong>{player.name}</strong></div>
            <div className="admin-actions">
              <button className="link" type="button" disabled={busy === `restore-${player.id}`}
                onClick={() => restore(player)}>
                {busy === `restore-${player.id}` ? 'Endurheimti…' : 'Endurheimta'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
