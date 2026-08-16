// Shared Icelandic formatting and user-facing error helpers.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des']
const DAYS = ['Sunnudagur', 'Mánudagur', 'Þriðjudagur', 'Miðvikudagur', 'Fimmtudagur', 'Föstudagur', 'Laugardagur']

export function fmtDate(date) {
  if (!date) return ''
  const value = new Date(`${date}T00:00:00`)
  return `${DAYS[value.getDay()]} ${value.getDate()}. ${MONTHS[value.getMonth()]}`
}

export function fmtTime(time) {
  return time ? time.slice(0, 5) : ''
}

export function isPast(date) {
  return new Date(`${date}T23:59:59`) < new Date()
}

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
  if (msg.includes('duplicate') || msg.includes('already exists') || msg.includes('unique constraint'))
    return 'Þessi færsla er þegar til.'
  if (msg.includes('not found') || msg.includes('does not exist'))
    return 'Fann ekki gögnin sem beðið var um.'
  return 'Óvænt villa kom upp.'
}

export function fmtHcp(h) {
  return h === null || h === undefined ? null : Number(h).toFixed(1).replace('.', ',')
}
