import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 800 },
})).newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e.message||e).slice(0,180)))
await page.goto('https://city.riddlewallet.com/', { waitUntil: 'networkidle', timeout: 60000 })
// Seed with CANONICAL shape (ISO updatedAt + credits field)
await page.evaluate(() => {
  const payload = {
    plan: 'free',
    credits: 888,
    lastGrantAt: null,
    expiresAt: null,
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem('riddle_dev_entitlement_v1', JSON.stringify(payload))
  // stale zero cookie with older time — must NOT wipe 888
  document.cookie = 'rdl_dev=' + encodeURIComponent(JSON.stringify({
    plan: 'free', credits: 0, lastGrantAt: null, expiresAt: null,
    updatedAt: new Date(Date.now() - 60000).toISOString(),
  })) + '; path=/; max-age=86400; SameSite=Lax; Domain=.riddlewallet.com'
  window.dispatchEvent(new Event('riddle-credits-changed'))
})
await page.reload({ waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
const info = await page.evaluate(() => {
  const chip = document.querySelector('[data-testid="suite-credits-chip"]')
  const realm = document.querySelector('[data-testid="realm-suite-credits"]')
  return {
    chipText: chip?.textContent || null,
    chipData: chip?.getAttribute('data-suite-credits'),
    realmText: realm?.textContent || null,
    realmData: realm?.getAttribute('data-suite-credits'),
    ls: localStorage.getItem('riddle_dev_entitlement_v1'),
  }
})
console.log(JSON.stringify({ info, errors }, null, 2))
const ok = info.chipData === '888' || info.realmData === '888' || (info.ls && info.ls.includes('"credits":888'))
console.log(ok ? 'PASS credits hold 888' : 'FAIL credits wiped')
await page.screenshot({ path: 'C:/Users/E-Store/riddle-cities/live-credits-fixed.png' })
await browser.close()
process.exit(ok ? 0 : 1)
