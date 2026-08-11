import { chromium } from 'playwright'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const apps = [
  ['cities', 'https://city.riddlewallet.com/'],
  ['fighter', 'https://fighter.riddlewallet.com/'],
  ['civ', 'https://civ.riddlewallet.com/'],
  ['wallet', 'https://wallet.riddlewallet.com/'],
]

async function probe(label, url, { clear, seedZero } = {}) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  if (clear) {
    await page.evaluate(() => {
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {}
      // clear rdl_dev host + domain cookies
      document.cookie.split(';').forEach((c) => {
        const n = c.split('=')[0].trim()
        if (!n) return
        document.cookie = n + '=; path=/; max-age=0'
        document.cookie = n + '=; path=/; max-age=0; domain=.riddlewallet.com'
      })
    })
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
  }
  if (seedZero) {
    await page.evaluate(() => {
      localStorage.setItem(
        'riddle_dev_entitlement_v1',
        JSON.stringify({
          plan: 'free',
          credits: 0,
          lastGrantAt: null,
          expiresAt: null,
          updatedAt: new Date().toISOString(),
        }),
      )
      // pretend starter already claimed (the wipe scenario)
      localStorage.setItem('riddle_starter_credits_v1', '1')
      document.cookie =
        'rdl_dev=' +
        encodeURIComponent(
          JSON.stringify({
            plan: 'free',
            credits: 0,
            updatedAt: new Date().toISOString(),
          }),
        ) +
        '; path=/; max-age=86400; SameSite=Lax; Domain=.riddlewallet.com'
    })
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
  }
  await page.waitForTimeout(3500)
  const info = await page.evaluate(() => {
    const chip = document.querySelector('[data-testid="suite-credits-chip"], [data-rw-credits-chip="1"], [data-testid="realm-suite-credits"]')
    const ls = localStorage.getItem('riddle_dev_entitlement_v1')
    let credits = null
    try {
      credits = ls ? JSON.parse(ls).credits : null
    } catch {}
    const starter = localStorage.getItem('riddle_starter_credits_v1')
    return {
      url: location.href,
      chipText: chip?.textContent?.trim()?.slice(0, 40) || null,
      chipData: chip?.getAttribute('data-suite-credits') || chip?.getAttribute('data-suite-credits'),
      credits,
      starter,
      ls: ls?.slice(0, 160) || null,
      bodyHas1000: (document.body.innerText || '').includes('1,000') || (document.body.innerText || '').includes('1000'),
    }
  })
  await browser.close()
  console.log(JSON.stringify({ label, ...info }, null, 0))
  return info
}

console.log('=== FRESH browser (clear storage) — expect starter 1000 ===')
for (const [label, url] of apps) {
  await probe(label + ':fresh', url, { clear: true })
}

console.log('=== WIPED 0 + starter flag already set — should NOT stay 0 ===')
await probe('cities:wiped0', 'https://city.riddlewallet.com/', { clear: true, seedZero: true })
