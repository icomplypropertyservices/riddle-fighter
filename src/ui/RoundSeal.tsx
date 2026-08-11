/**
 * Round seal — wax-stamp style round indicator (SF timer / round wins).
 */
type Props = {
  round?: number
  label?: string
  p1Wins?: number
  p2Wins?: number
  roundsToWin?: number
  className?: string
}

export function RoundSeal({
  round = 1,
  label = 'ROUND',
  p1Wins = 0,
  p2Wins = 0,
  roundsToWin = 2,
  className = '',
}: Props) {
  const dots = Math.max(1, roundsToWin)
  return (
    <div
      className={`med-round-seal${className ? ` ${className}` : ''}`}
      role="status"
      aria-label={`${label} ${round}`}
    >
      <span className="med-round-seal-label">{label}</span>
      <span className="med-round-seal-num">{round}</span>
      <div className="med-round-dots" aria-hidden>
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={`p1-${i}`}
            className={`med-round-dot${i < p1Wins ? ' is-won' : ''}`}
            title="P1"
          />
        ))}
        <span style={{ width: 4 }} />
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={`p2-${i}`}
            className={`med-round-dot${i < p2Wins ? ' is-won' : ''}`}
            title="P2"
          />
        ))}
      </div>
    </div>
  )
}
