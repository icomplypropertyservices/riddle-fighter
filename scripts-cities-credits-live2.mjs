import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  viewport: { width: 1400, height: 900 },
})).newPage()
await page.goto('https://city.riddlewallet.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(4000)
await page.evaluate(() => {
  const payload = {
    plan: 'free',
    credits: 777,
    lastGrantAt: null,
    expiresAt: null,
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem('riddle_dev_entitlement_v1', JSON.stringify(payload))
  document.cookie = 'rdl_dev=' + encodeURIComponent(JSON.stringify(payload)) + '; path=/; max-age=86400; SameSite=Lax; Domain=.riddlewallet.com'
  window.dispatchEvent(new Event('riddle-credits-changed'))
  window.dispatchEvent(new Event('storage'))
})
await page.waitForTimeout(2000)
// force soft reload of balance without full navigation
await page.evaluate(() => window.dispatchEvent(new Event('focus')))
await page.waitForTimeout(1500)
const info = await page.evaluate(() => {
  const chip = document.querySelector('[data-testid="suite-credits-chip"]')
  const realm = document.querySelector('[data-testid="realm-suite-credits"]')
  const header = document.querySelector('[data-suite-header="1"]')
  const allCr = [...document.querySelectorAll('[data-suite-credits], .rw-suite-header__credits, .sf-realm-credits')]
    .map(el => ({ t: el.textContent?.trim().slice(0,60), d: el.getAttribute('data-suite-credits'), cls: el.className }))
  const lines = (document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>/777|cr\b|credit|suite|free/i.test(s)).slice(0,20)
  return {
    url: location.href,
    rootKids: document.getElementById('root')?.childElementCount,
    hasHeader: !!header,
    chip: chip && { text: chip.textContent, data: chip.getAttribute('data-suite-credits') },
    realm: realm && { text: realm.textContent, data: realm.getAttribute('data-suite-credits') },
    allCr,
    lines,
    ls: localStorage.getItem('riddle_dev_entitlement_v1'),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/E-Store/riddle-cities/live-credits-777.png', fullPage: false })
await browser.close()
