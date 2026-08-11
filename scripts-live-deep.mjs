/**
 * Deep live test: cities mount failure + fighter fee UI + civ via vercel.app + arena API
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'live-test-out')
mkdirSync(OUT, { recursive: true })
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' })
  return { status: r.status, text: await r.text(), ct: r.headers.get('content-type') }
}

function scanJs(js) {
  return {
    kb: (js.length / 1024).toFixed(0),
    suite_key: js.includes('riddle_dev_entitlement_v1') || js.includes('rdl_dev'),
    entryCredits: js.includes('entryCredits'),
    winnerPayout: js.includes('winnerPayout'),
    battle_entry: /battle_entry|BATTLE_ENTRY|battle-entry/.test(js),
    tourney_entry: /tourney_entry|TOURNAMENT_ENTRY|tournament.entry/.test(js),
    building_place: /building_place|BUILD_PLACE|build-place/.test(js),
    land_plant: /land_plant|LAND_PLANT|land-plant/.test(js),
    // string literals that survive minify
    lit10cr: (js.match(/10 cr/g) || []).length,
    lit25cr: (js.match(/25 cr/g) || []).length,
    lit5cr: (js.match(/5 cr/g) || []).length,
  }
}

async function scanApp(base, id) {
  const html = await get(base)
  if (html.status !== 200) return { id, base, status: html.status, error: html.text.slice(0, 120) }
  const m = html.text.match(/src="(\/assets\/index-[^"]+\.js)"/)
  if (!m) return { id, base, status: html.status, error: 'no bundle' }
  const js = await get(new URL(m[1], base).href)
  return { id, base, status: html.status, bundle: m[1], scan: scanJs(js.text), jsStatus: js.status }
}

async function main() {
  console.log('=== BUNDLE LOCKSTEP ===')
  const scans = []
  for (const [id, base] of [
    ['cities', 'https://cities.riddlewallet.com/'],
    ['city-alias', 'https://city.riddlewallet.com/'],
    ['fighter', 'https://fighter.riddlewallet.com/'],
    ['civ-vercel', 'https://riddle-civilisation-riddle-live.vercel.app/'],
    ['civ-domain', 'https://civ.riddlewallet.com/'],
  ]) {
    const s = await scanApp(base, id)
    scans.push(s)
    console.log(JSON.stringify(s))
  }

  console.log('\n=== API ===')
  for (const u of [
    'https://cities.riddlewallet.com/api/health',
    'https://riddle-civilisation-riddle-live.vercel.app/api/arena',
    'https://riddle-civilisation-riddle-live.vercel.app/api/live',
    'https://riddle-civilisation-riddle-live.vercel.app/api/health',
    'https://fighter.riddlewallet.com/health.json',
  ]) {
    const r = await get(u)
    console.log(r.status, u, r.text.slice(0, 280).replace(/\s+/g, ' '))
  }

  console.log('\n=== BROWSER DEEP ===')
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  })

  // CITIES debug
  {
    const page = await ctx.newPage()
    const logs = []
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`))
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
    page.on('requestfailed', (req) =>
      logs.push(`[reqfail] ${req.failure()?.errorText} ${req.url().slice(0, 120)}`),
    )
    await page.goto('https://cities.riddlewallet.com/', { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(5000)
    const info = await page.evaluate(() => ({
      title: document.title,
      rootHTML: document.getElementById('root')?.innerHTML?.slice(0, 200) || null,
      rootKids: document.getElementById('root')?.childElementCount ?? null,
      scripts: [...document.scripts].map((s) => s.src).filter(Boolean),
      bodyClass: document.body?.className,
      htmlLen: document.documentElement.outerHTML.length,
    }))
    await page.screenshot({ path: join(OUT, 'deep-cities.png') })
    console.log('CITIES', info)
    console.log('CITIES LOGS', logs.slice(0, 20))
    writeFileSync(join(OUT, 'cities-console.json'), JSON.stringify({ info, logs }, null, 2))
    await page.close()
  }

  // FIGHTER fee proof + seed credits
  {
    const page = await ctx.newPage()
    await page.goto('https://fighter.riddlewallet.com/', { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(2000)
    // Seed entitlement in shapes suite-credits might accept
    await page.evaluate(() => {
      const shapes = [
        { credits: 500, balance: 500, updatedAt: Date.now() },
        { v: 1, credits: 500, balance: 500 },
        { entitlement: { credits: 500 } },
      ]
      localStorage.setItem('riddle_dev_entitlement_v1', JSON.stringify(shapes[0]))
      document.cookie =
        'rdl_dev=' +
        encodeURIComponent(JSON.stringify({ c: 500, t: Date.now() })) +
        '; path=/; max-age=86400; SameSite=Lax'
      window.dispatchEvent(new Event('riddle-credits-changed'))
    })
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)

    // Click tournament mode if present
    for (const re of [/tournament/i, /tourney/i, /wager/i, /fight/i]) {
      try {
        const b = page.locator('button, [role="tab"]').filter({ hasText: re }).first()
        if (await b.isVisible({ timeout: 600 })) {
          await b.click()
          await page.waitForTimeout(800)
        }
      } catch {
        /* soft */
      }
    }
    const text = await page.locator('body').innerText()
    const feeLines = text
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => /\d+\s*cr|entry|wager|tournament|pot|battle|balance|suite/i.test(s))
      .slice(0, 40)
    const counts = {
      '10 cr': (text.match(/10\s*cr/gi) || []).length,
      '25 cr': (text.match(/25\s*cr/gi) || []).length,
      '20 cr': (text.match(/20\s*cr/gi) || []).length,
      '500': (text.match(/\b500\b/g) || []).length,
    }
    await page.screenshot({ path: join(OUT, 'deep-fighter.png') })
    console.log('FIGHTER feeLines', feeLines)
    console.log('FIGHTER counts', counts)
    await page.close()
  }

  // CIV via vercel.app (custom domain WAF)
  {
    const page = await ctx.newPage()
    const base = 'https://riddle-civilisation-riddle-live.vercel.app/'
    await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(2500)
    // navigate tabs
    for (const re of [/arena/i, /credits?/i, /overview/i, /agents?/i]) {
      try {
        const b = page.locator('button, a, [role="tab"]').filter({ hasText: re }).first()
        if (await b.isVisible({ timeout: 800 })) {
          await b.click()
          await page.waitForTimeout(1000)
          await page.screenshot({
            path: join(OUT, `deep-civ-${(await b.textContent())?.trim().slice(0, 12).replace(/\W/g, '') || 'tab'}.png`),
          })
        }
      } catch {
        /* soft */
      }
    }
    const text = await page.locator('body').innerText()
    const lines = text
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => /cr\b|credit|tournament|wager|entry|arena|suite|mint|agent/i.test(s))
      .slice(0, 40)
    console.log('CIV lines', lines)
    await page.screenshot({ path: join(OUT, 'deep-civ.png') })
    await page.close()
  }

  // Cross-tab credit cookie? open fighter then cities same context
  {
    const page = await ctx.newPage()
    await page.goto('https://fighter.riddlewallet.com/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      localStorage.setItem(
        'riddle_dev_entitlement_v1',
        JSON.stringify({ credits: 333, balance: 333, updatedAt: Date.now() }),
      )
      document.cookie =
        'rdl_dev=' +
        encodeURIComponent(JSON.stringify({ c: 333, t: Date.now() })) +
        '; path=/; max-age=86400; SameSite=Lax'
    })
    await page.goto('https://cities.riddlewallet.com/', { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(4000)
    const cross = await page.evaluate(() => ({
      ls: localStorage.getItem('riddle_dev_entitlement_v1')?.slice(0, 100),
      cookie: document.cookie.includes('rdl_dev'),
      rootKids: document.getElementById('root')?.childElementCount ?? null,
      textLen: (document.body?.innerText || '').length,
    }))
    console.log('CROSS fighter→cities', cross)
    await page.screenshot({ path: join(OUT, 'deep-cross-cities.png') })
    await page.close()
  }

  await browser.close()
  writeFileSync(join(OUT, 'deep-scans.json'), JSON.stringify(scans, null, 2))
  console.log('\nDone →', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
