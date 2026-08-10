/**
 * Full fighter selection — NFT art, Power Level breakdown, trait-driven stats.
 */
import { useMemo, useState } from 'react'
import type { Fighter } from '../lib/fighters'
import { fighterMoves } from '../lib/fighters'
import { fighterTraitChips } from '../lib/nftCharacter'
import { cafeBuyNftUrl, xrpCafeFightersUrl } from '../lib/suite'
import {
  PICKER_TABS,
  type NftCategory,
  CATEGORY_LABEL,
} from '../lib/nftCatalog'
import { filterByCategory } from '../lib/nfts'
import { sfx } from '../lib/audio'
import { BASIC_HUMAN_PINATA_IMAGE, resolveFighterArt } from '../lib/nftArt'
import { basicHumanSvgDataUri } from '../lib/starterHuman'
import {
  computePowerLevel,
  powerLevelOf,
  withCombatPowers,
  type PowerLevelBreakdown,
} from '../lib/traitPowers'
import { resolveCollectionWiring } from '../lib/collectionWiring'

type Props = {
  title: string
  fighters: Fighter[]
  selectedId?: string
  onSelect: (f: Fighter) => void
  onView?: (f: Fighter) => void
  emptyHint?: string
  loading?: boolean
  showCafeCta?: boolean
  defaultTab?: NftCategory | 'all' | 'fightable'
  fightSelectOnly?: boolean
  /** Suite credit balance shown in picker header. */
  creditBalance?: number
}

type SortKey = 'power' | 'name' | 'hp' | 'level' | 'record'

