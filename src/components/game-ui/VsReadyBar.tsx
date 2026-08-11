/**
 * Versus strip — portraits + raised FIGHT plate (SF VS energy).
 */
import type { Fighter } from '../../lib/fighters'
import { resolveFighterArt } from '../../lib/nftArt'
import { powerLevelOf, withCombatPowers } from '../../lib/traitPowers'
import { BATTLE_ENTRY_FEE, TOURNAMENT_ENTRY_FEE, formatCredits } from '../../lib/credits'

type Props = {
  p1: Fighter | null
  p2: Fighter | null
  p2Label?: string
  ready: boolean
  readyLabel?: string
  onFight?: () => void
  disabled?: boolean
  entryCost?: number
  balance?: number
  insufficient?: boolean
}

function Portrait({ f, side }: { f: Fighter | null; side: 'p1' | 'p2' }) {
  const powered = f ? (f.powers && f.powerLevel ? f : withCombatPowers(f)) : null
  const img = powered
    ? resolveFighterArt({
        name: powered.name,
        image: powered.image,
        originalImage: powered.originalImage,
        newImage: powered.newImage,
        taxon: powered.taxon,
        collection: powered.collection,
        traits: powered.traits,
      })
    : ''
  const pl = powered ? powerLevelOf(powered) : 0
  /* Gold challenger / crimson rival — no neon */
  const accent = powered?.color || (side === 'p1' ? '#d4a017' : '#c41e3a')

  return (
    <div className={`g-vs-port g-vs-port-${side}`}>
      <div
        className="g-vs-art"
        style={
          img
            ? {
                backgroundColor: '#120e0a',
                backgroundImage: `url(${img})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center top',
                borderColor: accent,
              }
            : { backgroundColor: '#1a140e', borderColor: accent }
        }
      >
        {!img ? <span className="g-vs-empty">?</span> : null}
        {powered ? <span className="g-vs-pl">PL {pl}</span> : null}
      </div>
      <div className="g-vs-meta">
        <span className="g-vs-side">{side === 'p1' ? 'YOU' : 'RIVAL'}</span>
        <b className="g-vs-name">{powered?.name || (side === 'p1' ? 'Pick NFT' : '—')}</b>
        {powered ? (
          <small className="g-vs-kit">
            HP {powered.stats.hp} · ATK {powered.stats.atk}
          </small>
        ) : (
          <small className="g-vs-kit muted">Waiting</small>
        )}
      </div>
    </div>
  )
}

export function VsReadyBar({
  p1,
  p2,
  p2Label,
  ready,
  readyLabel = 'FIGHT',
  onFight,
  disabled,
  entryCost = BATTLE_ENTRY_FEE,
  balance,
  insufficient,
}: Props) {
  const cost = Math.max(0, Math.floor(entryCost))
  const short = Boolean(insufficient)
  return (
    <section className="g-vs med-vs med-vs-plate" aria-label="Versus ready">
      <div className="g-vs-inner">
        <Portrait f={p1} side="p1" />
        <div className="g-vs-mid">
          <span className="g-vs-vs med-vs-mark">VS</span>
          {p2Label ? <span className="g-vs-sub">{p2Label}</span> : null}
          <button
            type="button"
            className={`g-vs-fight med-fight-plate${ready && !short ? ' is-ready' : ''}${short ? ' is-broke' : ''}`}
            disabled={!ready || disabled || short}
            onClick={onFight}
          >
            {readyLabel}
            {cost > 0 ? <span className="g-vs-price">{cost} cr</span> : null}
          </button>
          {typeof balance === 'number' ? (
            <span className={`g-vs-bal${short ? ' is-short' : ''}`}>
              {formatCredits(balance)}
              {short ? ' · need more' : ''}
            </span>
          ) : null}
        </div>
        <Portrait f={p2} side="p2" />
      </div>
      {p1 ? (
        <div className="g-vs-stats-row">
          <span className="g-pick-pl-inline">PL {powerLevelOf(p1)}</span>
          <span>HP {p1.stats.hp}</span>
          <span>ATK {p1.stats.atk}</span>
          <span>DEF {p1.stats.def}</span>
          <span>SPD {p1.stats.speed}</span>
        </div>
      ) : null}
    </section>
  )
}

export { BATTLE_ENTRY_FEE, TOURNAMENT_ENTRY_FEE }
