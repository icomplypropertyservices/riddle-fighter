/**
 * POST/GET /api/xaman/payload — Xaman Platform proxy for Riddle Fighter.
 * Connections stay on fighter.riddlewallet.com (no cafe hop).
 * Keys: XUMM_API_KEY + XUMM_API_SECRET (server only on this project).
 * POST { txjson | options | custom_meta } → create payload
 * GET  ?uuid=… → poll status
 */

const XUMM = 'https://xumm.app/api/v1/platform'

function cors(res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
  res.setHeader('X-Riddle-Product', 'riddle-fighter')
}

function readBody(req) {
  const b = req.body
  if (b == null || b === '') return {}
  if (typeof b === 'string') {
    try {
      const parsed = JSON.parse(b)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(b)) {
    try {
      const parsed = JSON.parse(b.toString('utf8') || '{}')
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  if (typeof b === 'object' && !Array.isArray(b)) return b
  return {}
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const key = String(process.env.XUMM_API_KEY || process.env.XAMAN_API_KEY || '').trim()
  const secret = String(
    process.env.XUMM_API_SECRET || process.env.XAMAN_API_SECRET || '',
  ).trim()
  if (!key || !secret) {
    res.status(503).json({
      ok: false,
      error: 'Xaman not configured',
      message: 'Set XUMM_API_KEY and XUMM_API_SECRET on fighter.riddlewallet.com',
      app: 'fighter',
    })
    return
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-API-Key': key,
    'X-API-Secret': secret,
  }

  try {
    if (req.method === 'GET') {
      const uuid = String(req.query?.uuid || '').trim()
      if (!UUID_RE.test(uuid)) {
        res.status(400).json({ ok: false, error: 'valid uuid required', app: 'fighter' })
        return
      }
      const r = await fetch(`${XUMM}/payload/${encodeURIComponent(uuid)}`, { headers })
      const text = await r.text()
      res.status(r.status)
      res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json')
      res.send(text)
      return
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'POST or GET only', app: 'fighter' })
      return
    }

    const body = readBody(req)
    const rawTx = body.txjson || body.tx
    const txjson =
      rawTx && typeof rawTx === 'object'
        ? rawTx
        : { TransactionType: 'SignIn' }

    const payload = {
      txjson,
      options: {
        submit: body.options?.submit === true,
        expire: body.options?.expire ?? body.options?.expireMinutes ?? 10,
        ...(body.options?.return_url
          ? { return_url: body.options.return_url }
          : {}),
      },
    }
    if (body.custom_meta && typeof body.custom_meta === 'object') {
      payload.custom_meta = body.custom_meta
    } else {
      payload.custom_meta = {
        instruction: 'Riddle Fighter · Sign In',
        blob: { app: 'riddle-fighter', action: 'signin' },
      }
    }
    if (body.user_token) payload.user_token = body.user_token

    const r = await fetch(`${XUMM}/payload`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    const text = await r.text()
    res.status(r.status)
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json')
    res.send(text)
  } catch (e) {
    res.status(502).json({
      ok: false,
      error: e instanceof Error ? e.message : 'Xaman proxy failed',
      app: 'fighter',
    })
  }
}
