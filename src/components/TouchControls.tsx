import type { PointerEvent as ReactPointerEvent } from 'react'
import type { InputState } from '../game/engine'

type Props = {
  onChange: (partial: Partial<InputState>) => void
  /** Compact dual layout label */
  label?: string
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

export function TouchControls({ onChange, label, side = 'full' }: Props) {
  return (
    <div
      className={`touch touch-${side}`}
      aria-label={label || 'Touch controls'}
    >
      {label ? <div className="touch-label">{label}</div> : null}
      <div className="touch-pad" role="group" aria-label="Movement">
        <span />
        <button type="button" className="pad-btn" {...bind(onChange, 'up')}>
          ↑
        </button>
        <span />
        <button type="button" className="pad-btn" {...bind(onChange, 'left')}>
          ←
        </button>
        <button type="button" className="pad-btn" {...bind(onChange, 'down')}>
          ↓
        </button>
        <button type="button" className="pad-btn" {...bind(onChange, 'right')}>
          →
        </button>
      </div>
      <div className="actions" role="group" aria-label="Actions">
        <button type="button" className="pad-btn" {...bind(onChange, 'punch')} title="Punch · also SECRET with ↓↘→">
          P
        </button>
        <button type="button" className="pad-btn" {...bind(onChange, 'kick')} title="Kick · SUPER with ←↙↓">
          K
        </button>
        <button type="button" className="pad-btn" {...bind(onChange, 'block')}>
          B
        </button>
        <button type="button" className="pad-btn special" {...bind(onChange, 'special')} title="Special (50) · Secret (100+motion)">
          SP
        </button>
      </div>
      <div className="touch-hint">
        SECRET: ↓↘→ then P @ full meter · SUPER: ←↙↓ then K
      </div>
    </div>
  )
}
