/**
 * Street Fighter–style motion buffer for secret / super inputs.
 * Tracks recent directional presses within a short window.
 */

export type Dir = 'n' | 'u' | 'd' | 'f' | 'b' | 'df' | 'db' | 'uf' | 'ub'

export class MotionBuffer {
  private buf: { d: Dir; t: number }[] = []
  private readonly maxAge = 22 // frames (~0.35s at 60fps)

  push(facing: 1 | -1, left: boolean, right: boolean, up: boolean, down: boolean, frame: number): void {
    let d: Dir = 'n'
    const fwd = facing === 1 ? right : left
    const back = facing === 1 ? left : right
    if (down && fwd) d = 'df'
    else if (down && back) d = 'db'
    else if (up && fwd) d = 'uf'
    else if (up && back) d = 'ub'
    else if (down) d = 'd'
    else if (up) d = 'u'
    else if (fwd) d = 'f'
    else if (back) d = 'b'
    else d = 'n'

    const last = this.buf[this.buf.length - 1]
    if (!last || last.d !== d) {
      this.buf.push({ d, t: frame })
      if (this.buf.length > 16) this.buf.shift()
    } else {
      last.t = frame
    }
    // prune
    this.buf = this.buf.filter((e) => frame - e.t <= this.maxAge)
  }

  /** ↓ ↘ →  (quarter circle forward) */
  matchQcf(frame: number): boolean {
    return this.matchSeq(['d', 'df', 'f'], frame) || this.matchSeq(['d', 'f'], frame)
  }

  /** ↓ ↙ ←  (quarter circle back) */
  matchQcb(frame: number): boolean {
    return this.matchSeq(['d', 'db', 'b'], frame) || this.matchSeq(['d', 'b'], frame)
  }

  /** → ↓ ↘  (dragon punch) */
  matchDp(frame: number): boolean {
    return this.matchSeq(['f', 'd', 'df'], frame) || this.matchSeq(['f', 'd', 'f'], frame)
  }

  /** full circle-ish: f d b u or d f d b */
  matchCircle(frame: number): boolean {
    return (
      this.matchSeq(['f', 'df', 'd', 'db', 'b'], frame) ||
      this.matchSeq(['d', 'df', 'f', 'd', 'db', 'b'], frame)
    )
  }

  /** charge back then forward */
  matchChargeBf(frame: number): boolean {
    // simplified: b then f in window
    return this.matchSeq(['b', 'f'], frame) || this.matchSeq(['db', 'f'], frame)
  }

  private matchSeq(need: Dir[], frame: number): boolean {
    const recent = this.buf.filter((e) => frame - e.t <= this.maxAge && e.d !== 'n')
    if (recent.length < need.length) return false
    // subsequence match in order
    let i = 0
    for (const e of recent) {
      if (e.d === need[i]) {
        i++
        if (i >= need.length) return true
      }
    }
    return false
  }

  clear(): void {
    this.buf = []
  }
}
