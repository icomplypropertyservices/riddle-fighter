/**
 * Versus plate — portrait pair + VS mark + optional fight CTA slot.
 */
import type { ReactNode } from 'react'

type SideProps = {
  name: string
  image?: string
  side: 'p1' | 'p2'
  sub?: string
  powerLevel?: number
  accent?: string
}

function Side({ name, image, side, sub, powerLevel, accent }: SideProps) {
  const border =
    accent || (side === 'p1' ? 'var(--med-gold)' : 'var(--med-crimson-hot)')
  return (
    <div className={`g-vs-port g-vs-port-${side} med-vs-side`}>
      <div
        className="g-vs-art med-vs-art"
        style={{
          backgroundColor: '#0e0c0a',
          backgroundImage: image ? `url(${image})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          borderColor: border,
        }}
      >
        {!image ? <span className="g-vs-empty">?</span> : null}
        {typeof powerLevel === 'number' ? (
          <span className="g-vs-pl">PL {powerLevel}</span>
        ) : null}
      </div>
      <div className="g-vs-meta">
        <span className="g-vs-side">{side === 'p1' ? 'YOU' : 'RIVAL'}</span>
        <b className="g-vs-name">{name}</b>
        {sub ? <small className="g-vs-kit">{sub}</small> : null}
      </div>
    </div>
  )
}

type Props = {
  p1Name: string
  p2Name: string
  p1Image?: string
  p2Image?: string
  p1Sub?: string
  p2Sub?: string
  p1Pl?: number
  p2Pl?: number
  p1Accent?: string
  p2Accent?: string
  mid?: ReactNode
  className?: string
}

export function VsPlate({
  p1Name,
  p2Name,
  p1Image,
  p2Image,
  p1Sub,
  p2Sub,
  p1Pl,
  p2Pl,
  p1Accent,
  p2Accent,
  mid,
  className = '',
}: Props) {
  return (
    <section
      className={`g-vs med-vs-plate${className ? ` ${className}` : ''}`}
      aria-label="Versus"
    >
      <div className="g-vs-inner">
        <Side
          name={p1Name}
          image={p1Image}
          side="p1"
          sub={p1Sub}
          powerLevel={p1Pl}
          accent={p1Accent}
        />
        <div className="g-vs-mid">
          <span className="g-vs-vs med-vs-mark">VS</span>
          {mid}
        </div>
        <Side
          name={p2Name}
          image={p2Image}
          side="p2"
          sub={p2Sub}
          powerLevel={p2Pl}
          accent={p2Accent}
        />
      </div>
    </section>
  )
}
