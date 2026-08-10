/**
 * GET /api/health — fighter product health (includes Xaman readiness).
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

  res.status(200).json({
    ok: true,
    brand: 'Riddle Fighter',
    app: 'fighter',
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
