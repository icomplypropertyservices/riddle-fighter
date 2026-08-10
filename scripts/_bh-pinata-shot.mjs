import { chromium } from 'playwright';
const SHOT = process.env.SHOT;
const SHOT2 = process.env.SHOT2;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.setContent(`<!doctype html><html><body style="margin:0;background:#0f0a1a;font-family:system-ui;color:#e4e4e7;padding:24px">
  <h1 style="margin:0 0 12px;font-size:18px">Basic Human · Pinata art proof</h1>
  <p style="opacity:.7;font-size:12px;margin:0 0 16px">https://gateway.pinata.cloud/ipfs/bafybeidtvz6msntyfv5mp3tylnbd6tyy4sr5uhzkjsjdozgcjpi72ntq3u/basic-human.jpg</p>
  <div style="display:flex;gap:24px;align-items:flex-start">
    <div style="width:280px;border:2px solid #6d28d9;border-radius:12px;overflow:hidden;background:#1a1030">
      <div style="height:280px;position:relative;background:#1a1030">
        <img id="art" src="https://gateway.pinata.cloud/ipfs/bafybeidtvz6msntyfv5mp3tylnbd6tyy4sr5uhzkjsjdozgcjpi72ntq3u/basic-human.jpg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;display:block" />
      </div>
      <div style="padding:12px"><b>Basic Human #3</b><div style="font-size:12px;opacity:.7">Pinata primary · Fighter card mock</div></div>
    </div>
    <div id="meta" style="font-size:13px;line-height:1.5">loading…</div>
  </div>
</body></html>`);
await page.waitForFunction(() => {
  const img = document.getElementById('art');
  return img && (img.complete && img.naturalWidth > 0);
}, { timeout: 20000 }).catch(() => {});
const dims = await page.evaluate(() => {
  const img = document.getElementById('art');
  return { w: img.naturalWidth, h: img.naturalHeight, complete: img.complete };
});
console.log('pinata_img', JSON.stringify(dims));
await page.screenshot({ path: SHOT, fullPage: true });
await page.goto('https://fighter.riddlewallet.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: SHOT2, fullPage: false });
// unit-test resolve logic via evaluate of constants in bundle
const hasPinataInBundle = await page.evaluate(async () => {
  const scripts = [...document.querySelectorAll('script[src]')].map(s => s.src);
  for (const src of scripts) {
    if (!src.includes('index-')) continue;
    const t = await fetch(src).then(r => r.text());
    return t.includes('bafybeidtvz6msntyfv5mp3tylnbd6tyy4sr5uhzkjsjdozgcjpi72ntq3u') && t.includes('basic-human.jpg');
  }
  return false;
});
console.log('prod_bundle_pinata', hasPinataInBundle);
await browser.close();
