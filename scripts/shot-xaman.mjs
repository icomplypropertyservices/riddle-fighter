import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
try {
  await page.goto('https://fighter.riddlewallet.com/', {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.waitForTimeout(1500)

  const toggle = page.locator('[data-testid="connect-external-toggle"]')
  if (await toggle.count()) {
    const text = await toggle.textContent()
    if (text && /Connect external/i.test(text)) await toggle.click()
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'screenshots/01-lobby-external-panel.png', fullPage: false })

  const xamanBtn = page.locator('[data-testid="connect-xaman"]')
  await xamanBtn.click({ timeout: 15000 })
  await page.waitForSelector('[data-testid="xaman-signin-panel"]', { timeout: 25000 })
  await page.waitForTimeout(1500)
  await page.locator('#fighter-wallet').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'screenshots/02-xaman-signin-qr.png', fullPage: false })
  await page.screenshot({ path: 'screenshots/03-xaman-signin-full.png', fullPage: true })

  const panelText = await page.locator('[data-testid="xaman-signin-panel"]').innerText()
  const qrSrc = await page.locator('[data-testid="xaman-signin-panel"] img').getAttribute('src')
  console.log('PANEL_TEXT_START')
  console.log(panelText)
  console.log('PANEL_TEXT_END')
  console.log('QR_SRC', qrSrc)
  console.log('OK screenshots written')
} catch (e) {
  console.error('FAIL', e)
  await page.screenshot({ path: 'screenshots/00-xaman-fail.png', fullPage: true }).catch(() => {})
  process.exit(1)
} finally {
  await browser.close()
}
