/**
 * Per-NFT public detail — OLD | NEW art, stats, fight history, share link.
 */
import { useMemo } from 'react'
import type { Fighter } from '../lib/fighters'
import { CATEGORY_LABEL } from '../lib/nftCatalog'
import {
  loadNftFightHistory,
  publicNftViewUrl,
  type NftFightEvent,
  type NftPublicCard,
} from '../lib/nftFightHistory'

type Props = {
  fighter?: Fighter | null
  /** When opened from ?view= without full fighter (public card only). */
  publicCard?: NftPublicCard | null
  history?: NftFightEvent[]
  onClose: () => void
  onSelectFight?: () => void
  onShare?: (url: string) => void
}

function ArtSlot({
  url,
  label,
  pending,
}: {
  url?: string
  label: 'OLD' | 'NEW'
  pending?: boolean
}) {
  return (
    <div className={`nft-art-slot${label === 'NEW' ? ' new' : ''}`}>
      <span className="nft-art-tag">{label}</span>
      <div className="nft-art-pending" aria-hidden>
        {pending || !url ? 'soon' : '—'}
      </div>
      {url && !pending ? (
        <img
          src={url}
          alt={label}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          style={{ maxWidth: '100%' }}
          onError={(e) => {
            const el = e.currentTarget
            el.style.display = 'none'
            el.removeAttribute('src')
          }}
        />
      ) : null}
    </div>
  )
}

export function NftDetail({
  fighter,
  publicCard,
  history: historyProp,
  onClose,
  onSelectFight,
  onShare,
}: Props) {
  const name = fighter?.name || publicCard?.name || 'NFT'
  const nftId = fighter?.nftId || fighter?.id?.replace(/^nft-/, '') || publicCard?.nftId || ''
  const oldUrl =
    fighter?.originalImage ||
    publicCard?.originalImage ||
    (fighter?.newImage ? undefined : fighter?.image) ||
    publicCard?.image
  const newUrl =
    fighter?.newImage ||
    publicCard?.newImage ||
    (fighter?.originalImage && fighter?.image && fighter.image !== fighter.originalImage
      ? fighter.image
      : undefined)
  const hasNew = Boolean(newUrl && newUrl !== oldUrl)
  const displayOld = oldUrl || fighter?.image || publicCard?.image
  const wins = fighter?.wins ?? publicCard?.wins ?? 0
  const losses = fighter?.losses ?? publicCard?.losses ?? 0
  const collection = fighter?.collection || publicCard?.collection
  const category =
    fighter?.categoryLabel ||
    publicCard?.categoryLabel ||
    (fighter?.category ? CATEGORY_LABEL[fighter.category] : '')
  const taxon = fighter?.taxon ?? publicCard?.taxon
  const special = fighter?.specialName || publicCard?.specialName
  const stats = fighter?.stats
  const traits = fighter?.traits || []
  const fightable = fighter?.fightable !== false &&
    (fighter?.category === 'human' || fighter?.category === 'god' || !fighter?.category)

  const history = useMemo(() => {
    if (historyProp) return historyProp
    return loadNftFightHistory(nftId || fighter?.id || '')
  }, [historyProp, nftId, fighter?.id])

  const shareUrl = useMemo(() => {
    if (!nftId) return ''
    return publicNftViewUrl(nftId)
  }, [nftId])

  return (
    <div
      className="nft-detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nft-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="nft-detail-sheet panel" data-nft-detail="1">
        <div className="nft-detail-head">
          <div>
            <p className="hint" style={{ margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Public NFT · OLD + NEW
            </p>
            <h2 id="nft-detail-title" style={{ margin: '4px 0 0' }}>
              {name}
            </h2>
            {nftId ? (
              <p className="quote" style={{ wordBreak: 'break-all', fontSize: 11 }}>
                {nftId}
              </p>
            ) : null}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        <div className="nft-dual-row" data-dual="1">
          <ArtSlot url={displayOld} label="OLD" />
          <ArtSlot url={hasNew ? newUrl : undefined} label="NEW" pending={!hasNew} />
        </div>
        <p className="hint" style={{ marginTop: 6 }}>
          {hasNew
            ? 'OLD = ledger genesis · NEW = evolved / mutable art'
            : 'OLD = current ledger art · NEW appears after evolve / remint'}
        </p>

        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {category ? <span className="chip">{category}</span> : null}
          {collection ? <span className="chip solid">{collection}</span> : null}
          {taxon != null && Number.isFinite(Number(taxon)) ? (
            <span className="chip">Taxon {taxon}</span>
          ) : null}
          <span className="chip win">
            W <strong>{wins}</strong>
          </span>
          <span className="chip lose">
            L <strong>{losses}</strong>
          </span>
          {special ? <span className="chip">{special}</span> : null}
        </div>

        {stats ? (
          <div className="nft-stats-grid">
            <div>
              HP <b>{stats.hp}</b>
            </div>
            <div>
              ATK <b>{stats.atk}</b>
            </div>
            <div>
              DEF <b>{stats.def}</b>
            </div>
            <div>
              SPD <b>{stats.speed}</b>
            </div>
            <div>
              SPC <b>{stats.special}</b>
            </div>
          </div>
        ) : null}

        {traits.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>Traits</h3>
            <ul className="nft-trait-list">
              {traits.slice(0, 16).map((t, i) => (
                <li key={`${t.trait_type}-${i}`}>
                  <span>{String(t.trait_type || 'Trait')}</span>
                  <b>{String(t.value ?? '—')}</b>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>Fight history</h3>
          <ul className="history nft-fight-history">
            {history.length === 0 ? (
              <li style={{ justifyContent: 'center', opacity: 0.65 }}>No fights yet — hit the arena</li>
            ) : (
              history.slice(0, 20).map((h) => (
                <li key={h.id}>
                  <span>
                    <span className={h.won ? 'won' : 'lost'}>{h.won ? 'WIN' : 'LOSS'}</span>{' '}
                    vs {h.opponent}
                    {h.combo && h.combo >= 3 ? ` · combo ${h.combo}` : ''}
                    {h.note ? ` · ${h.note}` : ''}
                  </span>
                  <span style={{ color: 'var(--riddle-muted)', fontSize: 11 }}>
                    {h.at ? new Date(h.at).toLocaleDateString() : h.mode}
                    {h.wagerCredits ? ` · ${h.wagerCredits} cr` : ''}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="row" style={{ marginTop: 14, flexWrap: 'wrap', gap: 8 }}>
          {fightable && onSelectFight ? (
            <button type="button" className="btn btn-ok" onClick={onSelectFight}>
              Fight with this NFT
            </button>
          ) : null}
          {shareUrl ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                void navigator.clipboard?.writeText(shareUrl)
                onShare?.(shareUrl)
              }}
            >
              Copy public link
            </button>
          ) : null}
          <a
            className="btn btn-sm"
            href={`https://city.riddlewallet.com/?from=fighter&nft=${encodeURIComponent(nftId)}&mode=civ`}
            target="_blank"
            rel="noreferrer"
          >
            Cities · land &amp; civ
          </a>
          <a
            className="btn btn-sm"
            href={`https://reborn.riddlewallet.com/?from=fighter&nft=${encodeURIComponent(nftId)}`}
            target="_blank"
            rel="noreferrer"
          >
            Reborn dash
          </a>
          <a
            className="btn btn-ghost btn-sm"
            href="https://wallet.riddlewallet.com/"
            target="_blank"
            rel="noreferrer"
          >
            Wallet
          </a>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
