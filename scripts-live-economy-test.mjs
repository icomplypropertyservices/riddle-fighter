/**
 * Live production smoke for game economy lockstep.
 * Run from riddle-fighter (has playwright):
 *   node scripts-live-economy-test.mjs
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.env.LIVE_TEST_OUT || join(ROOT, 'live-test-out')
mkdirSync(OUT, { recursive: true })

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const APPS = [
  { id: 'cities', url: 'https://cities.riddlewallet.com/' },
  { id: 'fighter', url: 'https://fighter.riddlewallet.com/' },
  { id: 'civ', url: 'https://civ.riddlewallet.com/' },
  { id: 'wallet', url: 'https://wallet.riddlewallet.com/' },
]

const results = []
const log = (...a) => console.log(...a)

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': UA, accept: '*/*' },
    redirect: 'follow',
  })
  const text = await r.text()
  return { status: r.status, text, headers: Object.fromEntries(r.headers) }
}

async function httpProbe() {
  log('\n=== HTTP PROBES ===')
  const urls = [
    'https://fighter.riddlewallet.com/health.json',
    'https://cities.riddlewallet.com/',
    'https://fighter.riddlewallet.com/',
    'https://civ.riddlewallet.com/',
    'https://wallet.riddlewallet.com/',
    'https://city.riddlewallet.com/',
    'https://civ.riddlewallet.com/api/arena',
    'https://cities.riddlewallet.com/api/health',
  ]
  for (const url of urls) {
    const t0 = Date.now()
    try {
      const { status, text } = await fetchText(url)
      const ms = Date.now() - t0
      log(
        `${String(status).padStart(3)} ${String(ms).padStart(5)}ms ${url} | ${text
          .slice(0, 140)
          .replace(/\s+/g, ' ')}`,
      )
      results.push({ kind: 'http', url, status, ms })
    } catch (e) {
      log(`ERR ${url} ${e.message}`)
      results.push({ kind: 'http', url, error: e.message })
    }
  }
}

function analyzeJs(id, js, bundlePath) {
  const markers = {
    entryCredits: js.includes('entryCredits'),
    winnerPayout: js.includes('winnerPayout'),
    platformCut: js.includes('platformCut'),
    building_place: /building_place|BUILD_PLACE|build-place|build_place/.test(js),
    tourney_entry: /tourney_entry|tourney-entry|tournament.entry|TOURNAMENT_ENTRY/.test(js),
    battle_entry: /battle_entry|battle-entry|BATTLE_ENTRY/.test(js),
    suite_key: js.includes('riddle_dev_entitlement_v1') || js.includes('rdl_dev'),
    feeBps: /feeBps|WAGER_FEE/.test(js),
    suiteSpendTag: /suiteSpendTag|fighter:battle|cities:building|civilisation:tourney/.test(js),
    creditUnit: /creditUnitUsd|USD_PER_CREDIT|0\.01/.test(js),
  }

  // Extract fee numbers near labels in minified source
  const feeHits = {}
  const patterns = [
    ['build', /BUILD_PLACE_FEE[=:,\s]*([0-9]+)/],
    ['plant', /LAND_PLANT_FEE[=:,\s]*([0-9]+)/],
    ['battle', /BATTLE_ENTRY_FEE[=:,\s]*([0-9]+)/],
    ['tourney', /TOURNAMENT_ENTRY_FEE[=:,\s]*([0-9]+)/],
    ['wagerBps', /WAGER_FEE_BPS[=:,\s]*([0-9]+)/],
    ['prizeBps', /TOURNAMENT_PRIZE_BPS[=:,\s]*([0-9]+)/],
    ['mint', /DEFAULT_MINT_CREDITS[=:,\s]*([0-9]+)/],
  ]
  for (const [k, re] of patterns) {
    const m = js.match(re)
    if (m) feeHits[k] = Number(m[1])
  }

  // Also catch re-exports that inline numbers after const names got mangled —
  // look for known pot quote: stake*2 and 1000 bps cut
  const hasQuoteShape =
    markers.winnerPayout &&
    markers.platformCut &&
    (/1000/.test(js) || /feeBps/.test(js))

  log(`[${id}] bundle ${bundlePath} ${(js.length / 1024).toFixed(0)}kb`)
  log(`[${id}] markers`, markers)
  log(`[${id}] feeHits`, feeHits, 'quoteShape', hasQuoteShape)

  return { markers, feeHits, hasQuoteShape, size: js.length, bundlePath }
}

