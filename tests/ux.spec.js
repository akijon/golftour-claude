import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const players = Array.from({ length: 24 }, (_, index) => ({
  id: index + 1,
  name: index === 0 ? 'Margrét S. Sævarsdóttir' : `Leikmaður ${index + 1}`,
  position: 'Slökkvari',
  active: true,
  deleted_at: null,
  handicap: index === 0 ? 12.4 : 8 + index / 10,
}))

const rounds = [
  { id: 1, title: 'Opnunarhringur', course: 'Grafarholt', round_date: '2020-05-29', tee_time: '16:30:00', max_players: 24, notes: 'Mæting 30 mínútum fyrir rástíma.' },
  { id: 2, title: 'Hella', course: 'Golfvöllurinn Hellu', round_date: '2020-06-19', tee_time: '15:00:00', max_players: 28, notes: '' },
  { id: 3, title: 'Akranes', course: 'Garðavöllur', round_date: '2020-07-17', tee_time: '14:30:00', max_players: null, notes: 'Grill að leik loknum.' },
  { id: 4, title: 'Mosfellsbær', course: 'Hlíðavöllur', round_date: '2099-08-28', tee_time: '15:30:00', max_players: 24, notes: '' },
  { id: 5, title: 'Lokahringur', course: 'Keilir', round_date: '2099-09-18', tee_time: '14:00:00', max_players: 20, notes: 'Verðlaunaafhending eftir hring.' },
]

const signups = rounds.flatMap(round =>
  players.slice(0, round.id === 5 ? 8 : 20).map((player, index) => ({
    id: round.id * 100 + index,
    round_id: round.id,
    player_id: player.id,
  })),
)

const scores = rounds.slice(0, 3).flatMap(round =>
  players.slice(0, 4).map(player => ({
    id: round.id * 100 + player.id,
    round_id: round.id,
    player_id: player.id,
    points: 30 + player.id + round.id,
  })),
)

async function mockSupabase(page, { signupFailure = false, withdrawalFailure = false } = {}) {
  await page.route('http://127.0.0.1:9999/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = { 'access-control-allow-origin': '*' }

    const signupMutation = url.pathname.includes('/rest/v1/signups')
    if (signupMutation && ((request.method() === 'POST' && signupFailure) || (request.method() === 'DELETE' && withdrawalFailure))) {
      const message = request.method() === 'POST' ? 'duplicate key' : 'mutation failed'
      await route.fulfill({ status: 409, contentType: 'application/json', headers, body: JSON.stringify({ message }) })
      return
    }

    let body = []
    if (url.pathname.includes('/rest/v1/players')) body = players
    else if (url.pathname.includes('/rest/v1/rounds')) body = rounds
    else if (url.pathname.includes('/rest/v1/signups')) body = signups
    else if (url.pathname.includes('/rest/v1/scores')) body = scores
    else if (url.pathname.includes('/auth/v1/')) body = { user: null, session: null }

    await route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(body) })
  })
}

async function openApp(page, hash = '#rounds') {
  await mockSupabase(page)
  await page.goto(`/${hash}`)
  await expect(page.getByText('Hver ert þú?')).toBeVisible()
}

test('the app reflows without horizontal page scrolling at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await openApp(page)

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }))

  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport)
})

test('mobile signup keeps upcoming actions prominent and completed rounds collapsed', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await openApp(page)

  const firstUpcoming = page.locator('.upcoming-rounds .card').first()
  await expect(firstUpcoming).toContainText('Mosfellsbær')

  const signupAction = firstUpcoming.getByRole('button', { name: 'Veldu nafn fyrst' })
  const rosterToggle = firstUpcoming.getByText(/20 skráð \/ 24/)
  const [actionBox, rosterBox] = await Promise.all([signupAction.boundingBox(), rosterToggle.boundingBox()])
  expect(actionBox?.y).toBeLessThan(rosterBox?.y ?? 0)

  const rosterDetails = firstUpcoming.locator('details.roster-details')
  await expect(rosterDetails).not.toHaveAttribute('open', '')

  const completedRounds = page.locator('details.past-rounds')
  await expect(completedRounds).not.toHaveAttribute('open', '')
  await expect(completedRounds.getByText('Opnunarhringur')).not.toBeVisible()
})

test('a failed signup is announced and leaves the action available to retry', async ({ page }) => {
  await mockSupabase(page, { signupFailure: true })
  await page.goto('/#rounds')
  await expect(page.getByText('Hver ert þú?')).toBeVisible()

  const playerPicker = page.locator('#who')
  await playerPicker.fill('Leikmaður 24')
  await page.getByRole('option', { name: /Leikmaður 24/ }).click()

  const signupAction = page.locator('.upcoming-rounds .card').first().getByRole('button', { name: 'Skrá mig' })
  await signupAction.click()

  await expect(page.getByRole('alert')).toContainText('Skráning tókst ekki. Þessi færsla er þegar til. Reyndu aftur.')
  await expect(signupAction).toBeEnabled()
})

test('a failed withdrawal is announced and remains available to retry', async ({ page }) => {
  await mockSupabase(page, { withdrawalFailure: true })
  await page.goto('/#rounds')
  await expect(page.getByText('Hver ert þú?')).toBeVisible()

  const playerPicker = page.locator('#who')
  await playerPicker.fill('Margrét')
  await page.getByRole('option', { name: /Margrét S\. Sævarsdóttir/ }).click()

  const withdrawalAction = page.locator('.upcoming-rounds .card').first().getByRole('button', { name: 'Afskrá mig' })
  await withdrawalAction.click()

  await expect(page.getByRole('alert')).toContainText('Afskráning tókst ekki. Óvænt villa kom upp. Reyndu aftur.')
  await expect(withdrawalAction).toBeEnabled()
})

test('mobile standings keep totals visible and expose per-round details', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await mockSupabase(page)
  await page.goto('/#standings')
  await expect(page.getByRole('heading', { name: 'Stigatafla — Eldtúrinn 2026' })).toBeVisible()

  const leader = page.locator('.standings-mobile-item').first()
  await expect(leader).toContainText('Leikmaður 4')
  await expect(leader.getByText('108', { exact: true })).toBeVisible()

  await leader.getByText('Stig eftir hring').click()
  await expect(leader.getByText('Opnunarhringur')).toBeVisible()

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }))
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport)
})

test('completed round content meets WCAG AA color contrast', async ({ page }) => {
  await openApp(page)
  await page.locator('details.past-rounds > summary').click()

  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  expect(results.violations).toEqual([])
})

test('primary views have no serious automated accessibility violations', async ({ page }) => {
  await mockSupabase(page)

  for (const { hash, width } of [
    { hash: '#rounds', width: 320 },
    { hash: '#standings', width: 320 },
    { hash: '#standings', width: 1440 },
    { hash: '#admin', width: 320 },
  ]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/${hash}`)
    await expect(page.locator('main')).not.toBeEmpty()

    const results = await new AxeBuilder({ page }).analyze()
    const blocking = results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact))
    expect(blocking, `${hash} at ${width}px`).toEqual([])
  }
})
