import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  viewport: { width: 1400, height: 900 },
})).newPage()
await page.goto('https://city.riddlewallet.com/', { waitUntil: 'networkidle', timeout: 60000 })
await page.evaluate(() => {
  const good = { plan:'free', credits: 654, lastGrantAt:null, expiresAt:null, updatedAt: new Date().toISOString() }
  const bad0 = { plan:'free', credits: 0, lastGrantAt:null, expiresAt:null, updatedAt: new Date(Date.now()+5000).toISOString() }
  localStorage.setItem('riddle_dev_entitlement_v1', JSON.stringify(good))
  // zero cookie with NEWER timestamp — old bug wiped positive LS
  document.cookie = 'rdl_dev=' + encodeURIComponent(JSON.stringify(bad0)) + '; path=/; max-age=86400; SameSite=Lax; Domain=.riddlewallet.com'
})
await page.reload({ waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
const info = await page.evaluate(() => {
  const chip = document.querySelector('[data-testid="suite-credits-chip"]')
  const realm = document.querySelector('[data-testid="realm-suite-credits"]')
  return {
    chip: chip?.getAttribute('data-suite-credits'),
    realm: realm?.getAttribute('data-suite-credits'),
    text: (chip?.textContent||'') + ' | ' + (realm?.textContent||''),
    ls: localStorage.getItem('riddle_dev_entitlement_v1'),
  }
})
console.log(info)
const ok = info.chip === '654' || info.realm === '654' || (info.ls||'').includes('"credits":654')
console.log(ok ? 'PASS zero-cookie cannot wipe 654' : 'FAIL still wiped')
await browser.close()
process.exit(ok?0:1)
