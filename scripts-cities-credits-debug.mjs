import { chromium } from 'playwright'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e.message||e).slice(0,200)))
page.on('console', m => { if (m.type()==='error') errors.push(m.text().slice(0,200)) })
await page.goto('https://city.riddlewallet.com/', { waitUntil: 'networkidle', timeout: 60000 })
// seed credits
await page.evaluate(() => {
  localStorage.setItem('riddle_dev_entitlement_v1', JSON.stringify({ v:1, credits: 888, balance: 888, plan:'free', updatedAt: Date.now() }))
  document.cookie = 'rdl_dev=' + encodeURIComponent(JSON.stringify({ c:888, t: Date.now() })) + '; path=/; max-age=86400; SameSite=Lax; Domain=.riddlewallet.com'
  window.dispatchEvent(new Event('riddle-credits-changed'))
})
await page.reload({ waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)
const info = await page.evaluate(() => {
  const chip = document.querySelector('[data-testid="suite-credits-chip"]')
  const hud = document.querySelector('[data-testid="realm-hud"]')
  const header = document.querySelector('[data-suite-header="1"]')
  const seals = [...document.querySelectorAll('.resource-seal, [class*="ResourceSeal"], .sf-realm-meters')].map(e => e.textContent?.slice(0,80))
  const text = document.body.innerText
  const crLines = text.split('\n').map(s=>s.trim()).filter(s=>/cr|credit|gold|888|suite/i.test(s)).slice(0,25)
  return {
    title: document.title,
    hasHeader: !!header,
    headerHtml: header?.outerHTML?.slice(0,500) || null,
    chip: chip ? { text: chip.textContent, html: chip.outerHTML.slice(0,300), data: chip.getAttribute('data-suite-credits') } : null,
    hud: hud ? hud.textContent?.slice(0,200) : null,
    seals,
    crLines,
    ls: localStorage.getItem('riddle_dev_entitlement_v1')?.slice(0,120),
    cookie: document.cookie.includes('rdl_dev'),
  }
})
console.log(JSON.stringify({ info, errors: errors.slice(0,15) }, null, 2))
await page.screenshot({ path: 'C:/Users/E-Store/riddle-cities/live-credits-debug.png' })
await browser.close()