async function nodeBundleScan(base, id) {
  try {
    const { status, text: html } = await fetchText(base)
    if (status !== 200) return { ok: false, status, reason: 'html-not-200' }
    const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/) ||
      html.match(/src='(\/assets\/index-[^']+\.js)'/)
    if (!m) {
      // Next wallet may use different chunk naming
      const m2 = html.match(/_next\/static\/chunks\/[^"']+\.js/g)
      if (m2?.length) {
        log(`[${id}] next chunks sample`, m2.slice(0, 3))
        // scan a few main chunks for suite key
        let combined = ''
        for (const path of m2.slice(0, 8)) {
          const u = new URL(path.startsWith('/') ? path : '/' + path, base).href
          const r = await fetchText(u)
          if (r.status === 200) combined += r.text
        }
        return { ok: true, ...analyzeJs(id, combined, 'next-chunks'), status }
      }
      return { ok: false, status, reason: 'no-bundle' }
    }
    const jsUrl = new URL(m[1], base).href
    const r = await fetchText(jsUrl)
    if (r.status !== 200) return { ok: false, status: r.status, reason: 'js-fetch-fail', bundle: m[1] }
    return { ok: true, ...analyzeJs(id, r.text, m[1]), status }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function browserPass() {
  log('\n=== BROWSER LIVE PASS ===')
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1400, height: 900 },
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  // Soften automation fingerprint
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  })

  for (const app of APPS) {
    const page = await context.newPage()
    const consoleErrors = []
    const failedReqs = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 220))
    })
    page.on('pageerror', (err) => consoleErrors.push(String(err.message || err).slice(0, 220)))
    page.on('response', (res) => {
      if (res.status() >= 400 && res.url().includes(new URL(app.url).host)) {
        failedReqs.push({ status: res.status(), url: res.url().slice(0, 120) })
      }
    })

    let navStatus = null
    try {
      const resp = await page.goto(app.url, { waitUntil: 'networkidle', timeout: 60000 })
      navStatus = resp?.status() ?? null
      log(`[${app.id}] goto status=${navStatus}`)
    } catch (e) {
      log(`[${app.id}] NAV FAIL ${e.message}`)
      // try domcontentloaded fallback
      try {
        const resp = await page.goto(app.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        navStatus = resp?.status() ?? null
        await page.waitForTimeout(4000)
        log(`[${app.id}] fallback status=${navStatus}`)
      } catch (e2) {
        results.push({ kind: 'browser', id: app.id, error: e2.message })
        await page.close()
        continue
      }
    }

    await page.waitForTimeout(2000)

    // Dismiss common overlays
    for (const sel of [
      'button:has-text("Accept")',
      'button:has-text("Got it")',
      'button:has-text("Continue")',
      'button:has-text("Enter")',
      'button:has-text("Close")',
      '[aria-label="Close"]',
    ]) {
      try {
        const el = page.locator(sel).first()
        if (await el.isVisible({ timeout: 400 })) await el.click({ timeout: 1000 })
      } catch {
        /* soft */
      }
    }

    await page.screenshot({ path: join(OUT, `${app.id}-1.png`), fullPage: false })

    // Seed suite credits SSOT
    await page.evaluate(() => {
      try {
        localStorage.setItem(
          'riddle_dev_entitlement_v1',
          JSON.stringify({
            v: 1,
            credits: 777,
            balance: 777,
            plan: 'free',
            updatedAt: Date.now(),
          }),
        )
        document.cookie =
          'rdl_dev=' +
          encodeURIComponent(JSON.stringify({ c: 777, t: Date.now() })) +
          '; path=/; max-age=86400; SameSite=Lax'
        window.dispatchEvent(new Event('riddle-credits-changed'))
        window.dispatchEvent(
          new StorageEvent('storage', { key: 'riddle_dev_entitlement_v1', newValue: '1' }),
        )
      } catch {
        /* soft */
      }
    })
    await page.reload({ waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(2500)
    await page.screenshot({ path: join(OUT, `${app.id}-2-seeded.png`), fullPage: false })

    const ui = await page.evaluate(() => {
      const text = document.body?.innerText || ''
      const lines = text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      const economy = lines
        .filter((s) => /cr\b|credit|suite|wager|tournament|entry|pot|battle|plant|build|treasury|gold|balance|arena/i.test(s))
        .slice(0, 30)
      const has777 = text.includes('777')
      const buttons = [...document.querySelectorAll('button, a, [role="tab"]')]
        .map((b) => (b.textContent || '').trim().replace(/\s+/g, ' '))
        .filter((t) => t.length > 0 && t.length < 48)
        .slice(0, 30)
      return {
        title: document.title,
        rootKids: document.getElementById('root')?.childElementCount ?? null,
        textLen: text.length,
        economy,
        has777,
        buttons,
        forbidden: /Forbidden|Access Denied|Just a moment/i.test(text) || /Forbidden/i.test(document.body?.innerHTML || ''),
      }
    })
    log(`[${app.id}] UI`, {
      title: ui.title,
      textLen: ui.textLen,
      rootKids: ui.rootKids,
      has777: ui.has777,
      forbidden: ui.forbidden,
      economy: ui.economy.slice(0, 10),
      buttons: ui.buttons.slice(0, 10),
    })

    // Click economy-related controls
    const clickTargets = [/tournament/i, /wager/i, /arena/i, /credits?/i, /fight/i, /lobby/i, /economy/i, /build/i]
    const clicked = []
    for (const re of clickTargets) {
      try {
        const loc = page.locator('button, a, [role="tab"], [role="button"]').filter({ hasText: re }).first()
        if (await loc.isVisible({ timeout: 500 })) {
          const label = ((await loc.textContent()) || '').trim().slice(0, 40)
          await loc.click({ timeout: 1500 })
          clicked.push(label)
          await page.waitForTimeout(700)
        }
      } catch {
        /* soft */
      }
    }
    if (clicked.length) {
      await page.screenshot({ path: join(OUT, `${app.id}-3-clicks.png`), fullPage: false })
      log(`[${app.id}] clicked`, clicked)
    }

    // Civ deep-link arena
    if (app.id === 'civ' && !ui.forbidden) {
      for (const path of ['#arena', '#/arena', '/arena', '?tab=arena']) {
        try {
          await page.goto(new URL(path, app.url).href, { waitUntil: 'domcontentloaded', timeout: 20000 })
          await page.waitForTimeout(1200)
        } catch {
          /* soft */
        }
      }
      const arenaLines = await page.evaluate(() =>
        (document.body?.innerText || '')
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => /tournament|wager|entry|cr\b|pot|arena/i.test(s))
          .slice(0, 20),
      )
      log(`[${app.id}] arena lines`, arenaLines)
      await page.screenshot({ path: join(OUT, `civ-arena.png`), fullPage: false })
      ui.arenaLines = arenaLines
    }

    const bundle = await nodeBundleScan(app.url, app.id)

    results.push({
      kind: 'browser',
      id: app.id,
      navStatus,
      ui,
      clicked,
      consoleErrors: consoleErrors.slice(0, 10),
      failedReqs: failedReqs.slice(0, 12),
      bundle,
    })
    await page.close()
  }

  await browser.close()
}

