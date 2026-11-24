import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync } from 'node:fs'
import { createRoom, joinRoom, newPlayer, phaseOf, playUntilFinal, states, type Player } from './driver.ts'

const SHOTS = 'docs/screenshots'
mkdirSync(SHOTS, { recursive: true })

const GAME_PHASES_WITHOUT_AUTHORS = ['LOBBY', 'QUESTION', 'ANSWERING', 'GUESSING']

function assertNoLeaks(players: Player[]) {
  for (const p of players) {
    const all = states(p)
    expect(all.length).toBeGreaterThan(5)
    for (const s of all) {
      if (GAME_PHASES_WITHOUT_AUTHORS.includes(s.phase) || (s.phase === 'PAUSED' && GAME_PHASES_WITHOUT_AUTHORS.includes(String(s.view.pausedFrom)))) {
        expect(s.raw, `${p.name} received an author id during ${s.phase}`).not.toContain('"authorId"')
        expect(s.raw).not.toContain('"votes":[{')
      }
      if (s.phase === 'ANSWERING') {
        for (const other of players)
          if (other !== p) for (const t of other.answers) expect(s.raw, `${p.name} saw ${other.name}'s answer while answering`).not.toContain(t)
      }
      if (s.phase === 'GUESSING') {
        const game = s.view.game as { current: { youAreAuthor: boolean; text: string } }
        // only the author's own client is told it is theirs
        if (game.current.youAreAuthor) expect(p.answers).toContain(game.current.text)
        else expect(p.answers).not.toContain(game.current.text)
      }
    }
  }
}

test('four real players complete a full game, rematch, and nobody can read authors before reveals', async ({ browser }) => {
  const names = ['Alex', 'Jamie', 'Sam', 'Riley']
  const players = await Promise.all(names.map((n) => newPlayer(browser, n)))
  const [host, ...rest] = players
  const code = await createRoom(host)
  await host.page.screenshot({ path: `${SHOTS}/03-lobby-empty.png` })
  await joinRoom(rest[0], code, 1, 'code')
  await joinRoom(rest[1], code, 2, 'url')
  await joinRoom(rest[2], code, 7, 'url')
  await expect(host.page.locator('.suspects .suspect:not(.suspect--empty)')).toHaveCount(4)
  for (const p of rest) await p.page.getByRole('button', { name: 'mark me ready' }).click()
  await expect(host.page.getByText('4/4 ready')).toBeVisible()

  // host settings: 2 rounds, classic only, quick timers
  await host.page.getByRole('spinbutton', { name: 'custom rounds' }).fill('2')
  await host.page.getByRole('tab', { name: 'rounds' }).click()
  await host.page.getByRole('button', { name: 'classic only' }).click()
  await host.page.getByRole('tab', { name: 'quick' }).click()
  await expect(rest[0].page.locator('.ro-settings')).toContainText('rounds2')
  await host.page.screenshot({ path: `${SHOTS}/04-lobby-host.png` })
  await host.page.getByRole('button', { name: 'Begin interrogation' }).click()

  await playUntilFinal(players, {
    host,
    onPhase: async (ph, page) => {
      if (ph === 'question') await page.screenshot({ path: `${SHOTS}/05-question.png` })
    },
  })

  // final results
  for (const p of players) await expect(p.page.getByRole('heading', { name: 'And the lead detective is…' })).toBeVisible()
  await host.page.waitForTimeout(2500)
  await host.page.screenshot({ path: `${SHOTS}/10-ceremony.png`, fullPage: true })
  await rest[0].page.getByRole('tab', { name: 'intelligence report' }).click()
  await expect(rest[0].page.getByText("INVESTIGATOR'S NOTES")).toBeVisible()
  await expect(rest[0].page.getByText('GROUP CONFUSION MATRIX')).toBeVisible()
  await rest[0].page.screenshot({ path: `${SHOTS}/11-report.png`, fullPage: true })
  await rest[1].page.getByRole('tab', { name: 'share results' }).click()
  const dl = rest[1].page.waitForEvent('download')
  await rest[1].page.getByRole('button', { name: 'download my card (PNG)' }).click()
  const file = await dl
  await file.saveAs(`${SHOTS}/13-share-card.png`)
  const dl2 = rest[1].page.waitForEvent('download')
  await rest[1].page.getByRole('button', { name: 'download group card (PNG)' }).click()
  await (await dl2).saveAs(`${SHOTS}/14-group-card.png`)
  await rest[1].page.screenshot({ path: `${SHOTS}/12-share.png` })
  await expect(rest[1].page.locator('#share-text')).toHaveValue(/Who Said That\? case report/)

  assertNoLeaks(players)

  // rematch keeps the room and the players
  await host.page.getByRole('button', { name: 'rematch, same suspects →' }).click()
  for (const p of players) {
    await expect(p.page.getByRole('heading', { name: 'The waiting room' })).toBeVisible()
    await expect(p.page.locator('.suspects .suspect:not(.suspect--empty)')).toHaveCount(4)
  }
  await expect(host.page.getByText('REMATCH NO. 1')).toBeVisible()
  await Promise.all(players.map((p) => p.ctx.close()))
})

