/**
 * Champion portrait frame — NFT sheet / selected fighter hero.
 */
import type { ReactNode } from 'react'

type Stats = {
  hp?: number
  atk?: number
  def?: number
  speed?: number
}

type Props = {
  name: string
  image?: string
  sub?: string
  stats?: Stats
  powerLevel?: number
  badge?: string
  className?: string
  children?: ReactNode
}

export function ChampionFrame({
  name,
  image,
  sub,
  stats,
  powerLevel,
  badge,
  className = '',
  children,
}: Props) {
  return (
    <div
      className={`med-champion-frame${className ? ` ${className}` : ''}`}
      data-champion-frame="1"
    >
      {badge ? (
        <span
          className="fd-badge"
          style={{ position: 'relative', zIndex: 1, alignSelf: 'flex-start' }}
        >
          {badge}
        </span>
      ) : null}
      {image ? (
        <img className="med-champion-art" src={image} alt="" loading="lazy" />
      ) : (
        <div
          className="med-champion-art"
          style={{ display: 'grid', placeItems: 'center', color: 'var(--med-mute)' }}
          aria-hidden
        >
          ?
        </div>
      )}
      <h3 className="med-champion-name">{name}</h3>
      {sub || typeof powerLevel === 'number' ? (
        <p className="med-champion-sub">
          {sub}
          {typeof powerLevel === 'number'
            ? `${sub ? ' · ' : ''}PL ${powerLevel}`
            : ''}
        </p>
      ) : null}
      {stats ? (
        <div className="med-champion-stats">
          {stats.hp != null ? (
            <div className="med-champion-stat">
              <span>HP</span>
              <b>{stats.hp}</b>
            </div>
          ) : null}
          {stats.atk != null ? (
            <div className="med-champion-stat">
              <span>ATK</span>
              <b>{stats.atk}</b>
            </div>
          ) : null}
          {stats.def != null ? (
            <div className="med-champion-stat">
              <span>DEF</span>
              <b>{stats.def}</b>
            </div>
          ) : null}
          {stats.speed != null ? (
            <div className="med-champion-stat">
              <span>SPD</span>
              <b>{stats.speed}</b>
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
