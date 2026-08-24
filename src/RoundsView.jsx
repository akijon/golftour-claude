import { useState } from 'react'
import PlayerCombobox from './PlayerCombobox'
import { supabase } from './supabase'
import { fmtDate, fmtHcp, fmtTime, friendlyError, isPast } from './utils'
import { resolveGrouping } from './grouping'

function Roster({ list, players, maxPlayers, round, override }) {
  const { impossibleNotice, groups, validSignups, unassigned } = resolveGrouping(list, round, players, override)
  const hasGroups = groups.length > 0

  return (
    <details className="roster-details">
      <summary>
        <span className="roster-count">{list.length} skráð{maxPlayers ? ` / ${maxPlayers}` : ''}</span>
        <span className="roster-toggle" aria-hidden="true">Sýna lista</span>
      </summary>
      <div className="roster">
        {hasGroups ? (
          <>
            <div className="roster-groups">
              {groups.map(group => (
                <section key={group.groupNumber} className="roster-group" aria-label={`Hópur ${group.groupNumber}`}>
                  <div className="roster-group-title">
                    <strong>Hópur {group.groupNumber}</strong>
                    {group.teeTime && <span className="group-tee">Rástími {group.teeTime}</span>}
                  </div>
                  <ul>
                    {group.items.map(({ signup, player }) => (
                      <li key={signup.id}>
                        {player.name}
                        {fmtHcp(player.handicap) !== null && <span className="hcp">{fmtHcp(player.handicap)}</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {unassigned.length > 0 && (
              <section className="roster-group unassigned" aria-label="Óflokkaðir leikmenn">
                <div className="roster-group-title">
                  <strong>Óflokkaðir</strong>
                  <span className="group-tee">Skráðir eftir að hópar voru vistaðir</span>
                </div>
                <ul>
                  {unassigned.map(({ signup, player }) => (
                    <li key={signup.id}>
                      {player.name}
                      {fmtHcp(player.handicap) !== null && <span className="hcp">{fmtHcp(player.handicap)}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <>
            {impossibleNotice && (
              <p className="roster-notice" role="status">
                Ekki er hægt að mynda 3- eða 4-manna hópa með 5 skráðum.
              </p>
            )}
            <ul>
              {validSignups.map(({ signup, player }) => (
                <li key={signup.id}>
                  {player.name}
                  {fmtHcp(player.handicap) !== null && <span className="hcp">{fmtHcp(player.handicap)}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
        {list.length === 0 && <p className="empty">Enginn skráður enn — vertu fyrst(ur)!</p>}
      </div>
    </details>
  )
}

function RoundCard({ round, number, players, signups, override, me, canSignup, busy, onToggle }) {
  const list = signups.filter(signup => signup.round_id === round.id)
  const signedUp = me && list.some(signup => String(signup.player_id) === String(me))
  const full = round.max_players && list.length >= round.max_players && !signedUp
  const past = isPast(round.round_date)

  return (
    <article className={past ? 'card past' : 'card'}>
      <div className="card-head">
        <span className="round-no">{number}</span>
        <div className="card-title">
          <h2>{round.title}</h2>
          <p className="course">{round.course}</p>
        </div>
        <div className="card-when">
          <span className="date">{fmtDate(round.round_date)}</span>
          {round.tee_time && <span className="tee">Rástími {fmtTime(round.tee_time)}</span>}
        </div>
      </div>
      {round.notes && <p className="notes">{round.notes}</p>}
      {!past && (
        <button
          className={signedUp ? 'cta out' : 'cta'}
          disabled={!me || busy === round.id || full || (!canSignup && !signedUp)}
          onClick={() => onToggle(round, signedUp)}
        >
          {busy === round.id
            ? signedUp ? 'Afskrái…' : 'Skrái…'
            : !me ? 'Veldu nafn fyrst'
              : !canSignup && !signedUp ? 'Óvirkur í skráningu'
                : full ? 'Fullbókað' : signedUp ? 'Afskrá mig' : 'Skrá mig'}
        </button>
      )}
      {past && <p className="past-label">Lokið</p>}
      <Roster list={list} players={players} maxPlayers={round.max_players} round={round} override={override} />
    </article>
  )
}

export default function RoundsView({ players, rounds, signups, groupings, me, setMe, reload, onToast }) {
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState('')
  const activePlayers = players.filter(player => player.active)
  const selectedPlayer = players.find(player => String(player.id) === String(me))
  const selectedMe = selectedPlayer ? me : ''
  const canSignup = Boolean(selectedPlayer?.active)

  async function toggle(round, signedUp) {
    if (!selectedMe || (!signedUp && !canSignup)) return
    setBusy(round.id)
    setActionError('')

    try {
      const result = signedUp
        ? await supabase.from('signups').delete().eq('round_id', round.id).eq('player_id', selectedMe)
        : await supabase.from('signups').insert({ round_id: round.id, player_id: Number(selectedMe) })

      if (result.error) throw result.error

      await reload()
      onToast?.(signedUp ? 'Skráning afturkölluð' : 'Þú ert skráð(ur)')
    } catch (error) {
      const action = signedUp ? 'Afskráning' : 'Skráning'
      setActionError(`${action} tókst ekki. ${friendlyError(error)} Reyndu aftur.`)
    } finally {
      setBusy(null)
    }
  }

  const upcoming = rounds.filter(round => !isPast(round.round_date))
  const completed = rounds.filter(round => isPast(round.round_date))
  const roundNumber = round => rounds.findIndex(candidate => candidate.id === round.id) + 1

  return (
    <>
      <PlayerCombobox players={players} selectablePlayers={activePlayers} me={selectedMe} setMe={setMe} />
      {actionError && <p className="status error" role="alert">{actionError}</p>}

      {rounds.length === 0 && <p className="status">Engir hringir skráðir enn. Bættu við á „Stjórnun“ síðunni.</p>}

      {upcoming.length > 0 && (
        <section className="round-group upcoming-rounds" aria-labelledby="upcoming-rounds-heading">
          <h2 className="section-title" id="upcoming-rounds-heading">Næstu hringir</h2>
          <div className="cards">
            {upcoming.map(round => (
              <RoundCard key={round.id} round={round} number={roundNumber(round)} players={players} signups={signups} override={groupings[round.id]}
                me={selectedMe} canSignup={canSignup} busy={busy} onToggle={toggle} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <details className="past-rounds">
          <summary>
            <span>Loknir hringir</span>
            <span className="summary-count">{completed.length}</span>
          </summary>
          <div className="cards">
            {completed.map(round => (
              <RoundCard key={round.id} round={round} number={roundNumber(round)} players={players} signups={signups} override={groupings[round.id]}
                me={selectedMe} canSignup={canSignup} busy={busy} onToggle={toggle} />
            ))}
          </div>
        </details>
      )}
    </>
  )
}
