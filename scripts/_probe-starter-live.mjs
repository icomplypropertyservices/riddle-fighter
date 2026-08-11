import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
})
const page = await ctx.newPage()
await page.goto('https://fighter.riddlewallet.com/', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
})
await page.evaluate(() => {
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    /* soft */
  }
  document.cookie.split(';').forEach((c) => {
    const n = c.split('=')[0].trim()
    if (!n) return
    document.cookie = `${n}=; path=/; max-age=0`
    document.cookie = `${n}=; path=/; max-age=0; domain=.riddlewallet.com`
  })
})
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const ls = localStorage.getItem('riddle_dev_entitlement_v1')
  let credits = null
  try {
    credits = ls ? JSON.parse(ls).credits : null
  } catch {
    /* soft */
  }
  const chip = document.querySelector(
    '[data-testid="suite-credits-chip"], [data-rw-credits-chip="1"], [data-testid="realm-suite-credits"]',
  )
  return {
    credits,
    starter: localStorage.getItem('riddle_starter_credits_v1'),
    chipText: chip?.textContent?.trim()?.slice(0, 60) || null,
    bodyHas1000:
      (document.body.innerText || '').includes('1,000') ||
      (document.body.innerText || '').includes('1000'),
    url: location.href,
  }
})
console.log(JSON.stringify(info, null, 2))
const ok = info.credits === 1000 && info.starter === '1'
console.log(ok ? 'PASS starter 1000' : 'FAIL starter 1000')
await browser.close()
process.exit(ok ? 0 : 1)
