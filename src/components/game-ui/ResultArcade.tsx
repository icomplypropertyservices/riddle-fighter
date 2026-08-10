/**
 * Post-fight KO / WIN panel — arcade cabinet energy.
 */
type Props = {
  won: boolean
  line: string
  opponent: string
  fighterName?: string
  fighterImage?: string
  payout?: number
  wager?: number
  note?: string
  onRematch?: () => void
  onLobby?: () => void
}

export function ResultArcade({
  won,
  line,
  opponent,
  fighterName,
  fighterImage,
  payout = 0,
  wager = 0,
  note,
  onRematch,
  onLobby,
}: Props) {
  return (
    <section className={`g-result${won ? ' is-win' : ' is-lose'}`} aria-live="polite">
      <div className="g-result-frame">
        <div className="g-result-banner">{won ? 'YOU WIN' : 'YOU LOSE'}</div>
        <div className="g-result-body">
          {fighterImage ? (
            <div
              className="g-result-art"
              style={{
                backgroundImage: `url(${fighterImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center top',
              }}
            />
          ) : (
            <div className="g-result-art g-result-art-empty" />
          )}
          <div className="g-result-copy">
            <p className="g-result-line">{line}</p>
            <p className="g-result-vs">
              {fighterName || 'You'} <span>vs</span> {opponent}
            </p>
            {wager > 0 ? (
              <p className="g-result-money">
                {won ? `+${payout}` : `−${wager}`} credits
              </p>
            ) : (
              <p className="g-result-money muted">Exhibition · no stake</p>
            )}
            {note ? <p className="g-result-note">{note}</p> : null}
          </div>
        </div>
        <div className="g-result-actions">
          {onRematch ? (
            <button type="button" className="btn btn-ok g-result-btn" onClick={onRematch}>
              Again
            </button>
          ) : null}
          {onLobby ? (
            <button type="button" className="btn g-result-btn" onClick={onLobby}>
              Lobby
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
