/**
 * GET/POST /api/mint — Basic Human mint tx builder (no server-side NFTokenMint).
 * RF_BH_MINT_URI_20260922: URI must be meta.riddlewallet.com (not fighter host / empty).
 * Flags 24 = tfTransferable(8)+tfMutable(16) so future evolve via NFTokenModify works.
 *
 * mode minter|ssot|issuer → Account=Gaming hot + Issuer=SSOT (Jack decision; AccountSet first).
 * Default self_mint Account=dest (no Issuer field).
 * Credit OFF. No seeds. No server signing.
 */
const CLASSIC_DEST_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/
const TREASURY = 'rDiHMcZARsb1uakt8tYScLbZuLRihZqjMp'
const SSOT_ISSUER = 'rheJJYv5GXwFMHTqpUYCS5HsFJAYNiydG2' /* Cafe+Gaming SSOT */
const GAMING_HOT = 'rD1kRfM5yPwtjvdGLqQG86HQie5m1wmEDh'
const META_URI = 'https://meta.riddlewallet.com/meta/riddle-basic-human/1'
const META_BASE = 'https://meta.riddlewallet.com/meta/riddle-basic-human'
const FLAGS = 24 /*RF_MINT_FLAGS_24*/
const MARKER = 'RF_BH_MINT_URI_20260922'

function assertMintShape(mintTx, uriPlain, ssotMode) {
  if (mintTx.Flags !== FLAGS) {
    throw new Error('assert_flags: expected Flags===24 got ' + mintTx.Flags)
  }
  if (!mintTx.URI || typeof mintTx.URI !== 'string' || !mintTx.URI.length) {
    throw new Error('assert_uri: URI must be non-empty hex')
  }
  if (!uriPlain || !String(uriPlain).startsWith(META_BASE)) {
    throw new Error('assert_uriPlain: must be meta.riddlewallet.com BH path')
  }
  if (ssotMode) {
    if (mintTx.Account !== GAMING_HOT) {
      throw new Error('assert_account: mintTx.Account must be Gaming hot rD1kRf…')
    }
    if (mintTx.Issuer !== SSOT_ISSUER) {
      throw new Error('assert_issuer: mintTx.Issuer must be SSOT rheJJYv5…')
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Riddle-Marker', MARKER)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.status(200).json({
      ok: true,
      app: 'fighter',
      route: '/api/mint',
      mint: false,
      method: 'POST',
      marker: MARKER,
      metaUri: META_URI,
      flags: FLAGS,
      modes: ['self_mint', 'minter', 'ssot', 'issuer'],
      ssotIssuer: SSOT_ISSUER,
      gamingHotWallet: GAMING_HOT,
      note: 'AccountSet required first for minter|ssot|issuer — /api/accountset-minter',
      message:
        'POST { destination, mode? }. mode=minter|ssot|issuer → Account=hot Issuer=SSOT. Flags=24+URI. No server mint.',
    })
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }
  body = body && typeof body === 'object' ? body : {}
  const dest = String(body.destination || body.buyer || '').trim()
  if (!CLASSIC_DEST_RE.test(dest)) {
    res.status(400).json({ ok: false, error: 'wallet_required', message: 'Connect an XRPL r… wallet first' })
    return
  }
  if (dest.toLowerCase() === TREASURY.toLowerCase() || /^rDEMO/i.test(dest)) {
    res.status(403).json({ ok: false, error: 'forbidden_destination' })
    return
  }
  const modeRaw = String(body.mode || 'self_mint').trim().toLowerCase()
  const ssotMode = modeRaw === 'ssot' || modeRaw === 'issuer' || modeRaw === 'minter'
  const mode = ssotMode ? (modeRaw === 'minter' ? 'minter' : 'ssot') : 'self_mint'

  const serialRaw = body.serial ?? body.tokenSerial ?? 1
  const serial = Math.max(1, Math.min(10000, parseInt(String(serialRaw), 10) || 1))
  const uriPlain = `${META_BASE}/${serial}`
  const uriHex = Buffer.from(uriPlain, 'utf8').toString('hex').toUpperCase()

  const mintTx = ssotMode
    ? {
        TransactionType: 'NFTokenMint',
        Account: GAMING_HOT,
        Issuer: SSOT_ISSUER,
        NFTokenTaxon: 9001,
        Flags: FLAGS,
        URI: uriHex,
      }
    : {
        TransactionType: 'NFTokenMint',
        Account: dest,
        NFTokenTaxon: 9001,
        Flags: FLAGS,
        URI: uriHex,
      }

  try {
    assertMintShape(mintTx, uriPlain, ssotMode)
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: 'mint_assert_failed',
      message: e instanceof Error ? e.message : String(e),
      marker: MARKER,
    })
    return
  }

  let offerTx = null
  if (ssotMode && body.includeOffer !== false) {
    offerTx = {
      TransactionType: 'NFTokenCreateOffer',
      Account: GAMING_HOT,
      NFTokenID: '<NEW_NFT_ID_AFTER_MINT>',
      Amount: '0',
      Destination: dest,
      Flags: 1,
    }
  }

  res.status(200).json({
    ok: true,
    live: true,
    mode,
    destination: dest,
    mintAccount: mintTx.Account,
    mintIssuer: ssotMode ? SSOT_ISSUER : null,
    gamingHotWallet: GAMING_HOT,
    mintTx,
    offerTx,
    uriPlain,
    serial,
    mintHash: null,
    xaman: false,
    marker: MARKER,
    note: ssotMode
      ? 'AccountSet required first — /api/accountset-minter (Jack signs as issuer once).'
      : undefined,
    message: ssotMode
      ? 'Sign NFTokenMint as Gaming hot rD1kRf… (Issuer=rheJJYv5…). Flags=24+URI. Optional Sell offer Amount=0. No server mint.'
      : 'Sign NFTokenMint in Riddle Wallet (self-mint). URI=meta.riddlewallet.com. Flags=24 (mutable). No server mint.',
  })
}