test('mid-game screens, refresh reconnect, host controls, and timeouts with missing answers', async ({ browser }) => {
  const names = ['Noor', 'Kai', 'Mo', 'Lee']
  const players = await Promise.all(names.map((n) => newPlayer(browser, n)))
  const [host, a, b, c] = players
  const code = await createRoom(host)
  for (const [i, p] of [a, b, c].entries()) await joinRoom(p, code, i + 3)
  // kick and transfer host in the lobby
  await host.page.getByRole('button', { name: 'Host options for Lee' }).click()
  await host.page.getByRole('button', { name: 'remove' }).click()
  await expect(c.page.getByText('The host removed you from this room.')).toBeVisible()
  await expect(host.page.locator('.suspects .suspect:not(.suspect--empty)')).toHaveCount(3)
  await host.page.getByRole('button', { name: 'Host options for Kai' }).click()
  await host.page.getByRole('button', { name: 'make host' }).click()
  await expect(a.page.getByRole('button', { name: /Begin interrogation/ })).toBeVisible()
  await a.page.getByRole('button', { name: 'Host options for Noor' }).click()
  await a.page.getByRole('button', { name: 'make host' }).click()
  await expect(host.page.getByRole('button', { name: /Begin interrogation/ })).toBeVisible()

  const live = [host, a, b]
  await host.page.getByRole('spinbutton', { name: 'custom rounds' }).fill('1')
  await host.page.getByRole('tab', { name: 'rounds' }).click()
  await host.page.getByRole('button', { name: 'classic only' }).click()
  await host.page.getByRole('tab', { name: 'timers' }).click()
  const slider = host.page.getByRole('slider').first()
  await slider.focus()
  for (let i = 0; i < 20; i++) await slider.press('ArrowLeft')
  await expect(host.page.getByText('answer timer: 20s')).toBeVisible()
  await host.page.getByRole('button', { name: 'Begin interrogation' }).click()

  // answering: one answers, one passes, one refreshes and answers after reconnecting
  for (const p of live) await expect(p.page.locator('#answer')).toBeVisible({ timeout: 20_000 })
  await host.page.locator('#answer').fill('i would sue a goose')
  await host.page.screenshot({ path: `${SHOTS}/06-answer.png` })
  await host.page.getByRole('button', { name: 'seal & send' }).click()
  await expect(host.page.getByText('SEALED AND DELIVERED')).toBeVisible()
  await host.page.getByRole('button', { name: 'unseal to edit' }).click()
  await host.page.locator('#answer').fill('i would sue a goose and win')
  await host.page.getByRole('button', { name: 'seal & send' }).click()
  await a.page.getByRole('button', { name: 'plead the fifth (pass)' }).click()
  await expect(a.page.getByText('you pleaded the fifth.')).toBeVisible()
  await b.page.reload()
  await expect(b.page.locator('#answer')).toBeVisible({ timeout: 20_000 })
  await expect(b.page.getByText('ROOM ' + code)).toBeVisible()
  // b never answers: the timer ends the phase and the valid answer survives
  await expect(host.page.locator('.evidence')).toBeVisible({ timeout: 40_000 })
  await expect(host.page.locator('.evidence__text')).toHaveText('i would sue a goose and win')
  await expect(host.page.getByText('act natural.')).toBeVisible()
  await a.page.locator('.pick').first().click()
  await a.page.screenshot({ path: `${SHOTS}/07-guess.png` })
  await a.page.getByRole('button', { name: /^accuse / }).click()
  await b.page.locator('.pick').nth(1).click()
  await b.page.getByRole('button', { name: /^accuse / }).click()
  await expect(a.page.locator('.folder')).toBeVisible()
  await a.page.waitForTimeout(5200)
  await expect(a.page.locator('.author-name')).toHaveText('Noor')
  await a.page.screenshot({ path: `${SHOTS}/08-reveal.png` })
  await expect(host.page.locator('.tabloid')).toBeVisible({ timeout: 20_000 })
  await host.page.screenshot({ path: `${SHOTS}/09-round-results.png`, fullPage: true })
  await host.page.getByRole('button', { name: 'to the award ceremony →' }).click()
  for (const p of live) await expect(p.page.getByRole('heading', { name: 'And the lead detective is…' })).toBeVisible()
  await Promise.all(players.map((p) => p.ctx.close()))
})

