/**
 * Per-NFT champion sheet — portrait, all traits, W/L · XP · upgrade JSON.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Fighter } from '../lib/fighters'
import { CATEGORY_LABEL } from '../lib/nftCatalog'
import { artUrlsEqual, splitArtSlots } from '../lib/nftArt'
import {
  loadNftFightHistory,
  publicNftViewUrl,
  type NftFightEvent,
  type NftPublicCard,
} from '../lib/nftFightHistory'
import {
  downloadUpgradeJson,
  fetchProgress,
  loadLocalProgress,
  upgradeFighterWithXp,
  type FighterProgress,
} from '../lib/fighterProgress'
import { ChampionFrame } from '../ui/ChampionFrame'

type Props = {
  fighter?: Fighter | null
  publicCard?: NftPublicCard | null
  history?: NftFightEvent[]
  ownerAddress?: string | null
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
    <div className={`nd-art-slot${label === 'NEW' ? ' is-new' : ''}`}>
      <span className="nd-art-tag">{label}</span>
      {url && !pending ? (
        <img
          src={url}
          alt={label}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="nd-art-img"
          onError={(e) => {
            const el = e.currentTarget
            el.style.display = 'none'
            el.removeAttribute('src')
          }}
        />
      ) : (
        <div className="nd-art-ph">{pending || !url ? 'Soon' : '—'}</div>
      )}
    </div>
  )
}

export function NftDetail({
  fighter,
  publicCard,
  history: historyProp,
  ownerAddress,
  onClose,
  onSelectFight,
  onShare,
}: Props) {
  const name = fighter?.name || publicCard?.name || 'NFT'
  const nftId =
    fighter?.nftId || fighter?.id?.replace(/^nft-/, '') || publicCard?.nftId || ''
  const artSlots = splitArtSlots({
    name,
    image: fighter?.image || publicCard?.image,
    originalImage: fighter?.originalImage || publicCard?.originalImage,
    newImage: fighter?.newImage || publicCard?.newImage,
    taxon: fighter?.taxon ?? publicCard?.taxon,
    collection: fighter?.collection || publicCard?.collection,
    traits: fighter?.traits,
  })
  const displayOld = artSlots.originalImage || fighter?.image || publicCard?.image
  const newUrl =
    artSlots.newImage && !artUrlsEqual(artSlots.newImage, displayOld)
      ? artSlots.newImage
      : undefined
  const hasNew = Boolean(newUrl)
  const collection = fighter?.collection || publicCard?.collection
  const category =
    fighter?.categoryLabel ||
    publicCard?.categoryLabel ||
    (fighter?.category ? CATEGORY_LABEL[fighter.category] : '')
  const taxon = fighter?.taxon ?? publicCard?.taxon
  const special = fighter?.specialName || publicCard?.specialName
  const stats = fighter?.stats
  const baseTraits = fighter?.traits || []
  const fightable =
    fighter?.fightable !== false &&
    (fighter?.category === 'human' || fighter?.category === 'god' || !fighter?.category)

  const [progress, setProgress] = useState<FighterProgress>(() =>
    loadLocalProgress(nftId),
  )
  const [upgradeBusy, setUpgradeBusy] = useState(false)
  const [upgradeMsg, setUpgradeMsg] = useState('')

  useEffect(() => {
    if (!nftId) return
    let cancelled = false
    void fetchProgress(nftId).then((r) => {
      if (!cancelled && r?.progress) setProgress(r.progress)
    })
    return () => {
      cancelled = true
    }
  }, [nftId])

  const wins = progress.wins || fighter?.wins || publicCard?.wins || 0
  const losses = progress.losses || fighter?.losses || publicCard?.losses || 0
  const traits = useMemo(() => {
    const map = new Map<string, { trait_type?: string; value?: unknown }>()
    for (const t of baseTraits) {
      const k = String(t.trait_type || '').toLowerCase()
      if (k) map.set(k, t)
    }
    for (const t of progress.traits || []) {
      const k = String(t.trait_type || t.trait || '').toLowerCase()
      if (k) map.set(k, t)
    }
    // Always surface progress traits
    map.set('wins', { trait_type: 'Wins', value: wins })
    map.set('losses', { trait_type: 'Losses', value: losses })
    map.set('xp', { trait_type: 'XP', value: progress.xp })
    map.set('level', { trait_type: 'Level', value: progress.level })
    return [...map.values()]
  }, [baseTraits, progress, wins, losses])

  const history = useMemo(() => {
    if (historyProp) return historyProp
    return loadNftFightHistory(nftId || fighter?.id || '')
  }, [historyProp, nftId, fighter?.id])

  const shareUrl = useMemo(() => {
    if (!nftId) return ''
    return publicNftViewUrl(nftId)
  }, [nftId])

  const heroImg = newUrl || displayOld
  const xpCost = 100
  const canUpgrade = progress.xp >= xpCost

  return (
    <div
      className="nd-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nft-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="nd-sheet panel med-champion-sheet" data-nft-detail="1">
        <header className="nd-head">
          <div className="nd-head-text">
            <p className="nd-kicker">Champion sheet</p>
            <h2 id="nft-detail-title">{name}</h2>
            {nftId ? <p className="nd-id">{nftId}</p> : null}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        {heroImg || stats ? (
          <ChampionFrame
            name={name}
            image={heroImg}
            sub={[category, collection].filter(Boolean).join(' · ')}
            powerLevel={
              typeof fighter?.powerLevel === 'number' ? fighter.powerLevel : undefined
            }
            badge={fightable ? 'FIGHTABLE' : 'VIEW'}
            stats={
              stats
                ? {
                    hp: stats.hp,
                    atk: stats.atk,
                    def: stats.def,
                    speed: stats.speed,
                  }
                : undefined
            }
          />
        ) : null}

        <div className="nd-dual" data-dual="1">
          <ArtSlot url={displayOld} label="OLD" />
          <ArtSlot url={hasNew ? newUrl : undefined} label="NEW" pending={!hasNew} />
        </div>
        <p className="nd-cap">
          {hasNew
            ? 'OLD = genesis · NEW = evolved art'
            : 'OLD = current art · NEW after evolve'}
        </p>

        <div className="nd-chips">
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
          <span className="chip" data-testid="nft-xp">
            XP <strong>{progress.xp}</strong>
          </span>
          <span className="chip" data-testid="nft-level">
            LVL <strong>{progress.level}</strong>
          </span>
          {special ? <span className="chip">{special}</span> : null}
        </div>

        {stats ? (
          <div className="nd-stats">
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

        <div className="nd-xp-panel" data-testid="nft-xp-panel">
          <h3>XP · upgrades · on-chain JSON</h3>
          <p className="hint" style={{ marginTop: 0 }}>
            Fight to earn XP. Spend XP to upgrade traits, then download JSON for on-chain
            metadata URI updates. All NFT traits are stored with W/L.
            {ownerAddress ? ` · owner ${ownerAddress.slice(0, 6)}…` : ''}
          </p>
          <div className="nd-xp-bar" aria-label="XP progress">
            <i
              style={{
                width: `${Math.min(100, (progress.xp % 100))}%`,
              }}
            />
          </div>
          <p className="quote">
            {progress.xp % 100}/100 to L{progress.level + 1} · upgrades {progress.upgradeLevel || 0} ·
            DB {progress.persisted || 'local'}
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ok btn-sm"
              disabled={!canUpgrade || upgradeBusy || !nftId}
              data-testid="nft-upgrade-xp"
              onClick={() => {
                if (!nftId) return
                setUpgradeBusy(true)
                setUpgradeMsg('')
                void upgradeFighterWithXp({ nftId, stat: 'Power', cost: xpCost }).then(
                  (r) => {
                    setUpgradeBusy(false)
                    setProgress(r.progress)
                    if (!r.ok) {
                      setUpgradeMsg(r.error || 'Upgrade failed')
                      return
                    }
                    setUpgradeMsg(`Upgraded · −${r.cost} XP · UL${r.progress.upgradeLevel}`)
                    if (r.upgradeJson) downloadUpgradeJson(r.upgradeJson, `fighter-${nftId.slice(0, 8)}-upgrade.json`)
                  },
                )
              }}
            >
              {upgradeBusy ? '…' : `Upgrade Power · ${xpCost} XP`}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!nftId}
              data-testid="nft-download-json"
              onClick={() => {
                void fetchProgress(nftId).then((r) => {
                  const meta =
                    r?.metadata ||
                    ({
                      name,
                      attributes: traits.map((t) => ({
                        trait_type: String(t.trait_type || 'Trait'),
                        value: t.value,
                      })),
                    } as import('../lib/fighterProgress').FighterMetadataJson)
                  if (r?.progress) setProgress(r.progress)
                  downloadUpgradeJson(meta, `fighter-${nftId.slice(0, 8)}-meta.json`)
                  setUpgradeMsg('JSON downloaded — pin URI / update on-chain meta')
                })
              }}
            >
              Download meta JSON
            </button>
          </div>
          {upgradeMsg ? <p className="quote">{upgradeMsg}</p> : null}
        </div>

        {traits.length > 0 ? (
          <div className="nd-traits-wrap">
            <h3>All traits ({traits.length})</h3>
            <ul className="nd-traits">
              {traits.map((t, i) => (
                <li key={`${t.trait_type}-${i}`}>
                  <span>{String(t.trait_type || 'Trait')}</span>
                  <b>{String(t.value ?? '—')}</b>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="nd-history-wrap">
          <h3>Fight history</h3>
          <ul className="nd-history">
            {history.length === 0 ? (
              <li className="nd-history-empty">No fights yet</li>
            ) : (
              history.slice(0, 16).map((h) => (
                <li key={h.id}>
                  <span>
                    <span className={h.won ? 'won' : 'lost'}>{h.won ? 'W' : 'L'}</span> vs{' '}
                    {h.opponent}
                  </span>
                  <span className="nd-history-meta">
                    {h.at ? new Date(h.at).toLocaleDateString() : h.mode}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="nd-actions">
          {fightable && onSelectFight ? (
            <button type="button" className="btn btn-ok" onClick={onSelectFight}>
              Fight with this champion
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
              Copy link
            </button>
          ) : null}
          <a
            className="btn btn-sm"
            href={`https://civ.riddlewallet.com/?from=fighter&nft=${encodeURIComponent(nftId)}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Civ
          </a>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
