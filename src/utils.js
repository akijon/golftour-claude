// Shared Icelandic formatting and user-facing error helpers.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des']
const DAYS = ['Sunnudagur', 'Mánudagur', 'Þriðjudagur', 'Miðvikudagur', 'Fimmtudagur', 'Föstudagur', 'Laugardagur']

export function fmtDate(date) {
  if (!date) return 'Dagsetning óákveðin'
  const value = new Date(`${date}T00:00:00`)
  return `${DAYS[value.getDay()]} ${value.getDate()}. ${MONTHS[value.getMonth()]}`
}

export function fmtTime(time) {
  return time ? time.slice(0, 5) : ''
}

// Rounds without a decided date are never past.
export function isPast(date) {
  if (!date) return false
  return new Date(`${date}T23:59:59`) < new Date()
}

export function friendlyError(err) {
  if (!err) return null
  const msg = (err.message || String(err)).toLowerCase()
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials'))
    return 'Rangt netfang eða lykilorð.'
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection'))
    return 'Tenging mistókst. Athugaðu internetið.'
  if (msg.includes('jwt') || msg.includes('unauthorized') || msg.includes('permission') || msg.includes('forbidden') || msg.includes('rls') || msg.includes('policy'))
    return 'Þú hefur ekki aðgang að þessari aðgerð.'
  if (msg.includes('rate limit') || msg.includes('too many'))
    return 'Of margar tilraunir. Reyndu aftur eftir stutta stund.'
  if (msg.includes('round is full'))
    return 'Hringurinn er fullskipaður.'
  if (msg.includes('round has already been played'))
    return 'Þessi hringur er liðinn.'
  if (msg.includes('player cannot sign up'))
    return 'Þessi leikmaður getur ekki skráð sig.'
  if (msg.includes('player name is required'))
    return 'Nafn leikmanns er nauðsynlegt.'
  if (msg.includes('handicap must be a number') || msg.includes('invalid input syntax for type numeric'))
    return 'Forgjöf verður að vera tala, t.d. 12,4.'
  if (msg.includes('duplicate') || msg.includes('already exists') || msg.includes('unique constraint'))
    return 'Þessi færsla er þegar til.'
  if (msg.includes('not found') || msg.includes('does not exist'))
    return 'Fann ekki gögnin sem beðið var um.'
  return 'Óvænt villa kom upp.'
}

export function fmtCourse(course) {
  return course || 'Völlur óákveðinn'
}

// Seasons present in the rounds list, newest first.
export function seasonsOf(rounds) {
  return [...new Set(rounds.map(round => round.season))].sort((a, b) => b - a)
}

// 1-based position of a round within its own season (rounds arrive sorted).
export function roundNumber(round, rounds) {
  return rounds.filter(r => r.season === round.season).findIndex(r => r.id === round.id) + 1
}

export function roundLabel(round, rounds) {
  return `${round.season} · H${roundNumber(round, rounds)} · ${round.title} · ${fmtCourse(round.course)}`
}

export function fmtHcp(h) {
  return h === null || h === undefined ? null : Number(h).toFixed(1).replace('.', ',')
}
