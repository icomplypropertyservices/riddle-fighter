const apps = [
  ['fighter', 'https://fighter.riddlewallet.com/'],
  ['cities', 'https://cities.riddlewallet.com/'],
  ['civ', 'https://civ.riddlewallet.com/'],
  ['hub', 'https://riddlewallet.com/'],
]
for (const [id, base] of apps) {
  const html = await (await fetch(base, { headers: { 'user-agent': 'Mozilla/5.0' } })).text()
  const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/)
  let has = false
  let ver = null
  let always = false
  if (m) {
    const js = await (await fetch(new URL(m[1], base).href)).text()
    has = js.includes('suite-credits-chip') || js.includes('rw-suite-header__credits')
    always = js.includes('Always-visible') || js.includes('… cr')
    ver = js.includes('2.1.5') ? '2.1.5' : null
  }
  const hubChip = html.includes('hub-credits-chip') || html.includes('nav-credits')
  console.log(id, { hasCreditsChip: has || hubChip, always, ver, hubChip })
}
