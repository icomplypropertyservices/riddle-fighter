/**
 * Fight controls — iron pads (medieval SF):
 * - Mobile 1P: D-pad LEFT · actions RIGHT
 * - Local 2P: full pads on each side
 * - Desktop: overlay hidden via CSS; keyboard is primary
 */
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { InputState } from '../game/engine'

type Props = {
  onChange: (partial: Partial<InputState>) => void
  player?: 1 | 2
  /** left = move only · right = actions only · full = both (2P pad) */
  side?: 'left' | 'right' | 'full'
}

function bind(
  onChange: Props['onChange'],
  key: keyof InputState,
): {
  onPointerDown: (e: ReactPointerEvent) => void
  onPointerUp: (e: ReactPointerEvent) => void
  onPointerLeave: (e: ReactPointerEvent) => void
  onPointerCancel: (e: ReactPointerEvent) => void
} {
  const down = (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    onChange({ [key]: true })
  }
  const up = (e: ReactPointerEvent) => {
    e.preventDefault()
    onChange({ [key]: false })
  }
  return {
    onPointerDown: down,
    onPointerUp: up,
    onPointerLeave: up,
    onPointerCancel: up,
  }
}

function Dpad({ onChange }: { onChange: Props['onChange'] }) {
  return (
    <div className="ps-dpad" aria-label="Move">
      <button type="button" className="ps-d up" {...bind(onChange, 'up')}>
        ▲
      </button>
      <button type="button" className="ps-d left" {...bind(onChange, 'left')}>
        ◀
      </button>
      <button type="button" className="ps-d center" tabIndex={-1} aria-hidden>
        ·
      </button>
      <button type="button" className="ps-d right" {...bind(onChange, 'right')}>
        ▶
      </button>
      <button type="button" className="ps-d down" {...bind(onChange, 'down')}>
        ▼
      </button>
    </div>
  )
}

function Face({ onChange }: { onChange: Props['onChange'] }) {
  return (
    <div className="ps-face" aria-label="Actions">
      <button type="button" className="ps-f tri" {...bind(onChange, 'special')} title="Special / Super">
        △
      </button>
      <button type="button" className="ps-f cir" {...bind(onChange, 'kick')} title="Kick">
        ○
      </button>
      <button type="button" className="ps-f x" {...bind(onChange, 'punch')} title="Punch">
        ✕
      </button>
      <button type="button" className="ps-f sq" {...bind(onChange, 'block')} title="Block">
        □
      </button>
    </div>
  )
}

export function PsControls({ onChange, player = 1, side = 'full' }: Props) {
  if (side === 'left') {
    return (
      <div className={`ps-pad ps-pad-side-left ps-pad-p${player} med-iron-pad`} aria-label="Move pad">
        <Dpad onChange={onChange} />
        <div className="ps-hint">MOVE</div>
      </div>
    )
  }
  if (side === 'right') {
    return (
      <div className={`ps-pad ps-pad-side-right ps-pad-p${player} med-iron-pad`} aria-label="Action pad">
        <div className="ps-shoulders">
          <button type="button" className="ps-l2" {...bind(onChange, 'special')}>
            L2
            <span>SP</span>
          </button>
          <button type="button" className="ps-r2" {...bind(onChange, 'block')}>
            R2
            <span>BLK</span>
          </button>
        </div>
        <Face onChange={onChange} />
        <div className="ps-hint">✕P · ○K · □B · △SP</div>
      </div>
    )
  }

  return (
    <div
      className={`ps-pad ps-pad-p${player} med-iron-pad`}
      aria-label={player === 1 ? 'Player 1 controls' : 'Player 2 controls'}
    >
      <div className="ps-shoulders">
        <button type="button" className="ps-l2" {...bind(onChange, 'special')}>
          L2
          <span>SP</span>
        </button>
        <button type="button" className="ps-r2" {...bind(onChange, 'block')}>
          R2
          <span>BLK</span>
        </button>
      </div>
      <div className="ps-body">
        <Dpad onChange={onChange} />
        <Face onChange={onChange} />
      </div>
      <div className="ps-hint">
        {player === 1 ? 'P1 pad' : 'P2 · WASD + FGHY'}
      </div>
    </div>
  )
}
