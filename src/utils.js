// Shared helpers — friendly Icelandic error messages and handicap formatting.

export function friendlyError(err) {
  if (!err) return null
  const msg = (err.message || String(err)).toLowerCase()
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials'))
    return 'Rangt netfang eða lykilorð.'
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection'))
    return 'Tenging mistókst. Athugaðu internetið.'
  if (msg.includes('jwt') || msg.includes('unauthorized') || msg.includes('permission') || msg.includes('rls') || msg.includes('policy'))
    return 'Þú hefur ekki aðgang að þessari aðgerð.'
  if (msg.includes('rate limit') || msg.includes('too many'))
    return 'Of margar tilraunir. Reyndu aftur eftir stutta stund.'
  if (msg.includes('not found') || msg.includes('does not exist'))
    return 'Fann ekki gögnin sem beðið var um.'
  return err.message || 'Óþekkt villa.'
}

export function fmtHcp(h) {
  return h === null || h === undefined ? null : Number(h).toFixed(1).replace('.', ',')
}
