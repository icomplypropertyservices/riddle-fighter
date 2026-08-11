/**
 * GET /api/health — fighter product health (Xaman + Neon store readiness).
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Riddle-Product', 'riddle-fighter')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ ok: false, error: 'GET only' })
    return
  }

  const xamanReady = Boolean(
    String(process.env.XUMM_API_KEY || process.env.XAMAN_API_KEY || '').trim() &&
      String(process.env.XUMM_API_SECRET || process.env.XAMAN_API_SECRET || '').trim(),
  )

  const dbUrl = (
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ''
  ).trim()
  const store = dbUrl ? 'neon' : 'memory'
  const neonReady = Boolean(dbUrl)

  res.status(200).json({
    ok: true,
    brand: 'Riddle Fighter',
    app: 'fighter',
    service: 'riddle-fighter',
    store,
    neonReady,
    ...(neonReady
      ? {}
      : {
          warning:
            'DATABASE_URL unset — match progress/wager log is instance-local memory. Set Neon DATABASE_URL on Vercel Production for durable multi-instance settle.',
        }),
    xamanReady,
    xaman: xamanReady
      ? { signIn: true, path: '/api/xaman/payload' }
      : { signIn: false, reason: 'XUMM_API_KEY / XUMM_API_SECRET missing on fighter project' },
    suiteConnect: {
      app: 'fighter',
      return: 'https://fighter.riddlewallet.com',
      wallet: 'https://wallet.riddlewallet.com?app=fighter&action=connect&source=suite',
    },
  })
}
