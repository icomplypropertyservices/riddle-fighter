/**
 * Medieval SF-style HP + special meter strip.
 */
type Props = {
  name: string
  hp: number
  maxHp: number
  meter?: number
  maxMeter?: number
  side?: 'p1' | 'p2'
  powerLevel?: number
  className?: string
}

export function HpBar({
  name,
  hp,
  maxHp,
  meter = 0,
  maxMeter = 100,
  side = 'p1',
  powerLevel,
  className = '',
}: Props) {
  const max = Math.max(1, maxHp)
  const pct = Math.max(0, Math.min(100, (hp / max) * 100))
  const mMax = Math.max(1, maxMeter)
  const mPct = Math.max(0, Math.min(100, (meter / mMax) * 100))
  const low = pct <= 35
  const critical = pct <= 15

  return (
    <div className={`med-hp med-hp-${side}${className ? ` ${className}` : ''}`}>
      <div className="med-hp-label">
        <b>{name}</b>
        {typeof powerLevel === 'number' ? <em>PL {powerLevel}</em> : null}
        <span>
          {Math.max(0, Math.ceil(hp))}/{max}
        </span>
      </div>
      <div
        className={`med-hp-track${side === 'p2' ? ' is-p2' : ''}`}
        style={{ ['--hp-pct' as string]: pct }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name} health`}
      >
        <div
          className={`med-hp-fill${low ? ' is-low' : ''}${critical ? ' is-critical' : ''}`}
        />
      </div>
      <div
        className="med-meter-track"
        style={{ ['--meter-pct' as string]: mPct }}
        aria-hidden
      >
        <div className="med-meter-fill" />
      </div>
    </div>
  )
}
