/**
 * Fighter lobby hero — compact title + rank strip (dash v3).
 */
type Props = {
  rankLabel: string
  rankPoints: number
  streak: number
  wins: number
  losses: number
  selectedName?: string
  connected?: boolean
  hasRoster?: boolean
  credits?: number
}

export function GameHero({
  rankLabel,
  rankPoints,
  streak,
  wins,
  losses,
  selectedName,
  connected = false,
  hasRoster = false,
  credits,
}: Props) {
  const step = !connected ? 1 : !selectedName ? 2 : 3

  return (
    <section className="fd-hero" aria-label="Riddle Fighter" data-testid="fighter-hero">
      <div className="fd-hero__top">
        <div className="fd-hero__brand">
          <span className="fd-hero__live">LIVE</span>
          <h1 className="fd-hero__title">
            RIDDLE <span>FIGHTER</span>
          </h1>
        </div>
        {typeof credits === 'number' ? (
          <div className="fd-hero__credits" title="Suite credits">
            <span>cr</span>
            <strong>{Math.max(0, Math.floor(credits)).toLocaleString()}</strong>
          </div>
        ) : null}
      </div>

      <ol className="fd-hero__steps" aria-label="How to start">
        <li data-state={step === 1 ? 'now' : step > 1 ? 'done' : ''}>
          <em>1</em> Connect
        </li>
        <li data-state={step === 2 ? 'now' : step > 2 ? 'done' : ''}>
          <em>2</em> Pick
        </li>
        <li data-state={step === 3 ? 'now' : step > 3 ? 'done' : ''}>
          <em>3</em> Fight
        </li>
      </ol>

      <p className="fd-hero__status">
        {selectedName ? (
          <>
            Fighting as <strong>{selectedName}</strong>
          </>
        ) : connected && hasRoster ? (
          'Select a fighter below'
        ) : connected ? (
          'No fighters yet — mint free Basic Human'
        ) : (
          'Connect to load your NFTs'
        )}
      </p>

      <div className="fd-hero__stats">
        <div>
          <span>Rank</span>
          <b>
            {rankLabel} {rankPoints}
          </b>
        </div>
        <div>
          <span>W–L</span>
          <b>
            <i className="w">{wins}</i>
            <em>–</em>
            <i className="l">{losses}</i>
          </b>
        </div>
        <div>
          <span>Streak</span>
          <b className={streak >= 2 ? 'hot' : ''}>{streak}</b>
        </div>
      </div>
    </section>
  )
}
