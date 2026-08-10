/**
 * PlayStation / DualSense / Xbox gamepad → InputState.
 * Standard mapping: buttons 0=A/X 1=B/O 2=X/□ 3=Y/△ 4=L1 5=R1 6=L2 7=R2
 */
import type { InputState } from '../game/engine'
import { emptyInput } from '../game/engine'

export function pollGamepad(index = 0): InputState | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
  let pads: (Gamepad | null)[]
  try {
    pads = navigator.getGamepads()
  } catch {
    return null
  }
  const gp = pads[index]
  if (!gp || !gp.connected) return null

  const b = (i: number) => !!(gp.buttons[i] && gp.buttons[i]!.pressed)
  const ax = gp.axes[0] ?? 0
  const ay = gp.axes[1] ?? 0
  const dead = 0.35

  // D-pad buttons 12-15 when present
  const dUp = b(12) || ay < -dead
  const dDown = b(13) || ay > dead
  const dLeft = b(14) || ax < -dead
  const dRight = b(15) || ax > dead

  return {
    left: dLeft,
    right: dRight,
    up: dUp,
    down: dDown,
    // ✕ / A
    punch: b(0),
    // ○ / B
    kick: b(1),
    // □ / X or L1
    block: b(2) || b(4) || b(7),
    // △ / Y or L2
    special: b(3) || b(6),
  }
}

export function mergePad(base: InputState, pad: InputState | null): InputState {
  if (!pad) return base
  return {
    left: base.left || pad.left,
    right: base.right || pad.right,
    up: base.up || pad.up,
    down: base.down || pad.down,
    punch: base.punch || pad.punch,
    kick: base.kick || pad.kick,
    block: base.block || pad.block,
    special: base.special || pad.special,
  }
}

export { emptyInput }
