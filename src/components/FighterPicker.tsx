/**
 * Fighter picker — portrait character select (medieval SF frames).
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
  creditBalance?: number
}

type SortKey = 'power' | 'name' | 'hp' | 'level' | 'record'

function isFightable(f: Fighter): boolean {
  return (
    f.source !== 'demo' &&
    !String(f.id || '').startsWith('cpu-') &&
    f.fightable !== false &&
    (f.category === 'human' || f.category === 'god' || !f.category)
  )
}

function artFor(f: Fighter): string {
  return (
    resolveFighterArt({
      name: f.name,
      image: f.image,
      originalImage: f.originalImage,
      newImage: f.newImage,
      taxon: f.taxon,
      collection: f.collection,
      traits: f.traits,
      uri: (f as { uri?: string }).uri,
    }) || ''
  )
}

function ThumbImg({ f, img }: { f: Fighter; img: string }) {
  return (
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
      alt=""
      loading="lazy"
      decoding="async"
      className="fp-thumb-img"
      onError={(e) => {
        const el = e.currentTarget
        const serial = Number(
          f.traits?.find((t) => /serial/i.test(String(t.trait_type)))?.value ||
            String(f.name || '').match(/#\s*0*(\d+)/)?.[1] ||
            1,
        )
        const step = String(el.dataset.step || '')
        if (step === '' && !String(el.src || '').includes('pinata.cloud')) {
          el.dataset.step = 'pinata'
          el.src = BASIC_HUMAN_PINATA_IMAGE
          return
        }
        if (step === '' || step === 'pinata' || step === 'svg') {
          // Misnamed helper — returns PNG body plate, not SVG
          el.dataset.step = 'body'
          el.src = basicHumanSvgDataUri({
            serial,
            label: `Human #${serial}`,
          })
        }
      }}
    />
  )
}

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
          f.specialName,
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

  const selectedImg = selected ? artFor(selected) : ''

  return (
    <section className="panel fp-root med-char-select g-pick" data-nft-catalog="1">
      <header className="fp-head g-pick-head">
        <div className="fp-head-row g-pick-head-row">
          <h2 className="g-panel-title">{title}</h2>
          {typeof creditBalance === 'number' ? (
            <span className="fp-balance g-pick-balance" title="Suite credits">
              {Math.max(0, Math.floor(creditBalance))} cr
            </span>
          ) : null}
        </div>
        <p className="fp-hint">Your owned champions only · humans &amp; gods enter the lists</p>
      </header>

      {selected && isFightable(selected) ? (
        <div className="fp-selected" data-testid="fp-selected">
          <div className="fp-selected-thumb med-char-frame is-on">
            <ThumbImg f={selected} img={selectedImg} />
          </div>
          <div className="fp-selected-body">
            <strong className="fp-selected-name">{selected.name}</strong>
            <div className="fp-selected-meta">
              <span className="fp-pl">PL {selectedPl?.total ?? powerLevelOf(selected)}</span>
              <span>
                {selected.wins}-{selected.losses}
              </span>
              <span>{CATEGORY_LABEL[selected.category || 'other']}</span>
              {selectedWiring?.archetype ? <span>{selectedWiring.archetype}</span> : null}
            </div>
            <div className="fp-selected-stats">
              <span>HP {selected.stats.hp}</span>
              <span>ATK {selected.stats.atk}</span>
              <span>DEF {selected.stats.def}</span>
              <span>SPD {selected.stats.speed}</span>
            </div>
            <small className="fp-selected-moves">
              SP {fighterMoves(selected).special.name}
              {selected.secretName ? ` · ✦ ${selected.secretName}` : ''}
            </small>
            {onView ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm fp-detail-btn"
                onClick={() => onView(selected)}
              >
                Champion sheet
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="fp-tools">
        <input
          className="fp-search"
          type="search"
          placeholder="Search name, weapon…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search fighters"
        />
        <select
          className="fp-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort fighters"
        >
          <option value="power">Power</option>
          <option value="hp">HP</option>
          <option value="level">Level</option>
          <option value="name">Name</option>
          <option value="record">Record</option>
        </select>
      </div>

      <div className="fp-tabs" role="tablist" aria-label="NFT categories">
        {PICKER_TABS.map((t) => {
          const n = counts[t.id] ?? 0
          if (t.id !== 'all' && t.id !== 'fightable' && n === 0) return null
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`fp-tab${tab === t.id ? ' is-on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <em>{t.id === 'all' ? counts.all || 0 : n}</em>
            </button>
          )
        })}
      </div>

      {loading ? <p className="fp-hint">Loading champions…</p> : null}
      {!loading && visible.length === 0 ? (
        <div className="fp-empty">
          <p className="fp-hint">{emptyHint || 'No NFTs in this filter'}</p>
          {showCafeCta ? (
            <div className="fp-empty-actions">
              <a className="btn btn-ok" href={cafeBuyNftUrl()}>
                Get NFTs on Cafe
              </a>
              <a
                className="btn btn-ghost"
                href={xrpCafeFightersUrl()}
                target="_blank"
                rel="noreferrer"
              >
                xrp.cafe
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="fp-grid med-char-grid" role="list">
        {visible.map((f) => {
          const fightable = isFightable(f)
          const blocked = fightSelectOnly && !fightable
          const img = artFor(f)
          const on = selectedId === f.id
          const pl = powerLevelOf(f)
          const chips = fighterTraitChips(f).slice(0, 2)
          return (
            <button
              key={f.id}
              type="button"
              role="listitem"
              className={`fp-card g-pick-card med-char-frame${on ? ' is-on' : ''}${blocked ? ' is-dim' : ''}`}
              disabled={blocked}
              title={
                blocked
                  ? `${f.categoryLabel || f.category} — view only`
                  : `${f.name} · PL ${pl}`
              }
              onClick={() => {
                if (blocked) return
                sfx.select()
                onSelect(f.powers ? f : withCombatPowers(f))
              }}
            >
              <div className="fp-card-art g-pick-art">
                <ThumbImg f={f} img={img} />
                <span className="fp-card-pl g-pick-pl">PL {pl}</span>
                {on ? <span className="fp-card-sel g-pick-sel">✓</span> : null}
                {f.category === 'god' ? <span className="fp-card-god g-pick-god">GOD</span> : null}
              </div>
              <div className="fp-card-body g-pick-body">
                <b className="fp-card-name g-pick-name">{f.name}</b>
                <div className="fp-card-line">
                  <span>
                    {f.wins}-{f.losses}
                  </span>
                  <span>HP {f.stats.hp}</span>
                </div>
                {chips.length ? (
                  <div className="fp-card-chips">
                    {chips.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              {onView ? (
                <span
                  className="fp-card-view"
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
                  i
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {selected && isFightable(selected) && selected.traits && selected.traits.length > 0 ? (
        <div className="fp-traits">
          {selected.traits.slice(0, 8).map((t, i) => (
            <span key={`${t.trait_type}-${i}`} className="fp-trait">
              <em>{t.trait_type}</em> {String(t.value)}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )
}