export function FighterPicker({
  title,
  fighters,
  selectedId,
  onSelect,
  onView,
  emptyHint,
  loading,
  showCafeCta,
  defaultTab = 'fightable',
  fightSelectOnly = true,
  creditBalance,
}: Props) {
  const [tab, setTab] = useState<NftCategory | 'all' | 'fightable'>(defaultTab)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('power')

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: fighters.length, fightable: 0 }
    for (const f of fighters) {
      const cat = f.category || 'other'
      c[cat] = (c[cat] || 0) + 1
      if (f.fightable || cat === 'human' || cat === 'god') c.fightable = (c.fightable || 0) + 1
    }
    return c
  }, [fighters])

  const visible = useMemo(() => {
    let list = filterByCategory(fighters, tab)
    const qq = q.trim().toLowerCase()
    if (qq) {
      list = list.filter((f) => {
        const blob = [
          f.name,
          f.collection,
          f.categoryLabel,
          f.identity?.element,
          f.identity?.weapon,
          f.identity?.gameClass,
          f.identity?.army,
          f.specialName,
          f.secretName,
          ...(f.traits || []).map((t) => `${t.trait_type} ${t.value}`),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return blob.includes(qq)
      })
    }
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'hp') return b.stats.hp - a.stats.hp
      if (sort === 'level') return (b.identity?.level || 0) - (a.identity?.level || 0)
      if (sort === 'record') return b.wins - b.losses - (a.wins - a.losses)
      return powerLevelOf(b) - powerLevelOf(a)
    })
    return list
  }, [fighters, tab, q, sort])

  const selected = useMemo(() => {
    const raw = fighters.find((f) => f.id === selectedId) || null
    if (!raw) return null
    return raw.powers && raw.powerBreakdown ? raw : withCombatPowers(raw)
  }, [fighters, selectedId])

  const selectedPl: PowerLevelBreakdown | null = useMemo(() => {
    if (!selected) return null
    return selected.powerBreakdown || computePowerLevel(selected)
  }, [selected])

  const selectedWiring = useMemo(() => {
    if (!selected) return null
    return resolveCollectionWiring({
      taxon: selected.taxon,
      collection: selected.collection,
      category: selected.category,
      issuer: selected.issuer,
    })
  }, [selected])

  return (
    <section className="panel g-pick" data-nft-catalog="1">
      <div className="g-pick-head">
        <div className="g-pick-head-row">
          <h2 className="g-panel-title">{title}</h2>
          {typeof creditBalance === 'number' ? (
            <span className="g-pick-balance" title="Suite credit balance">
              {Math.max(0, Math.floor(creditBalance))} cr
            </span>
          ) : null}
        </div>
        <p className="hint" style={{ margin: 0 }}>
          Stats & secrets come from <b>this NFT&apos;s traits</b> — pick who fights
        </p>
      </div>

      <div className="g-pick-tools">
        <input
          className="g-pick-search"
          type="search"
          placeholder="Search name, element, weapon, army…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search fighters"
        />
        <select
          className="g-pick-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort fighters"
        >
          <option value="power">Sort · Power</option>
          <option value="hp">Sort · HP</option>
          <option value="level">Sort · Level</option>
          <option value="name">Sort · Name</option>
          <option value="record">Sort · Record</option>
        </select>
      </div>

      <div className="g-pick-tabs" role="tablist" aria-label="NFT categories">
        {PICKER_TABS.map((t) => {
          const n = counts[t.id] ?? 0
          if (t.id !== 'all' && t.id !== 'fightable' && n === 0) return null
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`g-pick-tab${tab === t.id ? ' is-on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <em>{t.id === 'all' ? counts.all || 0 : n}</em>
            </button>
          )
        })}
      </div>

      {loading ? <p className="hint">Loading NFTs you own…</p> : null}
      {!loading && visible.length === 0 ? (
        <div className="empty-owned">
          <p className="hint">{emptyHint || 'No NFTs in this category'}</p>
          {showCafeCta ? (
            <div className="row" style={{ marginTop: 10 }}>
              <a className="btn btn-ok" href={cafeBuyNftUrl()}>
                Get NFTs on Cafe
              </a>
              <a
                className="btn btn-ghost"
                href={xrpCafeFightersUrl()}
                target="_blank"
                rel="noreferrer"
              >
                xrp.cafe Inquisition
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="g-pick-grid">
        {visible.map((f) => {
          const fightable =
            f.source !== 'demo' &&
            !String(f.id || '').startsWith('cpu-') &&
            f.fightable !== false &&
            (f.category === 'human' || f.category === 'god' || !f.category)
          const blocked = fightSelectOnly && !fightable
          // Always resolve art (CDN/SVG) — never leave blank purple frame
          const img = resolveFighterArt({
            name: f.name,
            image: f.image,
            originalImage: f.originalImage,
            newImage: f.newImage,
            taxon: f.taxon,
            collection: f.collection,
            traits: f.traits,
            uri: (f as { uri?: string }).uri,
          })
          const on = selectedId === f.id
          const chips = fighterTraitChips(f)
          const pl = powerLevelOf(f)
          const wiring = resolveCollectionWiring({
            taxon: f.taxon,
            collection: f.collection,
            category: f.category,
            issuer: f.issuer,
          })
          return (
            <button
              key={f.id}
              type="button"
              className={`g-pick-card${on ? ' is-on' : ''}${blocked ? ' is-dim' : ''}`}
              disabled={blocked}
              title={
                blocked
                  ? `${f.categoryLabel || f.category} — catalog only`
                  : `${f.name} · PL ${pl} · HP ${f.stats.hp} ATK ${f.stats.atk}`
              }
              onClick={() => {
                if (blocked) return
                sfx.select()
                onSelect(f.powers ? f : withCombatPowers(f))
              }}
            >
              <div
                className="g-pick-art"
                data-has-art={img ? '1' : '0'}
                style={{
                  // NEVER use `background` shorthand — it wipes backgroundImage
                  backgroundColor: '#12121c',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <span className="g-pick-pl" title={`Power Level ${pl}`}>
                  PL {pl}
                </span>
                {/* Always paint something visible — SVG data URI or URL */}
                <img
                  src={
                    img ||
                    resolveFighterArt({
                      name: f.name || 'Human',
                      taxon: f.taxon ?? 9001,
                      collection: f.collection || 'Riddle Basic Human',
                      traits: f.traits,
                    })
                  }
                  alt={f.name || 'Fighter'}
                  loading="eager"
                  decoding="async"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center top',
                    zIndex: 1,
                    display: 'block',
                    backgroundColor: '#1a1030',
                  }}
                  onError={(e) => {
                    const el = e.currentTarget
                    const serial = Number(
                      f.traits?.find((t) => /serial/i.test(String(t.trait_type)))
                        ?.value ||
                        String(f.name || '').match(/#\s*0*(\d+)/)?.[1] ||
                        1,
                    )
                    const step = String(el.dataset.step || '')
                    // Cascade: Pinata product plate → offline SVG — never blank
                    if (step === '' && !String(el.src || '').includes('pinata.cloud')) {
                      el.dataset.step = 'pinata'
                      el.src = BASIC_HUMAN_PINATA_IMAGE
                      return
                    }
                    if (step === '' || step === 'pinata') {
                      el.dataset.step = 'svg'
                      el.src = basicHumanSvgDataUri({
                        serial,
                        label: `Human #${serial}`,
                      })
                    }
                  }}
                />
                {on ? <span className="g-pick-sel" style={{ zIndex: 2 }}>SELECTED</span> : null}
                {f.category === 'god' ? (
                  <span className="g-pick-god" style={{ zIndex: 2 }}>
                    GOD
                  </span>
                ) : null}
              </div>
              <div className="g-pick-body">
                <b className="g-pick-name">{f.name}</b>
                <div className="g-pick-stats">
                  <span className="g-pick-pl-inline">PL {pl}</span>
                  <span>HP {f.stats.hp}</span>
                  <span>ATK {f.stats.atk}</span>
                  <span>DEF {f.stats.def}</span>
                  <span>SPD {f.stats.speed}</span>
                  <span>SP {f.stats.special}</span>
                </div>
                <div className="g-pick-chips">
                  {wiring.archetype ? (
                    <span className="g-pick-chip g-pick-chip-arch">{wiring.archetype}</span>
                  ) : null}
                  {chips.slice(0, 4).map((c) => (
                    <span key={c} className="g-pick-chip">
                      {c}
                    </span>
                  ))}
                </div>
                <small className="g-pick-moves">
                  SP {fighterMoves(f).special.name}
                  {f.secretName ? ` · ✦ ${f.secretName}` : ''}
                </small>
                <small className="g-pick-rec">
                  {f.wins}-{f.losses}
                  {f.collection ? ` · ${f.collection}` : ''}
                </small>
              </div>
              {onView ? (
                <span
                  className="g-pick-view"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    onView(f)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()
                      onView(f)
                    }
                  }}
                >
                  Detail
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {selected &&
      (selected.fightable !== false ||
        selected.category === 'human' ||
        selected.category === 'god') ? (
        <div className="g-pick-detail">
          <div
            className="g-pick-detail-art"
            style={
              (() => {
                const art = resolveFighterArt({
                  name: selected.name,
                  image: selected.image,
                  originalImage: selected.originalImage,
                  newImage: selected.newImage,
                  taxon: selected.taxon,
                  collection: selected.collection,
                  traits: selected.traits,
                })
                return art
                  ? {
                      backgroundColor: '#12121c',
                      backgroundImage: `url(${art})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center top',
                    }
                  : { backgroundColor: selected.color || '#1a1a28' }
              })()
            }
          />
          <div className="g-pick-detail-copy">
            <h3>
              {selected.name}{' '}
              <span className="g-pick-pl-badge">PL {selectedPl?.total ?? powerLevelOf(selected)}</span>
            </h3>
            <p className="hint" style={{ margin: '4px 0 8px' }}>
              {CATEGORY_LABEL[selected.category || 'other']}
              {selectedWiring ? ` · ${selectedWiring.archetype}` : ''}
              {selected.identity?.element ? ` · ${selected.identity.element}` : ''}
              {selected.identity?.weapon ? ` · ${selected.identity.weapon}` : ''}
              {selected.identity?.gameClass ? ` · ${selected.identity.gameClass}` : ''}
              {selected.identity?.army ? ` · Army ${selected.identity.army}` : ''}
              {selected.identity?.level != null ? ` · Lv ${selected.identity.level}` : ''}
            </p>
            <div className="g-pick-stats g-pick-stats-lg">
              <span className="g-pick-pl-inline">PL {selectedPl?.total ?? powerLevelOf(selected)}</span>
              <span>HP {selected.stats.hp}</span>
              <span>ATK {selected.stats.atk}</span>
              <span>DEF {selected.stats.def}</span>
              <span>SPD {selected.stats.speed}</span>
              <span>SP {selected.stats.special}</span>
            </div>
            {selectedPl ? (
              <div className="g-pick-pl-break" data-testid="power-level-breakdown">
                <div className="g-pick-pl-break-head">
                  Power Level {selectedPl.total}
                  {selectedPl.scanned
                    ? ` · scanned ${selectedPl.scanned.powerLevel}`
                    : ` · base ${selectedPl.base} + traits`}
                  {selectedPl.scanned && selectedPl.localTotal != null
                    ? ` · local est. ${selectedPl.localTotal}`
                    : ''}
                </div>
                {selectedPl.scanned ? (
                  <p
                    className="g-pick-scanned-badge"
                    data-testid="scanned-score-badge"
                    title={selectedPl.scanned.sourceLabel}
                  >
                    Scanned score · {selectedPl.scanned.sourceLabel}
                    {selectedPl.scanned.comboKey ? ` · ${selectedPl.scanned.comboKey}` : ''}
                  </p>
                ) : null}
                <ul className="g-pick-pl-lines">
                  {selectedPl.lines.map((line, i) => (
                    <li
                      key={`${line.source}-${line.label}-${i}`}
                      className={line.source === 'scanned' ? 'g-pick-pl-line--scanned' : undefined}
                    >
                      <span className="g-pick-pl-label">{line.label}</span>
                      <span className="g-pick-pl-pts">
                        {line.source === 'scanned' ? '' : line.contribution >= 0 ? '+' : ''}
                        {line.contribution}
                      </span>
                      <span className="g-pick-pl-desc">{line.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <ul className="g-pick-kit">
              <li>Punch / Kick · base</li>
              <li>Special · {selected.specialName}</li>
              <li>✦ Secret · {selected.secretName || fighterMoves(selected).secret.name}</li>
              <li>★ Super · {selected.superName || fighterMoves(selected).super.name}</li>
            </ul>
            {selectedWiring ? (
              <p className="hint" style={{ margin: '6px 0' }}>
                {selectedWiring.name}: {selectedWiring.combatStyle}
              </p>
            ) : null}
            {selected.traits && selected.traits.length > 0 ? (
              <div className="g-pick-traits">
                {selected.traits.slice(0, 12).map((t, i) => (
                  <span key={`${t.trait_type}-${i}`} className="g-pick-chip">
                    {t.trait_type}: {String(t.value)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