test('all 10 special round types play through with real players', async ({ browser }) => {
  const players = await Promise.all(['Ava', 'Ben', 'Cy'].map((n) => newPlayer(browser, n)))
  const [host, ...rest] = players
  const code = await createRoom(host)
  for (const [i, p] of rest.entries()) await joinRoom(p, code, i + 5)
  await host.page.getByRole('button', { name: '10', exact: true }).click()
  await host.page.getByRole('tab', { name: 'rounds' }).click()
  await host.page.getByRole('button', { name: 'always' }).click()
  await host.page.getByRole('button', { name: 'Begin interrogation' }).click()
  const { seenTypes } = await playUntilFinal(players, { host, timeoutMs: 7 * 60_000 })
  expect([...seenTypes].sort()).toEqual(
    ['Anonymous Complaints', 'Final Boss', 'Identity Theft', 'PR Disaster', 'Plot Twist', 'Speed Demon', 'The Alibi', 'Two Brain Cells', 'Unsent Message', 'Wrong Answers Only'].sort(),
  )
  assertNoLeaks(players)
  await Promise.all(players.map((p) => p.ctx.close()))
})

test('mobile layouts have no horizontal overflow and pass axe checks', async ({ browser }) => {
  const phone = await newPlayer(browser, 'Phone', { mobile: true })
  const desk = await newPlayer(browser, 'Desk')
  const third = await newPlayer(browser, 'Third')
  const noOverflow = async () => {
    const [sw, cw] = await phone.page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])
    expect(sw).toBeLessThanOrEqual(cw + 1)
  }
  const axe = async (name: string) => {
    const res = await new AxeBuilder({ page: phone.page }).disableRules(['color-contrast']).analyze()
    const serious = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(serious.map((v) => `${name}: ${v.id} ${v.nodes[0]?.target}`)).toEqual([])
  }
  await phone.page.goto('/')
  await noOverflow()
  await axe('landing')
  await phone.page.screenshot({ path: `${SHOTS}/m1-landing.png`, fullPage: false })
  for (const path of ['/decks', '/studio', '/how']) {
    await phone.page.goto(path)
    await noOverflow()
    await axe(path)
  }
  await phone.page.goto('/decks')
  await phone.page.screenshot({ path: `${SHOTS}/15-decks-mobile.png` })
  const code = await createRoom(desk)
  await phone.page.goto(`/r/${code}`)
  await noOverflow()
  await phone.page.screenshot({ path: `${SHOTS}/02-register-mobile.png` })
  await joinRoom(phone, code, 9)
  await joinRoom(third, code, 10)
  await noOverflow()
  await axe('lobby')
  await phone.page.screenshot({ path: `${SHOTS}/m2-lobby.png`, fullPage: true })
  await desk.page.getByRole('spinbutton', { name: 'custom rounds' }).fill('1')
  await desk.page.getByRole('tab', { name: 'rounds' }).click()
  await desk.page.getByRole('button', { name: 'classic only' }).click()
  await desk.page.getByRole('button', { name: 'Begin interrogation' }).click()
  await expect(phone.page.locator('#answer')).toBeVisible({ timeout: 20_000 })
  await phone.page.locator('#answer').fill('phones are for answering')
  await noOverflow()
  await axe('answer')
  await phone.page.screenshot({ path: `${SHOTS}/m3-answer.png` })
  await phone.page.getByRole('button', { name: 'seal & send' }).click()
  await desk.page.locator('#answer').fill('desk answer here')
  await desk.page.getByRole('button', { name: 'seal & send' }).click()
  await third.page.locator('#answer').fill('third answer here')
  await third.page.getByRole('button', { name: 'seal & send' }).click()
  await expect(phone.page.locator('.evidence')).toBeVisible()
  await noOverflow()
  await phone.page.screenshot({ path: `${SHOTS}/m4-guess.png` })
  expect(await phaseOf(phone.page)).toBe('guessing')
  await Promise.all([phone, desk, third].map((p) => p.ctx.close()))
})

test('landing, deck library, studio and how to play render', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Who Said That?' })).toBeVisible()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${SHOTS}/01-landing.png` })
  await page.goto('/decks')
  await expect(page.getByRole('heading', { name: 'The deck library' })).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/15-decks.png` })
  await page.goto('/studio')
  await page.getByLabel('deck name').fill('the roommate files')
  await page.getByRole('textbox', { name: 'Question 1' }).fill('Who would survive a week without wifi?')
  await page.getByRole('button', { name: 'save deck' }).click()
  await expect(page.getByText('saved “the roommate files”')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/16-studio.png` })
  await page.goto('/how')
  await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/17-how.png`, fullPage: true })
})
