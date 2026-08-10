/**
 * Fighter home hero — rebuilt v2 (arena cabinet look).
 */
type Props = {
  rankLabel: string
  rankPoints: number
  streak: number
  wins: number
  losses: number
  selectedName?: string
}

export function GameHero({
  rankLabel,
  rankPoints,
  streak,
  wins,
  losses,
  selectedName,
}: Props) {
  return (
    <section className="fd-hero" aria-label="Riddle Fighter home">
      <div className="fd-hero-glow" aria-hidden />
      <div className="fd-hero-inner">
        <div className="fd-hero-row1">
          <span className="fd-badge">FIGHTER · NOT CITY</span>
          <span className="fd-badge fd-badge-live">ONLINE</span>
        </div>
        <h1 className="fd-title">
          RIDDLE
          <span className="fd-title-x">×</span>
          <span className="fd-title-accent">FIGHTER</span>
        </h1>
        <p className="fd-sub">
          Connect wallet · fight with NFTs you own · stats from real traits
        </p>
        {selectedName ? (
          <p className="fd-selected">
            Ready: <strong>{selectedName}</strong>
          </p>
        ) : (
          <p className="fd-selected muted">Connect wallet and pick an owned NFT</p>
        )}
        <div className="fd-stat-row">
          <div className="fd-stat">
            <span>RANK</span>
            <b>
              {rankLabel} {rankPoints}
            </b>
          </div>
          <div className="fd-stat">
            <span>W–L</span>
            <b>
              <i className="w">{wins}</i>
              <em>–</em>
              <i className="l">{losses}</i>
            </b>
          </div>
          <div className="fd-stat">
            <span>STREAK</span>
            <b className={streak >= 2 ? 'hot' : ''}>{streak}</b>
          </div>
        </div>
      </div>
    </section>
  )
}
