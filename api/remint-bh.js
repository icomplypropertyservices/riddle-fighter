/**
 * GET/POST /api/remint-bh — burn stuck Flags=8 BH + mint SSOT Flags=24+URI via authorized minter.
 * RF_BH_REMINT_20260922. No server-side signing. Credit OFF. No seeds.
 *
 * PREREQ: AccountSet asfAuthorizedNFTokenMinter on issuer → Gaming hot (see /api/accountset-minter).
 *
 * burnTx: NFTokenBurn Account=MP (Jack signs MP in Xaman)
 * mintTx: NFTokenMint Account=Gaming hot, Issuer=SSOT (Jack/hot signs; NOT issuer alone)
 * offerTx: NFTokenCreateOffer Sell Amount=0 Account=hot → destination (default MP) after mint id known
 * Broker may accept/transfer into MP if needed.
 * Taxon2 foreign: SKIP.
 */
const CLASSIC_DEST_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/
const NFT_ID_RE = /^[0-9A-Fa-f]{64}$/
const MP = 'rDiHMcZARsb1uakt8tYScLbZuLRihZqjMp'
const SSOT_ISSUER = 'rheJJYv5GXwFMHTqpUYCS5HsFJAYNiydG2'
const GAMING_HOT = 'rD1kRfM5yPwtjvdGLqQG86HQie5m1wmEDh'
const STUCK_BH_9001 = '000800008CF38B5978307F162F1B8D99A98816B7DA2E2FC8FAC977A40651B8F2'
const TAXON = 9001
const FLAGS = 24 /* tfTransferable(8)+tfMutable(16) */
const MARKER = 'RF_BH_REMINT_20260922'
const META_BASE = 'https://meta.riddlewallet.com/meta/riddle-basic-human'

function uriHex(plain) {
  return Buffer.from(String(plain), 'utf8').toString('hex').toUpperCase()
}

