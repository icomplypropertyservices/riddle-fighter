/**
 * Desktop fight instruction overlay — always shown at fight start (desktop).
 * Dismiss with any key, click, or after auto-timeout.
 */
import { useEffect, useState } from 'react'
import type { Fighter } from '../lib/fighters'

type Props = {
  p1: Fighter
  p2: Fighter
  local2p?: boolean
  /** Auto-hide ms (default 8s) */
  autoHideMs?: number
  onDismiss?: () => void
}

export function FightInstructions({
  p1,
  p2,
  local2p = false,
  autoHideMs = 9000,
  onDismiss,
}: Props) {
  const [open, setOpen] = useState(true)
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px) and (pointer: fine)')
    const apply = () => setIsDesktop(mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])

  useEffect(() => {
    if (!open) return
    const dismiss = () => {
      setOpen(false)
      onDismiss?.()
    }
    const t = window.setTimeout(dismiss, autoHideMs)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        dismiss()
      } else {
        // Any first keystroke also dismisses so fight can start clean
        dismiss()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, autoHideMs, onDismiss])

  if (!open || !isDesktop) return null

  const p1Pow = p1.stats
  const p2Pow = p2.stats

  return (
    <div
      className="fight-howto"
      data-testid="fight-instructions"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fight-howto-title"
      onClick={() => {
        setOpen(false)
        onDismiss?.()
      }}
    >
      <div
        className="fight-howto__card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fight-howto__head">
          <h2 id="fight-howto-title">How to fight</h2>
          <button
            type="button"
            className="fight-howto__go"
            data-testid="fight-instructions-go"
            onClick={() => {
              setOpen(false)
              onDismiss?.()
            }}
          >
            FIGHT
          </button>
        </div>

        <div className="fight-howto__grid">
          <div className="fight-howto__col">
            <h3>P1 — {p1.name}</h3>
            <ul>
              <li>
                <kbd>←</kbd> <kbd>→</kbd> Move · <kbd>↑</kbd> Jump · <kbd>↓</kbd> Crouch
              </li>
              <li>
                <kbd>J</kbd> / <kbd>Space</kbd> Punch · <kbd>K</kbd> Kick
              </li>
              <li>
                <kbd>L</kbd> Block · <kbd>U</kbd> Special (tap)
              </li>
              <li>
                Secret: <kbd>↓</kbd> <kbd>↘</kbd> <kbd>→</kbd> then <kbd>J</kbd> @ full meter
              </li>
            </ul>
            <div className="fight-howto__stats">
              HP {p1Pow.hp} · ATK {p1Pow.atk} · DEF {p1Pow.def} · SPD {p1Pow.speed} · SP{' '}
              {p1Pow.special}
            </div>
          </div>

          {local2p ? (
            <div className="fight-howto__col">
              <h3>P2 — {p2.name}</h3>
              <ul>
                <li>
                  <kbd>A</kbd> <kbd>D</kbd> Move · <kbd>W</kbd> Jump · <kbd>S</kbd> Crouch
                </li>
                <li>
                  <kbd>F</kbd> Punch · <kbd>G</kbd> Kick
                </li>
                <li>
                  <kbd>H</kbd> Block · <kbd>Y</kbd> Special
                </li>
              </ul>
              <div className="fight-howto__stats">
                HP {p2Pow.hp} · ATK {p2Pow.atk} · DEF {p2Pow.def} · SPD {p2Pow.speed} · SP{' '}
                {p2Pow.special}
              </div>
            </div>
          ) : (
            <div className="fight-howto__col">
              <h3>Rival — {p2.name}</h3>
              <p className="fight-howto__cpu">
                CPU uses this NFT’s real stats &amp; traits. Block, punish, and spend meter
                for specials when the bar is full.
              </p>
              <div className="fight-howto__stats">
                HP {p2Pow.hp} · ATK {p2Pow.atk} · DEF {p2Pow.def} · SPD {p2Pow.speed} · SP{' '}
                {p2Pow.special}
              </div>
            </div>
          )}
        </div>

        <p className="fight-howto__foot">
          Game is fullscreen · click FIGHT or press any key · Esc also closes
        </p>
      </div>
    </div>
  )
}
