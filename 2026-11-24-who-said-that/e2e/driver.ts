// Drives real browser players through the actual UI. No bots, no fake sockets.
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

export interface Player {
  name: string
  ctx: BrowserContext
  page: Page
  frames: string[]
  answers: string[]
}

export async function newPlayer(browser: Browser, name: string, opts: { mobile?: boolean } = {}): Promise<Player> {
  const ctx = await browser.newContext(
    opts.mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 860 } },
  )
  const page = await ctx.newPage()
  const frames: string[] = []
  page.on('websocket', (ws) => ws.on('framereceived', (f) => frames.push(typeof f.payload === 'string' ? f.payload : f.payload.toString())))
  page.on('dialog', (d) => d.accept())
  page.on('pageerror', (e) => console.log(`[${name}] pageerror`, e.message, e.stack?.split('\n').slice(0, 4).join(' | ')))
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${name}] console`, m.text().slice(0, 300)) })
  return { name, ctx, page, frames, answers: [] }
}

export async function register(page: Page, name: string, avatar = 0) {
  await page.getByLabel(/ALIAS/).fill(name)
  await page.getByRole('radio', { name: ['cat', 'ghost', 'frog', 'alien', 'robot', 'bunny', 'mushroom', 'duck', 'blob', 'bear', 'star', 'skull'][avatar % 12], exact: true }).click()
}

export async function createRoom(p: Player): Promise<string> {
  await p.page.goto('/')
  await p.page.getByRole('button', { name: 'Open a case file' }).click()
  await register(p.page, p.name, 0)
  await p.page.getByRole('button', { name: 'Create private room' }).click()
  await p.page.waitForURL(/\/r\/[A-Z0-9]{6}$/)
  await expect(p.page.getByRole('heading', { name: 'The waiting room' })).toBeVisible()
  return p.page.url().split('/r/')[1]
}

export async function joinRoom(p: Player, code: string, avatar: number, via: 'url' | 'code' = 'url') {
  if (via === 'code') {
    await p.page.goto('/')
    await p.page.getByLabel('GOT A ROOM CODE?').fill(code.toLowerCase())
    await p.page.getByRole('button', { name: 'Join', exact: true }).click()
  } else await p.page.goto(`/r/${code}`)
  await register(p.page, p.name, avatar)
  await p.page.getByRole('button', { name: 'Enter the interrogation room' }).click()
  await expect(p.page.getByRole('heading', { name: 'The waiting room' })).toBeVisible()
}

export async function phaseOf(page: Page): Promise<string> {
  const cls = (await page.locator('.room').first().getAttribute('class', { timeout: 500 }).catch(() => null)) ?? ''
  return cls.match(/phase-([a-z_]+)/)?.[1] ?? 'none'
}

/**
 * Polls every player and acts like a human would until everyone reaches the final results.
 * Returns the round type names seen by the host.
 */
export async function playUntilFinal(players: Player[], opts: { host: Player; onPhase?: (phase: string, host: Page) => Promise<void>; timeoutMs?: number }) {
  const seenTypes = new Set<string>()
  const seenPhases = new Set<string>()
  const deadline = Date.now() + (opts.timeoutMs ?? 6 * 60_000)
  let counter = 0
  while (Date.now() < deadline) {
    const phases = await Promise.all(players.map((p) => phaseOf(p.page)))
    if (process.env.E2E_DEBUG && counter % 1 === 0) console.log(new Date().toISOString().slice(11, 19), phases.join(' '))
    if (phases.every((ph) => ph === 'final_results')) return { seenTypes, seenPhases }
    for (const [i, p] of players.entries()) {
      const ph = phases[i]
      if (!seenPhases.has(ph) && p === opts.host) {
        seenPhases.add(ph)
        await opts.onPhase?.(ph, p.page)
      }
      const page = p.page
      if (ph === 'answering') {
        if (p === opts.host) {
          const t = await page.locator('.roundbadge__type').first().textContent().catch(() => null)
          if (t) seenTypes.add(t.trim())
        }
        const box = page.locator('#answer')
        if (await box.isVisible().catch(() => false)) {
          const twoBrain = (await page.locator('.roundbadge__type').first().textContent().catch(() => ''))?.includes('Two Brain Cells')
          const text = twoBrain ? `${p.name} said ${++counter}` : `${p.name} secret ${++counter} zebra`
          await box.fill(text).catch(() => {})
          const send = page.getByRole('button', { name: 'seal & send' })
          if (await send.isEnabled().catch(() => false)) {
            await send.click().catch(() => {})
            p.answers.push(text)
          }
        }
      } else if (ph === 'guessing') {
        const accuse = page.getByRole('button', { name: /^accuse |^pick a suspect$/ })
        if (await accuse.isVisible().catch(() => false)) {
          const picks = page.locator('.pick')
          const n = await picks.count()
          if (n > 0) {
            await picks.nth((i + counter++) % n).click().catch(() => {})
            await page.getByRole('button', { name: /^accuse / }).click().catch(() => {})
          }
        }
      } else if (ph === 'reveal' && p === opts.host) {
        const next = page.getByRole('button', { name: 'next evidence →' })
        if (await next.isVisible().catch(() => false)) await next.click().catch(() => {})
      } else if (ph === 'round_results' && p === opts.host) {
        const next = page.getByRole('button', { name: /next round →|to the award ceremony →/ })
        if (await next.isVisible().catch(() => false)) await next.click().catch(() => {})
      }
    }
    await players[0].page.waitForTimeout(350)
  }
  throw new Error('game did not finish in time')
}

/** Every game:state frame a client received, parsed. */
export function states(p: Player): { phase: string; raw: string; view: Record<string, unknown> }[] {
  return p.frames
    .filter((f) => f.startsWith('42["game:state"'))
    .map((raw) => {
      const view = JSON.parse(raw.slice(2))[1]
      return { phase: view.phase as string, raw, view }
    })
}
