import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const players = Array.from({ length: 24 }, (_, index) => ({
  id: index + 1,
  name: index === 0 ? 'Margrét S. Sævarsdóttir' : `Leikmaður ${index + 1}`,
  position: 'Slökkvari',
  active: index !== 19,
  deleted_at: null,
  handicap: index === 0 ? 12.4 : 8 + index / 10,
}))

const deletedPlayer = {
  id: 99,
  name: 'Fjarlægður Leikmaður',
  position: '',
  active: false,
  deleted_at: '2026-08-20T12:00:00Z',
  handicap: null,
  golfbox_id: null,
}

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

async function mockSupabase(page, { adminLogin = false, signupFailure = false, withdrawalFailure = false, customRounds = null, customSignups = null, groups = [] } = {}) {
  await page.route(/http:\/\/(localhost|127\.0\.0\.1):9999\/.*/, async route => {
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
    if (url.pathname.includes('/rest/v1/players')) {
      const publicRoster = url.searchParams.get('active') === 'eq.true' || url.searchParams.get('deleted_at') === 'is.null'
      body = publicRoster ? players : [...players, deletedPlayer]
    }
    else if (url.pathname.includes('/rest/v1/app_settings')) body = groups
    else if (url.pathname.includes('/rest/v1/rounds')) body = customRounds || rounds
    else if (url.pathname.includes('/rest/v1/signups')) body = customSignups || signups
    else if (url.pathname.includes('/rest/v1/scores')) body = scores
    else if (url.pathname.includes('/auth/v1/token') && adminLogin) {
      body = {
        access_token: 'test-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          aud: 'authenticated',
          role: 'authenticated',
          email: '[EMAIL]',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
        },
      }
    }
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

test('grouped roster displays 4 groups with sizes 3/3/3/4 and tee times for 13 signups', async ({ page }) => {
  const customRounds = [
    { id: 10, title: 'Test 13 Signups', course: 'Testvöllur', round_date: '2099-07-01', tee_time: '15:30:00', max_players: 20, notes: '' },
  ]
  const customSignups = Array.from({ length: 13 }, (_, i) => ({
    id: 500 + i,
    round_id: 10,
    player_id: i + 1,
    created_at: `2026-06-01T10:${String(i).padStart(2, '0')}:00Z`,
  }))

  await mockSupabase(page, { customRounds, customSignups })
  await page.goto('/#rounds')
  await expect(page.getByText('Hver ert þú?')).toBeVisible()

  const card = page.locator('.upcoming-rounds .card').first()
  await card.locator('details.roster-details > summary').click()

  // Verify 4 groups exist
  const groupHeadings = card.locator('.roster-group-title')
  await expect(groupHeadings).toHaveCount(4)

  // Verify group names and tee times
  await expect(groupHeadings.nth(0)).toContainText('Hópur 1')
  await expect(groupHeadings.nth(0)).toContainText('Rástími 15:30')
  await expect(groupHeadings.nth(1)).toContainText('Hópur 2')
  await expect(groupHeadings.nth(1)).toContainText('Rástími 15:38')
  await expect(groupHeadings.nth(2)).toContainText('Hópur 3')
  await expect(groupHeadings.nth(2)).toContainText('Rástími 15:46')
  await expect(groupHeadings.nth(3)).toContainText('Hópur 4')
  await expect(groupHeadings.nth(3)).toContainText('Rástími 15:54')

  // Verify group sizes: 3, 3, 3, 4
  const groups = card.locator('.roster-group')
  await expect(groups.nth(0).locator('li')).toHaveCount(3)
  await expect(groups.nth(1).locator('li')).toHaveCount(3)
  await expect(groups.nth(2).locator('li')).toHaveCount(3)
  await expect(groups.nth(3).locator('li')).toHaveCount(4)

  // Verify earliest signups in group 1 (Margrét S. Sævarsdóttir = Player 1, Leikmaður 2, Leikmaður 3)
  await expect(groups.nth(0)).toContainText('Margrét S. Sævarsdóttir')
  await expect(groups.nth(0)).toContainText('Leikmaður 2')
  await expect(groups.nth(0)).toContainText('Leikmaður 3')
})

test('impossible 5-man signup shows notice and flat roster', async ({ page }) => {
  const customRounds = [
    { id: 10, title: 'Test 5 Signups', course: 'Testvöllur', round_date: '2099-07-01', tee_time: '15:30:00', max_players: 20, notes: '' },
  ]
  const customSignups = Array.from({ length: 5 }, (_, i) => ({
    id: 500 + i,
    round_id: 10,
    player_id: i + 1,
    created_at: `2026-06-01T10:${String(i).padStart(2, '0')}:00Z`,
  }))

  await mockSupabase(page, { customRounds, customSignups })
  await page.goto('/#rounds')
  await expect(page.getByText('Hver ert þú?')).toBeVisible()

  const card = page.locator('.upcoming-rounds .card').first()
  await card.locator('details.roster-details > summary').click()

  // Verify notice is visible
  await expect(card.locator('.roster-notice')).toContainText('Ekki er hægt að mynda 3- eða 4-manna hópa með 5 skráðum.')
  // No grouped sections
  await expect(card.locator('.roster-group-title')).toHaveCount(0)
  // Flat list has 5 players
  await expect(card.locator('.roster ul li')).toHaveCount(5)
})

test('inactive players stay in rosters but cannot be selected for signup', async ({ page }) => {
  await openApp(page)

  const playerPicker = page.locator('#who')
  await playerPicker.fill('Leikmaður 20')
  await expect(page.getByRole('option', { name: /Leikmaður 20/ })).toHaveCount(0)

  const firstUpcoming = page.locator('.upcoming-rounds .card').first()
  await firstUpcoming.locator('details.roster-details > summary').click()
  await expect(firstUpcoming.getByText('Leikmaður 20')).toBeVisible()
})

test('inactive selected players can withdraw but cannot create new signups', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shs_player_id', '20'))
  await mockSupabase(page)
  await page.goto('/#rounds')
  await expect(page.getByText('Hver ert þú?')).toBeVisible()

  await expect(page.locator('#who')).toHaveAttribute('placeholder', 'Leikmaður 20')

  const signedUpRound = page.locator('.upcoming-rounds .card').first()
  const withdrawal = signedUpRound.getByRole('button', { name: 'Afskrá mig' })
  await expect(withdrawal).toBeEnabled()

  const unsignedRound = page.locator('.upcoming-rounds .card').nth(1)
  await expect(unsignedRound.getByRole('button', { name: 'Óvirkur í skráningu' })).toBeDisabled()

  const requestPromise = page.waitForRequest(request =>
    request.method() === 'DELETE' && request.url().includes('/rest/v1/signups')
  )
  await withdrawal.click()
  const requestUrl = new URL((await requestPromise).url())
  expect(requestUrl.searchParams.get('round_id')).toBe('eq.4')
  expect(requestUrl.searchParams.get('player_id')).toBe('eq.20')
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

test('admin player management renders add and restore controls', async ({ page }) => {
  await mockSupabase(page, { adminLogin: true })
  await page.goto('/#admin')

  await page.getByLabel('Netfang').fill('admin@example.com')
  await page.getByLabel('Lykilorð').fill('test-password')
  await page.getByRole('button', { name: 'Innskrá' }).click()

  await expect(page.getByRole('heading', { name: 'Leikmenn & forgjöf' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bæta við leikmann' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fjarlægðir leikmenn' })).toBeVisible()
  await expect(page.getByText('Fjarlægður Leikmaður')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Endurheimta' })).toBeVisible()

  const playerPanel = page.getByRole('heading', { name: 'Leikmenn & forgjöf' }).locator('..')
  const createForm = playerPanel.locator('form')
  await createForm.getByLabel('Nafn').fill('Nýr Leikmaður')
  await createForm.getByLabel('Staða').fill('42')
  await createForm.getByLabel('Fgj.').fill('12,4')
  await createForm.getByLabel('GolfBox ID').fill('9-9999')

  const createRequestPromise = page.waitForRequest(request => request.url().includes('/rpc/admin_create_player'))
  await createForm.getByRole('button', { name: 'Bæta við leikmann' }).click()
  const createRequest = await createRequestPromise
  expect(createRequest.postDataJSON()).toEqual({
    p_name: 'Nýr Leikmaður',
    p_position: '42',
    p_active: true,
    p_handicap: 12.4,
    p_golfbox_id: '9-9999',
  })

  let firstPlayer = playerPanel.locator('.admin-list.players > li').first()
  await firstPlayer.getByRole('button', { name: 'Breyta' }).click()
  await firstPlayer.getByLabel('Nafn').fill('Margrét Uppfærð')
  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('Fyrri skráningar og stig haldast tengd leikmanninum.')
    await dialog.accept()
  })

  const updateRequestPromise = page.waitForRequest(request => request.url().includes('/rpc/admin_update_player'))
  await firstPlayer.getByRole('button', { name: 'Vista', exact: true }).click()
  const updateRequest = await updateRequestPromise
  expect(updateRequest.postDataJSON()).toMatchObject({
    p_player_id: 1,
    p_name: 'Margrét Uppfærð',
    p_active: true,
  })

  firstPlayer = playerPanel.locator('.admin-list.players > li').first()
  await firstPlayer.getByRole('button', { name: 'Fjarlægja' }).click()
  const removeRequestPromise = page.waitForRequest(request => request.url().includes('/rpc/admin_soft_delete_player'))
  await firstPlayer.getByRole('button', { name: 'Já' }).click()
  expect((await removeRequestPromise).postDataJSON()).toEqual({ p_player_id: 1 })

  const restoreRequestPromise = page.waitForRequest(request => request.url().includes('/rpc/admin_restore_player'))
  await playerPanel.getByRole('button', { name: 'Endurheimta' }).click()
  expect((await restoreRequestPromise).postDataJSON()).toEqual({ p_player_id: 99 })
})

test('new player changes trigger the dirty navigation guard', async ({ page }) => {
  await mockSupabase(page, { adminLogin: true })
  await page.goto('/#admin')
  await page.getByLabel('Netfang').fill('admin@example.com')
  await page.getByLabel('Lykilorð').fill('test-password')
  await page.getByRole('button', { name: 'Innskrá' }).click()

  const playerPanel = page.getByRole('heading', { name: 'Leikmenn & forgjöf' }).locator('..')
  await playerPanel.locator('form').getByLabel('Nafn').fill('Óvistaður Leikmaður')

  let dialogMessage = ''
  page.once('dialog', async dialog => {
    dialogMessage = dialog.message()
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Skráning' }).click()
  expect(dialogMessage).toContain('Óvistaðar breytingar')

  await expect(page.getByRole('heading', { name: 'Leikmenn & forgjöf' })).toBeVisible()
})

test('player edits trigger the dirty navigation guard', async ({ page }) => {
  await mockSupabase(page, { adminLogin: true })
  await page.goto('/#admin')
  await page.getByLabel('Netfang').fill('admin@example.com')
  await page.getByLabel('Lykilorð').fill('test-password')
  await page.getByRole('button', { name: 'Innskrá' }).click()

  const firstPlayer = page.locator('.admin-list.players > li').first()
  await firstPlayer.getByRole('button', { name: 'Breyta' }).click()
  await firstPlayer.getByLabel('Nafn').fill('Óvistað nafn')

  let dialogMessage = ''
  page.once('dialog', async dialog => {
    dialogMessage = dialog.message()
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Stigatafla' }).click()
  expect(dialogMessage).toContain('Óvistaðar breytingar')

  await expect(firstPlayer.getByRole('button', { name: 'Vista', exact: true })).toBeVisible()
})

test('signing out clears admin dirty markers', async ({ page }) => {
  await mockSupabase(page, { adminLogin: true })
  await page.goto('/#admin')
  await page.getByLabel('Netfang').fill('admin@example.com')
  await page.getByLabel('Lykilorð').fill('test-password')
  await page.getByRole('button', { name: 'Innskrá' }).click()

  const playerPanel = page.getByRole('heading', { name: 'Leikmenn & forgjöf' }).locator('..')
  await playerPanel.locator('form').getByLabel('Nafn').fill('Óvistaður Leikmaður')
  await page.getByRole('button', { name: 'Útskrá' }).click()
  await expect(page.getByRole('heading', { name: 'Aðgangur stjórnanda' })).toBeVisible()

  let dialogMessage = ''
  page.once('dialog', async dialog => {
    dialogMessage = dialog.message()
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Skráning' }).click()

  expect(dialogMessage).toBe('')
  await expect(page.getByText('Hver ert þú?')).toBeVisible()
})

// ---- Manual grouping overrides ----

const groupRound = { id: 10, title: 'Test 8 Signups', course: 'Testvöllur', round_date: '2099-07-01', tee_time: '15:30:00', max_players: 20, notes: '' }
const groupRoundSignups = Array.from({ length: 8 }, (_, i) => ({
  id: 500 + i,
  round_id: 10,
  player_id: i + 1,
  created_at: `2026-06-01T10:${String(i).padStart(2, '0')}:00Z`,
}))

test('stored override groups the roster and surfaces unassigned signups', async ({ page }) => {
  const groups = [
    {
      key: 'round_groupings_10',
      value: { version: 1, groups: [{ teeTime: '11:00', playerIds: [1, 2, 3, 4] }, { teeTime: '11:20', playerIds: [5, 6] }] },
    },
  ]
  await mockSupabase(page, { customRounds: [groupRound], customSignups: groupRoundSignups, groups })
  await page.goto('/#rounds')
  await expect(page.getByText('Hver ert þú?')).toBeVisible()

  const card = page.locator('.upcoming-rounds .card').first()
  await card.locator('details.roster-details > summary').click()

  const headings = card.locator('.roster-group-title')
  await expect(headings).toHaveCount(3) // 2 groups + unassigned
  await expect(headings.nth(0)).toContainText('Hópur 1')
  await expect(headings.nth(0)).toContainText('Rástími 11:00')
  await expect(headings.nth(1)).toContainText('Hópur 2')
  await expect(headings.nth(1)).toContainText('Rástími 11:20')

  const groups20 = card.locator('.roster-group')
  await expect(groups20.nth(0).locator('li')).toHaveCount(4)
  await expect(groups20.nth(1).locator('li')).toHaveCount(2)

  const unassigned = card.locator('.roster-group.unassigned')
  await expect(headings.nth(2)).toContainText('Óflokkaðir')
  await expect(unassigned.locator('li')).toHaveCount(2)
  await expect(unassigned).toContainText('Leikmaður 7')
  await expect(unassigned).toContainText('Leikmaður 8')
})

test('admin can move players between groups and save via audited RPC', async ({ page }) => {
  await mockSupabase(page, { adminLogin: true, customRounds: [groupRound], customSignups: groupRoundSignups })
  await page.goto('/#admin')
  await page.getByLabel('Netfang').fill('[EMAIL]')
  await page.getByLabel('Lykilorð').fill('test-password')
  await page.getByRole('button', { name: 'Innskrá' }).click()
  await expect(page.getByRole('heading', { name: 'Hópar' })).toBeVisible()

  await page.getByLabel('Veldu hring fyrir hópa').selectOption('10')

  // All 8 signups are grouped by default → no Óflokkaðir pool should render.
  await expect(page.locator('.groups-unassigned')).toHaveCount(0)

  // Default is 4/4 (players 1-4, 5-8). Move player 2 into group 2.
  const p2 = page.locator('.group-card').nth(0).locator('.group-row', { hasText: 'Leikmaður 2' })
  await p2.getByLabel(/Færa leikmann Leikmaður 2/).selectOption('1')
  // Adjust group 2's tee time.
  await page.locator('.group-card').nth(1).getByLabel('Rástími hóps 2').fill('11:20')

  const saveRequest = page.waitForRequest(r => r.method() === 'POST' && r.url().includes('/rpc/admin_set_setting'))
  await page.getByRole('button', { name: 'Vista hópa' }).click()
  const payload = (await saveRequest).postDataJSON()
  expect(payload.p_key).toBe('round_groupings_10')
  expect(payload.p_value).toEqual({
    version: 1,
    groups: [
      { teeTime: '15:30', playerIds: [1, 3, 4] },
      { teeTime: '11:20', playerIds: [5, 6, 7, 8, 2] },
    ],
  })
})

test('unsaved grouping edits trigger the dirty navigation guard', async ({ page }) => {
  await mockSupabase(page, { adminLogin: true, customRounds: [groupRound], customSignups: groupRoundSignups })
  await page.goto('/#admin')
  await page.getByLabel('Netfang').fill('[EMAIL]')
  await page.getByLabel('Lykilorð').fill('test-password')
  await page.getByRole('button', { name: 'Innskrá' }).click()
  await expect(page.getByRole('heading', { name: 'Hópar' })).toBeVisible()

  await page.getByLabel('Veldu hring fyrir hópa').selectOption('10')
  await page.locator('.group-card').nth(0).getByLabel('Rástími hóps 1').fill('12:00')

  let dialogMessage = ''
  page.once('dialog', async dialog => {
    dialogMessage = dialog.message()
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Skráning' }).click()
  expect(dialogMessage).toContain('Óvistaðar breytingar')
  await expect(page.getByRole('heading', { name: 'Hópar' })).toBeVisible()
})

test('admin can reset manual groupings back to automatic', async ({ page }) => {
  const groups = [
    {
      key: 'round_groupings_10',
      value: { version: 1, groups: [{ teeTime: '11:00', playerIds: [1, 2, 3, 4] }] },
    },
  ]
  await mockSupabase(page, { adminLogin: true, customRounds: [groupRound], customSignups: groupRoundSignups, groups })
  await page.goto('/#admin')
  await page.getByLabel('Netfang').fill('[EMAIL]')
  await page.getByLabel('Lykilorð').fill('test-password')
  await page.getByRole('button', { name: 'Innskrá' }).click()
  await expect(page.getByRole('heading', { name: 'Hópar' })).toBeVisible()

  await page.getByLabel('Veldu hring fyrir hópa').selectOption('10')

  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('sjálfvirka')
    await dialog.accept()
  })
  const resetRequest = page.waitForRequest(r => r.method() === 'POST' && r.url().includes('/rpc/admin_set_setting'))
  await page.getByRole('button', { name: 'Endurstilla á sjálfvirka' }).click()
  const payload = (await resetRequest).postDataJSON()
  expect(payload.p_key).toBe('round_groupings_10')
  expect(payload.p_value).toEqual({ version: 1, groups: null })
})

test('switching rounds with unsaved grouping edits confirms before discarding', async ({ page }) => {
  const otherRound = { id: 11, title: 'Annar Hringur', course: 'Annað Völlur', round_date: '2099-08-01', tee_time: '14:00:00', max_players: 20, notes: '' }
  await mockSupabase(page, { adminLogin: true, customRounds: [groupRound, otherRound], customSignups: groupRoundSignups })
  await page.goto('/#admin')
  await page.getByLabel('Netfang').fill('[EMAIL]')
  await page.getByLabel('Lykilorð').fill('test-password')
  await page.getByRole('button', { name: 'Innskrá' }).click()
  await expect(page.getByRole('heading', { name: 'Hópar' })).toBeVisible()

  await page.getByLabel('Veldu hring fyrir hópa').selectOption('10')
  await page.locator('.group-card').nth(0).getByLabel('Rástími hóps 1').fill('12:00')

  let dialogMessage = ''
  page.once('dialog', async dialog => {
    dialogMessage = dialog.message()
    await dialog.dismiss()
  })
  await page.getByLabel('Veldu hring fyrir hópa').selectOption('11')
  expect(dialogMessage).toContain('Óvistaðar breytingar')

  // Declining keeps the admin on the original round with edits intact.
  await expect(page.getByLabel('Veldu hring fyrir hópa')).toHaveValue('10')
  await expect(page.locator('.group-card').nth(0).getByLabel('Rástími hóps 1')).toHaveValue('12:00')
})
