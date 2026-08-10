import { useEffect, useRef, useState } from 'react'
import {
  FightEngine,
  type EngineSnapshot,
  type InputState,
  type Side,
} from '../game/engine'
import type { Fighter } from '../lib/fighters'
import type { DifficultyId } from '../lib/difficulty'
import { unlockAudio } from '../lib/audio'
import { enterFightFullscreen, exitFightFullscreen, vibrate } from '../lib/fullscreen'
import { mergePad, pollGamepad } from '../lib/gamepad'
import { PsControls } from './PsControls'

export type ArenaMode = 'cpu' | 'local2p' | 'online-host' | 'online-guest'

type Props = {
  p1: Fighter
  p2: Fighter
  mode: ArenaMode
  roundsToWin?: number
  /** CPU difficulty (default easy). */
  difficulty?: DifficultyId
  onMatchEnd: (winner: Side, meta?: { maxCombo: number }) => void
  onSnapshot?: (snap: EngineSnapshot) => void
  guestApplySnapRef?: React.MutableRefObject<((s: EngineSnapshot) => void) | null>
  hostSetP2InputRef?: React.MutableRefObject<((i: Partial<InputState>) => void) | null>
  guestSendInputRef?: React.MutableRefObject<((i: InputState) => void) | null>
}

export function Arena({
  p1,
  p2,
  mode,
  roundsToWin = 2,
  difficulty = 'easy',
  onMatchEnd,
  onSnapshot,
  guestApplySnapRef,
  hostSetP2InputRef,
  guestSendInputRef,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<FightEngine | null>(null)
  const ended = useRef(false)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const touchP1 = useRef<Partial<InputState>>({})
  const touchP2 = useRef<Partial<InputState>>({})
  const keysP1 = useRef<Partial<InputState>>({})
  const keysP2 = useRef<Partial<InputState>>({})
  /** Mobile: collapse PsControls legend into a toggle (keeps stage clear). */
  const [legendOpen, setLegendOpen] = useState(false)
  const guestInput = useRef<InputState>({
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
    block: false,
    special: false,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    ended.current = false
    unlockAudio()
    void enterFightFullscreen(shellRef.current || document.documentElement)
    vibrate(8)

    const p2Mode =
      mode === 'cpu' ? 'cpu' : mode === 'online-guest' ? 'remote-guest' : 'human'

    const eng = new FightEngine(canvas, p1, p2, {
      p2Mode,
      roundsToWin,
      difficulty,
      hooks: {
        onMatchEnd: (side) => {
          if (ended.current) return
          ended.current = true
          const maxCombo = eng.maxComboThisMatch
          window.setTimeout(() => {
            void exitFightFullscreen()
            onMatchEnd(side, { maxCombo })
          }, 900)
        },
      },
    })
    engineRef.current = eng

    if (mode === 'online-guest') {
      eng.startGuestRender()
      if (guestApplySnapRef) guestApplySnapRef.current = (s) => eng.applySnapshot(s)
    } else {
      eng.start()
      if (mode === 'online-host' && hostSetP2InputRef) {
        hostSetP2InputRef.current = (partial) => eng.setP2Input(partial)
      }
    }

    let snapTimer = 0
    if (mode === 'online-host' && onSnapshot) {
      snapTimer = window.setInterval(() => onSnapshot(eng.snapshot()), 50)
    }

    // merge touch + keys + gamepad every frame via rAF pump into engine
    let alive = true
    const pump = () => {
      if (!alive || !engineRef.current) return
      const m = modeRef.current
      const baseP1: InputState = {
        left: !!(keysP1.current.left || touchP1.current.left),
        right: !!(keysP1.current.right || touchP1.current.right),
        up: !!(keysP1.current.up || touchP1.current.up),
        down: !!(keysP1.current.down || touchP1.current.down),
        punch: !!(keysP1.current.punch || touchP1.current.punch),
        kick: !!(keysP1.current.kick || touchP1.current.kick),
        block: !!(keysP1.current.block || touchP1.current.block),
        special: !!(keysP1.current.special || touchP1.current.special),
      }
      const pad0 = pollGamepad(0)
      const p1In = mergePad(baseP1, pad0)
      if (m === 'online-guest') {
        guestInput.current = p1In
        eng.setP1Input(p1In)
        guestSendInputRef?.current?.(p1In)
      } else {
        eng.setP1Input(p1In)
      }
      if (m === 'local2p') {
        const baseP2: InputState = {
          left: !!(keysP2.current.left || touchP2.current.left),
          right: !!(keysP2.current.right || touchP2.current.right),
          up: !!(keysP2.current.up || touchP2.current.up),
          down: !!(keysP2.current.down || touchP2.current.down),
          punch: !!(keysP2.current.punch || touchP2.current.punch),
          kick: !!(keysP2.current.kick || touchP2.current.kick),
          block: !!(keysP2.current.block || touchP2.current.block),
          special: !!(keysP2.current.special || touchP2.current.special),
        }
        eng.setP2Input(mergePad(baseP2, pollGamepad(1)))
      }
      requestAnimationFrame(pump)
    }
    requestAnimationFrame(pump)

    const onKey = (e: KeyboardEvent, down: boolean) => {
      const p1Map: Record<string, keyof InputState> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
        j: 'punch',
        k: 'kick',
        l: 'block',
        u: 'special',
        J: 'punch',
        K: 'kick',
        L: 'block',
        U: 'special',
        ' ': 'punch',
      }
      const p2Map: Record<string, keyof InputState> = {
        a: 'left',
        d: 'right',
        w: 'up',
        s: 'down',
        f: 'punch',
        g: 'kick',
        h: 'block',
        y: 'special',
      }
      const k1 = p1Map[e.key]
      if (k1) {
        e.preventDefault()
        keysP1.current = { ...keysP1.current, [k1]: down }
      }
      const k2 = p2Map[e.key]
      if (k2 && modeRef.current === 'local2p') {
        e.preventDefault()
        keysP2.current = { ...keysP2.current, [k2]: down }
      }
    }
    const kd = (e: KeyboardEvent) => onKey(e, true)
    const ku = (e: KeyboardEvent) => onKey(e, false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)

    return () => {
      alive = false
      if (snapTimer) clearInterval(snapTimer)
      eng.destroy()
      engineRef.current = null
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      if (hostSetP2InputRef) hostSetP2InputRef.current = null
      if (guestApplySnapRef) guestApplySnapRef.current = null
      void exitFightFullscreen()
    }
  }, [
    p1,
    p2,
    mode,
    roundsToWin,
    difficulty,
    onMatchEnd,
    onSnapshot,
    guestApplySnapRef,
    hostSetP2InputRef,
    guestSendInputRef,
  ])

  const onP1 = (partial: Partial<InputState>) => {
    touchP1.current = { ...touchP1.current, ...partial }
  }
  const onP2 = (partial: Partial<InputState>) => {
    touchP2.current = { ...touchP2.current, ...partial }
  }

  return (
    <div className="arena-root fight-shell" ref={shellRef}>
      <div className="arena-stage">
        <div className="arena-wrap">
          <canvas ref={canvasRef} width={960} height={540} aria-label="Fight arena" />
        </div>
        {/* Mobile: left move · right actions (both sides). Desktop: hidden — keyboard. */}
        <div className="ps-overlay ps-overlay-mobile" aria-label="Touch controls">
          {mode === 'local2p' ? (
            <>
              <PsControls player={1} side="full" onChange={onP1} />
              <PsControls player={2} side="full" onChange={onP2} />
            </>
          ) : (
            <>
              <PsControls player={1} side="left" onChange={onP1} />
              <PsControls player={1} side="right" onChange={onP1} />
            </>
          )}
        </div>
      </div>
      <div className="fight-control-legend">
        {/* Desktop: always show key legend */}
        <p className="hint keys-hint fight-tips keys-desktop">
          <b>Desktop</b> · Arrows move · <kbd>J</kbd>/<kbd>Space</kbd> Punch · <kbd>K</kbd> Kick ·{' '}
          <kbd>L</kbd> Block · <kbd>U</kbd> Special (tap, not hold) · Secret: full meter + SP or ↓↘→ J
        </p>
        {/* Phones: legend collapses behind a ≥44px toggle */}
        <div className="fight-legend-mobile keys-mobile">
          <button
            type="button"
            className="fight-legend-toggle"
            aria-expanded={legendOpen}
            aria-controls="fight-legend-panel"
            onClick={() => setLegendOpen((v) => !v)}
          >
            {legendOpen ? 'Hide controls' : 'Controls · moves'}
          </button>
          {legendOpen ? (
            <div id="fight-legend-panel" className="fight-legend-panel">
              <p className="hint keys-hint fight-tips">
                <b>Touch</b> · Left pad = move · Right pad = ✕ punch · ○ kick · □ block · △ special
              </p>
              <p className="hint keys-hint fight-tips">
                SECRET: ↓↘→ then ✕ @ full meter · SUPER: ←↙↓ then ○
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
