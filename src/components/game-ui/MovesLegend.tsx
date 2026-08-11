/**
 * Command scroll — motion inputs + trait powers (medieval parchment).
 */
import type { Fighter } from '../../lib/fighters'
import { fighterMoves } from '../../lib/fighters'
import { movesetSummary } from '../../lib/moveset'
import { powerSummary, withCombatPowers } from '../../lib/traitPowers'

type Props = {
  fighter?: Fighter | null
  compact?: boolean
}

export function MovesLegend({ fighter, compact }: Props) {
  const f = fighter ? withCombatPowers(fighter) : null
  const lines = f
    ? movesetSummary(fighterMoves(f))
    : [
        'P · Punch',
        'K · Kick',
        'SP · Special (50 meter)',
        '✦ SECRET · full meter + ↓↘→ + P',
        '★ SUPER · 75 meter + ←↙↓ + K',
      ]
  const powers = f?.powers ? powerSummary(f.powers, compact ? 6 : 14) : []

  return (
    <section
      className={`g-panel g-moves med-moves${compact ? ' is-compact' : ''}`}
      aria-label="Moves"
    >
      <div className="g-panel-head">
        <h2 className="g-panel-title">{f ? `${f.name} · arts` : 'Command scroll'}</h2>
        <span className="g-panel-hint">Motion inputs · trait powers</span>
      </div>
      <ul className="g-moves-list">
        {lines.map((line) => (
          <li key={line}>
            <span className="g-moves-dot" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
      {powers.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <div className="g-panel-hint" style={{ marginBottom: 6 }}>
            Trait powers ({f?.powers?.effects.length ?? 0} active)
          </div>
          <ul className="g-moves-list" data-testid="trait-powers-list">
            {powers.map((line) => (
              <li key={line}>
                <span
                  className="g-moves-dot"
                  aria-hidden
                  style={{ background: 'var(--med-gold, #c9a227)' }}
                />
                <span style={{ fontSize: 12, color: 'var(--med-parchment-deep, #c4a574)' }}>
                  {line}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="g-moves-foot">
        <kbd>↓</kbd>
        <kbd>↘</kbd>
        <kbd>→</kbd>
        <span>+</span>
        <kbd>P</kbd>
        <span className="g-moves-foot-l">Secret @ 100</span>
      </div>
    </section>
  )
}
