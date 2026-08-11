/**
 * Visual tournament bracket — cool single-elim board.
 * Setup summary + prize pool + civ/NFT tags + play controls.
 */
import { useMemo } from 'react'
import type { Tournament } from '../lib/tournament'
import {
  getSeat,
  matchesByRound,
  formatTourneyWhen,
  tourneyShareUrl,
  civTourneyInviteUrl,
  roundsInTourney,
} from '../lib/tournament'
import { formatCredits } from '../lib/credits'
import { SUITE } from '../lib/suite'

type Props = {
  tourney: Tournament
  entryLocked?: boolean
  onLockAndStart?: () => void
  onPlayNext?: () => void
  onAbandon?: () => void
  onLobby?: () => void
}

function SeatChip({
  label,
  image,
  civTag,
  eliminated,
  winner,
  you,
}: {
  label: string
  image?: string
  civTag?: string
  eliminated?: boolean
  winner?: boolean
  you?: boolean
}) {
  return (
    <div
      className={`tb-seat${eliminated ? ' is-out' : ''}${winner ? ' is-win' : ''}${you ? ' is-you' : ''}`}
    >
      <div
        className="tb-seat__art"
        style={
          image
            ? {
                backgroundImage: `url(${image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      />
      <div className="tb-seat__meta">
        <strong>{label}</strong>
        {civTag ? <span className="tb-seat__civ">{civTag}</span> : null}
      </div>
    </div>
  )
}

export function TourneyBoard({
  tourney,
  entryLocked,
  onLockAndStart,
  onPlayNext,
  onAbandon,
  onLobby,
}: Props) {
  const byRound = useMemo(() => matchesByRound(tourney), [tourney])
  const rounds = roundsInTourney(tourney.size)
  const showLock =
    tourney.status === 'setup' ||
    tourney.status === 'registration' ||
    (tourney.status === 'live' && !entryLocked && tourney.entryFee > 0)
  const showPlay =
    tourney.status === 'live' && (entryLocked || tourney.entryFee === 0)
  const champ = tourney.championId ? getSeat(tourney, tourney.championId) : null
  const share = tourneyShareUrl(tourney)
  const civInvite = civTourneyInviteUrl(tourney)

  return (
    <section className="tb" data-testid="tourney-board" aria-label="Tournament bracket">
      <header className="tb-hero">
        <div className="tb-hero__glow" aria-hidden />
        <div className="tb-hero__row">
          <div>
            <p className="tb-kicker">
              {tourney.theme === 'civ'
                ? 'CIV BANNER CUP'
                : tourney.theme === 'nft'
                  ? 'NFT INVITATIONAL'
                  : tourney.theme === 'mixed'
                    ? 'REALM MIXED'
                    : 'FIGHTER CUP'}
            </p>
            <h1 className="tb-title">{tourney.name}</h1>
            <p className="tb-sub">
              {tourney.size}-player single elim · {formatTourneyWhen(tourney)}
              {tourney.hostHandle ? ` · host @${tourney.hostHandle.replace(/^@/, '')}` : ''}
            </p>
          </div>
          <div className={`tb-status tb-status--${tourney.status}`}>
            {tourney.status}
          </div>
        </div>

        <div className="tb-pool">
          <div className="tb-pool__cell">
            <span>Entry</span>
            <b>{formatCredits(tourney.entryCredits || tourney.entryFee)}</b>
          </div>
          <div className="tb-pool__cell">
            <span>Prize pool</span>
            <b className="tb-pool__gold">{formatCredits(tourney.pot)}</b>
          </div>
          <div className="tb-pool__cell">
            <span>Champion</span>
            <b>{formatCredits(tourney.winnerPayout)}</b>
          </div>
          <div className="tb-pool__cell">
            <span>Platform cut</span>
            <b>{formatCredits(tourney.platformCut)}</b>
          </div>
        </div>

        {tourney.civTags && tourney.civTags.length > 0 ? (
          <div className="tb-civs">
            {tourney.civTags.map((c) => (
              <span key={c} className="tb-civ-pill">
                {c}
              </span>
            ))}
          </div>
        ) : null}

        {tourney.description ? (
          <p className="tb-desc">{tourney.description}</p>
        ) : null}

        {champ ? (
          <div className="tb-champ" data-testid="tourney-champion">
            <span>👑 Champion</span>
            <strong>{champ.label}</strong>
            {champ.civTag ? <em>{champ.civTag}</em> : null}
          </div>
        ) : null}
      </header>

      {/* Visual bracket by round */}
      <div className="tb-bracket" data-rounds={rounds}>
        {Array.from({ length: rounds }, (_, ri) => {
          const r = ri + 1
          const matches = byRound.get(r) || []
          return (
            <div key={r} className="tb-round" data-round={r}>
              <h3 className="tb-round__title">
                {r === rounds ? 'Final' : r === rounds - 1 ? 'Semis' : `Round ${r}`}
              </h3>
              <div className="tb-round__list">
                {matches.map((m) => {
                  const a = getSeat(tourney, m.a)
                  const b = getSeat(tourney, m.b)
                  const cur = tourney.currentMatchId === m.id
                  return (
                    <div
                      key={m.id}
                      className={`tb-match${cur ? ' is-next' : ''}${m.winnerId ? ' is-done' : ''}`}
                    >
                      <div className="tb-match__label">
                        {m.label}
                        {cur ? <em>NEXT</em> : null}
                        {m.winnerId ? (
                          <em className="won">W {getSeat(tourney, m.winnerId)?.label}</em>
                        ) : null}
                      </div>
                      <SeatChip
                        label={a?.label || 'TBD'}
                        image={a?.image || a?.fighter.image}
                        civTag={a?.civTag}
                        eliminated={a?.eliminated}
                        winner={m.winnerId === a?.id}
                        you={a?.kind === 'you'}
                      />
                      <div className="tb-match__vs">VS</div>
                      <SeatChip
                        label={b?.label || 'TBD'}
                        image={b?.image || b?.fighter.image}
                        civTag={b?.civTag}
                        eliminated={b?.eliminated}
                        winner={m.winnerId === b?.id}
                        you={b?.kind === 'you'}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Roster strip */}
      <div className="tb-roster">
        <h3>Field · {tourney.seats.length} fighters</h3>
        <div className="tb-roster__grid">
          {tourney.seats.map((s) => (
            <div
              key={s.id}
              className={`tb-roster__card${s.eliminated ? ' is-out' : ''}${s.kind === 'you' ? ' is-you' : ''}`}
            >
              <div
                className="tb-roster__img"
                style={
                  s.image || s.fighter.image
                    ? {
                        backgroundImage: `url(${s.image || s.fighter.image})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : undefined
                }
              />
              <div>
                <strong>{s.label}</strong>
                <span>
                  {s.kind.toUpperCase()}
                  {s.civTag ? ` · ${s.civTag}` : ''}
                  {s.eliminated ? ' · OUT' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tb-actions">
        {showLock && onLockAndStart ? (
          <button
            type="button"
            className="btn btn-ok tb-btn-primary"
            data-testid="tourney-lock-start"
            onClick={onLockAndStart}
          >
            Lock {formatCredits(tourney.entryCredits || tourney.entryFee)} entry &amp; start
          </button>
        ) : null}
        {showPlay && onPlayNext ? (
          <button
            type="button"
            className="btn btn-ok tb-btn-primary"
            data-testid="tourney-play-next"
            onClick={onPlayNext}
          >
            Play next match
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(share)
          }}
        >
          Copy fighter link
        </button>
        <a className="btn btn-ghost" href={civInvite}>
          Share to Civ
        </a>
        <a className="btn btn-ghost" href={SUITE.civ} target="_blank" rel="noreferrer">
          Open Civ
        </a>
        {onAbandon ? (
          <button type="button" className="btn btn-danger" onClick={onAbandon}>
            Abandon
          </button>
        ) : null}
        {onLobby ? (
          <button type="button" className="btn btn-ghost" onClick={onLobby}>
            Lobby
          </button>
        ) : null}
      </div>
    </section>
  )
}
