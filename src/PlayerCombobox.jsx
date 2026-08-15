import { useEffect, useState, useRef } from 'react'
import { fmtHcp } from './utils'

function filterPlayers(players, query) {
  return players.filter(p => {
    if (!query) return true
    const q = query.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.position && p.position.toLowerCase().includes(q))
  })
}

export default function PlayerCombobox({ players, me, setMe }) {
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

  function clear() {
    setMe('')
    localStorage.removeItem('shs_player_id')
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
      {me && <button className="link who-clear" onClick={clear}>Hreinsa val</button>}
      <span className="who-note">Val þitt er geymt í vafranum.</span>
    </section>
  )
}
