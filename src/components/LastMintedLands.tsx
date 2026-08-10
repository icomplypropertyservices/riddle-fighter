/**
 * Last minted lands strip for Fighter — same API as World/City.
 * Images linked by plot number; Scan updates owners from ledger.
 */
import { useCallback, useEffect, useState } from 'react'

export type LastMintedLand = {
  plot: number
  pad?: string
  name: string
  owner: string
  image?: string
  imageUrl?: string
  claimedInGame?: boolean
}

const API =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_WORLD_API) ||
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE) ||
  'https://reborn.riddlewallet.com'

function pad(n: number) {
  return String(Math.max(1, Math.min(1000, n))).padStart(4, '0')
}

function imgFor(plot: number) {
  return `https://meta.riddlewallet.com/static/lands/${pad(plot)}.png`
}

export function LastMintedLands() {
  const [lands, setLands] = useState<LastMintedLand[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/lands/last-minted?limit=16`)
      if (!r.ok) return
      const j = (await r.json()) as { lands?: LastMintedLand[] }
      setLands(Array.isArray(j.lands) ? j.lands : [])
    } catch {
      /* soft */
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const scan = async () => {
    setBusy(true)
    setMsg('Scanning…')
    try {
      const r = await fetch(`${API}/api/lands/sync-issuer`, { method: 'POST' })
      const j = (await r.json()) as { ok?: boolean; linked?: number; error?: string }
      setMsg(j.ok ? `Owners updated · ${j.linked ?? 0}` : j.error || 'Scan failed')
      await refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Scan failed')
    }
    setBusy(false)
  }

  return (
    <section className="panel" data-last-minted-lands="1" data-image-by-plot="1">
      <h2>Last minted lands</h2>
      <p className="hint">
        Same catalog NFTs (issuer r3fBtgr · taxon 1010). Image = plot number. Scan refreshes
        owners for map / city / wallet.
      </p>
      <div className="row">
        <button type="button" className="btn" disabled={busy} onClick={() => void scan()}>
          {busy ? 'Scanning…' : 'Scan owners'}
        </button>
        <a className="btn btn-ghost" href="https://reborn.riddlewallet.com/#/console/map" rel="noreferrer">
          Open map
        </a>
      </div>
      {msg ? <p className="quote">{msg}</p> : null}
      <div className="lands-rail" data-lands-rail="1">
        {!lands.length ? (
          <p className="hint">No minted lands loaded — Scan after API is up.</p>
        ) : (
          lands.map((l) => {
            const p = pad(l.plot)
            const src = l.image || l.imageUrl || imgFor(l.plot)
            return (
              <div key={l.plot} className="lands-rail__card">
                <div className="lands-rail__media">
                  <img
                    src={src}
                    alt={`#${p}`}
                    width={132}
                    height={96}
                    data-suite-cover
                    className="suite-img-cover"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const el = e.currentTarget
                      if (!el.dataset.fallback) {
                        el.dataset.fallback = '1'
                        el.src = `https://meta.riddlewallet.com/static/lands/${p}.svg`
                        return
                      }
                      el.style.display = 'none'
                    }}
                  />
                </div>
                <div className="lands-rail__meta">
                  <b>
                    #{p} {(l.name || '').slice(0, 14)}
                  </b>
                  <div className="lands-rail__owner">{(l.owner || '').slice(0, 10)}…</div>
                  <div className="lands-rail__status">
                    {l.claimedInGame ? '✓ claimed in game' : 'ledger only'}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export default LastMintedLands