function scorecard() {
  log('\n=== SCORECARD ===')
  const browser = results.filter((r) => r.kind === 'browser')
  const expectFees = { battle: 10, tourney: 25, build: 5, plant: 0, wagerBps: 1000, prizeBps: 8000 }

  for (const r of browser) {
    const issues = []
    if (r.navStatus && r.navStatus >= 400) issues.push(`nav ${r.navStatus}`)
    if (r.ui?.forbidden) issues.push('WAF/Forbidden page')
    if ((r.ui?.textLen || 0) < 40 && !r.ui?.forbidden) issues.push('empty UI')
    if (r.consoleErrors?.some((e) => /is not defined|Cannot find module|Failed to fetch dynamically/i.test(e))) {
      issues.push('console fatal')
    }
    const m = r.bundle?.markers || {}
    if (r.id !== 'wallet' && r.bundle?.ok && !m.suite_key) issues.push('missing suite key in bundle')
    if (r.id === 'fighter' && r.bundle?.ok && !m.battle_entry && !m.entryCredits) issues.push('missing fighter economy markers')
    if (r.id === 'cities' && r.bundle?.ok && !m.building_place) issues.push('missing cities build markers')
    if (r.id === 'civ' && r.bundle?.ok && !m.entryCredits && !m.tourney_entry) issues.push('missing civ tourney markers')

    // Fee lockstep when extracted
    const fees = r.bundle?.feeHits || {}
    for (const [k, v] of Object.entries(expectFees)) {
      if (fees[k] != null && fees[k] !== v) issues.push(`fee ${k}=${fees[k]} want ${v}`)
    }

    const ok = issues.length === 0 && r.navStatus === 200 && !r.ui?.forbidden
    log(`${ok ? 'PASS' : 'FAIL'} ${r.id}`, {
      issues,
      textLen: r.ui?.textLen,
      has777: r.ui?.has777,
      economySample: (r.ui?.economy || []).slice(0, 5),
      feeHits: fees,
      suite_key: m.suite_key,
      errors: r.consoleErrors?.length || 0,
      failedReqs: r.failedReqs?.length || 0,
    })
    r.score = { ok, issues }
  }

  // Cross-app fee lockstep from bundles that exposed numbers
  const feeTable = {}
  for (const r of browser) {
    if (r.bundle?.feeHits) feeTable[r.id] = r.bundle.feeHits
  }
  log('\nFEE TABLE', feeTable)

  const summary = {
    ts: new Date().toISOString(),
    outDir: OUT,
    pass: browser.filter((r) => r.score?.ok).map((r) => r.id),
    fail: browser.filter((r) => !r.score?.ok).map((r) => r.id),
    feeTable,
  }
  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ summary, results }, null, 2))
  log('\nSUMMARY', summary)
  if (summary.fail.length) process.exitCode = 1
}

async function main() {
  await httpProbe()
  // Node-side bundle scans first (no browser dependency for economy proof)
  log('\n=== NODE BUNDLE SCANS ===')
  for (const app of APPS) {
    const b = await nodeBundleScan(app.url, app.id)
    results.push({ kind: 'bundle', id: app.id, ...b })
  }
  await browserPass()
  scorecard()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