function assertMintShape(mintTx, uriPlain) {
  if (mintTx.Account !== GAMING_HOT) {
    throw new Error('assert_account: mintTx.Account must be Gaming hot rD1kRf…')
  }
  if (mintTx.Issuer !== SSOT_ISSUER) {
    throw new Error('assert_issuer: mintTx.Issuer must be SSOT rheJJYv5…')
  }
  if (mintTx.Flags !== FLAGS) {
    throw new Error('assert_flags: expected Flags===24 got ' + mintTx.Flags)
  }
  if (!mintTx.URI || typeof mintTx.URI !== 'string' || !mintTx.URI.length) {
    throw new Error('assert_uri: URI must be non-empty hex')
  }
  if (!uriPlain || !String(uriPlain).startsWith(META_BASE)) {
    throw new Error('assert_uriPlain: must be meta.riddlewallet.com BH path')
  }
  if (mintTx.NFTokenTaxon !== TAXON) {
    throw new Error('assert_taxon: expected 9001')
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
      route: '/api/remint-bh',
      method: 'POST',
      marker: MARKER,
      credit: 'OFF',
      seeds: false,
      signing: 'client_only',
      note: 'AccountSet required first — GET /api/accountset-minter (Jack signs as issuer once).',
      stuckDefault: STUCK_BH_9001,
      burnAccount: MP,
      mintAccount: GAMING_HOT,
      mintIssuer: SSOT_ISSUER,
      gamingHotWallet: GAMING_HOT,
      taxon: TAXON,
      flags: FLAGS,
      uriPattern: META_BASE + '/{n}',
      offer: 'optional NFTokenCreateOffer Sell Amount=0 Account=hot to destination (default MP)',
      taxon2Foreign: {
        nft: '00080BB812C36A8E1C6C8B3DCE5BA3902299EF5B6EB51C8FB5B6D68505BA20EC',
        issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
        action: 'SKIP — FOREIGN blocker only (Ellie ACK)',
      },
      body: {
        destination: 'r… receive offer (default MP); not mint Account',
        nft_id: 'optional stuck NFTokenID (default BH 9001 Flags=8)',
        serial: '1..10000 for meta URI',
        includeOffer: 'bool default true',
        mode: 'minter|ssot|issuer — all use Account=hot Issuer=SSOT',
      },
      message:
        'POST → burnTx (MP) + mintTx (Account=hot Issuer=SSOT Flags=24+URI) + offerTx (hot→dest Amount 0). AccountSet first. No server mint.',
    })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed', marker: MARKER })
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

  const destRaw = String(body.destination || body.buyer || body.offerDestination || '').trim()
  const destination = destRaw || MP
  if (!CLASSIC_DEST_RE.test(destination)) {
    res.status(400).json({
      ok: false,
      error: 'wallet_required',
      message: 'destination must be classic r… address',
      marker: MARKER,
    })
    return
  }
  if (/^rDEMO/i.test(destination)) {
    res.status(403).json({ ok: false, error: 'forbidden_destination', marker: MARKER })
    return
  }

  const nftId = String(body.nft_id || body.NFTokenID || body.nftId || STUCK_BH_9001)
    .trim()
    .toUpperCase()
  if (!NFT_ID_RE.test(nftId)) {
    res.status(400).json({ ok: false, error: 'nft_id_invalid', marker: MARKER })
    return
  }

  const modeRaw = String(body.mode || 'minter').trim().toLowerCase()
  // minter / ssot / issuer all use Account=hot + Issuer=SSOT (Jack decision supersedes issuer-alone mint)
  if (modeRaw !== 'minter' && modeRaw !== 'ssot' && modeRaw !== 'issuer') {
    res.status(400).json({
      ok: false,
      error: 'mode_invalid',
      message: 'mode must be minter|ssot|issuer (all → Account=hot Issuer=SSOT)',
      marker: MARKER,
    })
    return
  }

  const serialRaw = body.serial ?? body.tokenSerial ?? 1
  const serial = Math.max(1, Math.min(10000, parseInt(String(serialRaw), 10) || 1))
  const uriPlain = `${META_BASE}/${serial}`
  const uri = uriHex(uriPlain)

  const burnTx = {
    TransactionType: 'NFTokenBurn',
    Account: MP,
    NFTokenID: nftId,
  }

  const mintTx = {
    TransactionType: 'NFTokenMint',
    Account: GAMING_HOT,
    Issuer: SSOT_ISSUER,
    NFTokenTaxon: TAXON,
    Flags: FLAGS,
    URI: uri,
  }

  try {
    assertMintShape(mintTx, uriPlain)
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: 'mint_assert_failed',
      message: e instanceof Error ? e.message : String(e),
      marker: MARKER,
    })
    return
  }

  const includeOffer = body.includeOffer !== false && body.offer !== false
  let offerTx = null
  if (includeOffer) {
    offerTx = {
      TransactionType: 'NFTokenCreateOffer',
      Account: GAMING_HOT,
      NFTokenID: '<NEW_NFT_ID_AFTER_MINT>',
      Amount: '0',
      Destination: destination,
      Flags: 1, // tfSellNFToken
    }
  }

  res.status(200).json({
    ok: true,
    live: true,
    mode: modeRaw,
    marker: MARKER,
    credit: 'OFF',
    seeds: false,
    signing: 'client_only',
    note: 'AccountSet required first — /api/accountset-minter (Jack signs as issuer once).',
    before: {
      nftId: STUCK_BH_9001,
      flags: 8,
      uri: '',
      issuer: MP,
      note: 'self-issuer Flags=8 blank URI on MP bag',
    },
    burnAccount: MP,
    mintAccount: GAMING_HOT,
    mintIssuer: SSOT_ISSUER,
    gamingHotWallet: GAMING_HOT,
    destination,
    serial,
    uriPlain,
    burnTx,
    mintTx,
    offerTx,
    offerNote:
      'After mint settles, replace offerTx.NFTokenID with new token id then sign Sell offer (Amount 0) as hot → destination. Broker may accept into MP if needed.',
    jackSignSequence: [
      '1 AccountSet as issuer (once) — /api/accountset-minter',
      '2 burnTx as MP',
      '3 mintTx as Gaming hot (Account=hot Issuer=SSOT)',
      '4 broker offer/accept (offerTx Sell Amount=0)',
    ],
    taxon2ForeignSkipped: {
      nft: '00080BB812C36A8E1C6C8B3DCE5BA3902299EF5B6EB51C8FB5B6D68505BA20EC',
      issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
      reason: 'FOREIGN — document blocker only (Ellie ACK)',
    },
    cafeSsotGap: '0× taxon 9001 on rheJJYv5… until this remint mintTx is signed',
    message:
      'Sign burnTx as MP, then mintTx as Gaming hot (Account=hot Issuer=SSOT Flags=24+URI), then optional offerTx. AccountSet first. No server signing.',
  })
}
