/**
 * Riddle Fighter engine — juiced SF-style combat.
 * HD (non-8-bit) canvas, NFT sprites, specials + secret supers + motion inputs.
 */

import type { Fighter } from '../lib/fighters'
import { fighterMoves } from '../lib/fighters'
import {
  powersReady,
  withCombatPowers,
  type CombatPowers,
  type StatusKind,
} from '../lib/traitPowers'
import type { MoveDef, MoveSlot } from '../lib/moveset'
import {
  getDifficulty,
  type DifficultyId,
  type DifficultyProfile,
} from '../lib/difficulty'
import { sfx } from '../lib/audio'
import { getCachedSprite, loadNftSprite } from '../lib/spriteCache'
import { vibrate } from '../lib/fullscreen'
import {
  getKoFx,
  getStageImage,
  pickStageId,
  preloadAllStages,
  preloadKoFx,
  preloadStage,
  type StageId,
} from '../lib/stageAssets'
import { MotionBuffer } from './motionBuffer'
import {
  type VfxParticle,
  designersByElement,
  mergeBursts,
  tickVfx,
  drawVfx,
  DESIGNER_ROSTER,
} from './vfx'
import {
  drawFighterSf,
  setupTrue2dCanvas,
  applyHighQuality,
  clearTrue2d,
  restoreTrue2dTransform,
  drawStageTrue2d,
  type True2dContext,
} from './render'
import { preloadAllCharacterBodies } from '../lib/characterBodies'

export type Side = 'p1' | 'p2'

export type FighterState = {
  fighter: Fighter
  x: number
  y: number
  facing: 1 | -1
  hp: number
  maxHp: number
  meter: number
  crouch: boolean
  blocking: boolean
  jump: boolean
  jv: number
  attackCd: number
  hitstun: number
  attackKind: null | MoveSlot
  attackFrame: number
  hitOnce: boolean
  dead: boolean
  roundsWon: number
  combo: number
  flash: number
  invuln: number
  /** Active move definition this attack */
  activeMove: MoveDef | null
  /** Banner name of last special/secret fired */
  lastMoveName: string
  lastMoveBanner: number
  /** Resolved trait powers (every NFT trait has a function) */
  powers: CombatPowers
  /** Status DoT / debuff from opponent traits */
  status: { kind: StatusKind; ticks: number; power: number } | null
  /** True after first successful unblocked hit this combo starter window */
  openedCombo: boolean
}

export type InputState = {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  punch: boolean
  kick: boolean
  block: boolean
  special: boolean
}

export type MatchPhase = 'intro' | 'fight' | 'ko' | 'round_end' | 'match_end' | 'finish'

export type EngineHooks = {
  onRoundEnd?: (winner: Side, p1Rounds: number, p2Rounds: number) => void
  onMatchEnd?: (winner: Side) => void
  onHit?: (side: Side, dmg: number, combo: number) => void
  onCombo?: (side: Side, count: number) => void
}

export type EngineSnapshot = {
  frame: number
  phase: MatchPhase
  introT: number
  koT: number
  round: number
  roundsToWin: number
  winner: Side | null
  p1: SnapFighter
  p2: SnapFighter
  comboBanner: number
  comboCount: number
  comboSide: Side | null
}

type SnapFighter = {
  id: string
  name: string
  color: string
  color2: string
  image?: string
  x: number
  y: number
  facing: 1 | -1
  hp: number
  maxHp: number
  meter: number
  crouch: boolean
  blocking: boolean
  jump: boolean
  attackKind: FighterState['attackKind']
  hitstun: number
  dead: boolean
  roundsWon: number
  combo: number
  flash: number
}

type Floater = {
  x: number
  y: number
  text: string
  life: number
  color: string
  vy: number
  scale?: number
}

/** Public: 10 VFX designer roster for UI / debug */
export { DESIGNER_ROSTER }

/** Near-HD internal res (16:9) for world-class upscale on phones/TVs. */
export const CANVAS_W = 960
export const CANVAS_H = 540
const GROUND = 420
/** Nintendo-style float: softer gravity, readable jumps (not frantic). */
const GRAVITY = 0.62
const WALK = 2.65
const JUMP_V = -11.2
const DASH = 5.4
/** Global damage scale — rounds last longer (Smash-like). */
const DMG_SCALE = 0.52
/** Max combo hits before forced drop (prevents infinite mash). */
const MAX_COMBO = 5
/** Frames after recovery where a pressed attack still fires (forgiving buffer). */
const INPUT_BUFFER_FRAMES = 10
/** Base HP multiplier for all fighters — matches take real time. */
const HP_SCALE = 1.55

export function emptyInput(): InputState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
    block: false,
    special: false,
  }
}

export class FightEngine {
  readonly width = CANVAS_W
  readonly height = CANVAS_H
  p1: FighterState
  p2: FighterState
  phase: MatchPhase = 'intro'
  introT = 80
  koT = 0
  frame = 0
  round = 1
  roundsToWin: number
  winner: Side | null = null
  /** Painted stage art id for this match. */
  stageId: StageId = 'neon-city'
  /** Public for UI / HUD */
  lastComboMax = 0
  comboBanner = 0
  comboCount = 0
  comboSide: Side | null = null
  finishFlash = 0
  bgPulse = 0
  private hooks: EngineHooks
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  /** Device pixel ratio used by the true-2D pipeline (logical 960×540). */
  private dpr = 1
  private running = false
  private raf = 0
  private last = 0
  private acc = 0
  private readonly stepMs = 1000 / 60
  private p1Keys = emptyInput()
  private p1Touch = emptyInput()
  private p2Keys = emptyInput()
  private p2Touch = emptyInput()
  private p2Mode: 'cpu' | 'human' | 'remote-guest'
  private difficulty: DifficultyProfile
  private paused = false
  private particles: VfxParticle[] = []
  private floaters: Floater[] = []
  private shake = 0
  private hitstop = 0
  private p1Motion = new MotionBuffer()
  private p2Motion = new MotionBuffer()
  private afterimages: { x: number; y: number; life: number; facing: 1 | -1; image?: string; color: string }[] = []
  /** Previous-frame inputs for edge detection (Nintendo: press ≠ hold-spam). */
  private prevI1 = emptyInput()
  private prevI2 = emptyInput()
  /** Buffered attack intents while recovering. */
  private buf1: { slot: 'punch' | 'kick' | 'special' | 'dash'; t: number } | null = null
  private buf2: { slot: 'punch' | 'kick' | 'special' | 'dash'; t: number } | null = null

  constructor(
    canvas: HTMLCanvasElement,
    a: Fighter,
    b: Fighter,
    opts?: {
      p2Mode?: 'cpu' | 'human' | 'remote-guest'
      roundsToWin?: number
      hooks?: EngineHooks
      difficulty?: DifficultyId
    },
  ) {
    this.canvas = canvas
    this.stageId = pickStageId(`${a.id}|${b.id}|${Date.now()}`)
    // True 2D high-DPI pipeline (A1 sharpness on phone/TV)
    const hd: True2dContext = setupTrue2dCanvas(canvas, CANVAS_W, CANVAS_H)
    this.ctx = hd.ctx
    this.dpr = hd.dpr
    this.hooks = opts?.hooks || {}
    this.p2Mode = opts?.p2Mode || 'cpu'
    this.difficulty = getDifficulty(opts?.difficulty || 'easy')
    this.roundsToWin = Math.max(1, Math.min(5, opts?.roundsToWin ?? 2))
    this.p1 = makeState(a, 200, 1)
    this.p2 = makeState(b, 760, -1)
    // Apply difficulty HP to CPU when in cpu mode
    if (this.p2Mode === 'cpu') {
      const d = this.difficulty
      this.p2.maxHp = Math.max(40, Math.round(this.p2.maxHp * d.hp))
      this.p2.hp = this.p2.maxHp
    }
    if (a.image) void loadNftSprite(a.image)
    if (b.image) void loadNftSprite(b.image)
    // Actual painted character bodies (side-view sprites)
    preloadAllCharacterBodies()
    void preloadStage(this.stageId)
    void preloadAllStages()
    void preloadKoFx()
  }

  get maxComboThisMatch(): number {
    return this.lastComboMax
  }

  setP1Input(partial: Partial<InputState>): void {
    this.p1Keys = { ...this.p1Keys, ...partial }
  }
  setP1Touch(partial: Partial<InputState>): void {
    this.p1Touch = { ...this.p1Touch, ...partial }
  }
  setP2Input(partial: Partial<InputState>): void {
    this.p2Keys = { ...this.p2Keys, ...partial }
  }
  setP2Touch(partial: Partial<InputState>): void {
    this.p2Touch = { ...this.p2Touch, ...partial }
  }

  applySnapshot(s: EngineSnapshot): void {
    this.frame = s.frame
    this.phase = s.phase
    this.introT = s.introT
    this.koT = s.koT
    this.round = s.round
    this.roundsToWin = s.roundsToWin
    this.winner = s.winner
    this.comboBanner = s.comboBanner
    this.comboCount = s.comboCount
    this.comboSide = s.comboSide
    applySnap(this.p1, s.p1)
    applySnap(this.p2, s.p2)
  }

  snapshot(): EngineSnapshot {
    return {
      frame: this.frame,
      phase: this.phase,
      introT: this.introT,
      koT: this.koT,
      round: this.round,
      roundsToWin: this.roundsToWin,
      winner: this.winner,
      p1: toSnap(this.p1),
      p2: toSnap(this.p2),
      comboBanner: this.comboBanner,
      comboCount: this.comboCount,
      comboSide: this.comboSide,
    }
  }

  setPaused(p: boolean): void {
    this.paused = p
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    const loop = (t: number) => {
      if (!this.running) return
      const dt = Math.min(48, t - this.last)
      this.last = t
      if (!this.paused && this.p2Mode !== 'remote-guest') {
        this.acc += dt
        while (this.acc >= this.stepMs) {
          this.tick()
          this.acc -= this.stepMs
        }
      }
      this.draw()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  startGuestRender(): void {
    this.p2Mode = 'remote-guest'
    this.start()
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  destroy(): void {
    this.stop()
  }

  private merged(a: InputState, b: InputState): InputState {
    return {
      left: a.left || b.left,
      right: a.right || b.right,
      up: a.up || b.up,
      down: a.down || b.down,
      punch: a.punch || b.punch,
      kick: a.kick || b.kick,
      block: a.block || b.block,
      special: a.special || b.special,
    }
  }

  private tick(): void {
    this.frame++
    if (this.shake > 0) this.shake *= 0.82
    if (this.comboBanner > 0) this.comboBanner--
    if (this.finishFlash > 0) this.finishFlash--
    if (this.bgPulse > 0) this.bgPulse--
    this.tickParticles()
    this.tickFloaters()

    if (this.hitstop > 0) {
      this.hitstop--
      return
    }

    if (this.phase === 'intro') {
      this.introT--
      if (this.introT === 34) sfx.fight()
      if (this.introT <= 0) this.phase = 'fight'
      this.face()
      return
    }
    if (this.phase === 'finish') {
      this.koT--
      if (this.koT <= 0) {
        this.phase = 'ko'
        this.koT = 55
      }
      return
    }
    if (this.phase === 'ko' || this.phase === 'round_end') {
      this.koT--
      if (this.koT <= 0) this.afterKo()
      return
    }
    if (this.phase === 'match_end') return

    // low HP finish him vibe
    if (
      (this.p1.hp > 0 && this.p1.hp / this.p1.maxHp < 0.15) ||
      (this.p2.hp > 0 && this.p2.hp / this.p2.maxHp < 0.15)
    ) {
      if (this.frame % 40 === 0) this.bgPulse = 12
    }

    const raw1 = this.merged(this.p1Keys, this.p1Touch)
    const raw2 =
      this.p2Mode === 'cpu'
        ? thinkCpu(this.p2, this.p1, this.frame, this.difficulty)
        : this.merged(this.p2Keys, this.p2Touch)

    const e1 = edgesFrom(raw1, this.prevI1)
    const e2 = edgesFrom(raw2, this.prevI2)
    this.prevI1 = { ...raw1 }
    this.prevI2 = { ...raw2 }

    this.p1Motion.push(this.p1.facing, raw1.left, raw1.right, raw1.up, raw1.down, this.frame)
    this.p2Motion.push(this.p2.facing, raw2.left, raw2.right, raw2.up, raw2.down, this.frame)
    this.simFighter(this.p1, raw1, e1, this.p2, this.p1Motion, 'p1')
    this.simFighter(this.p2, raw2, e2, this.p1, this.p2Motion, 'p2')
    this.resolveHits()
    this.face()
    this.clamp()
  }

  private afterKo(): void {
    if (!this.winner) {
      this.phase = 'fight'
      return
    }
    const w = this.winner === 'p1' ? this.p1 : this.p2
    if (w.roundsWon >= this.roundsToWin) {
      this.phase = 'match_end'
      this.burst(CANVAS_W / 2, GROUND - 40, 40, '#fbbf24', 'star')
      sfx.win()
      this.hooks.onMatchEnd?.(this.winner)
      return
    }
    this.round++
    this.resetRoundPositions()
    this.phase = 'intro'
    this.introT = 55
    this.winner = null
    this.comboCount = 0
  }

  private resetRoundPositions(): void {
    for (const p of [this.p1, this.p2]) {
      p.hp = p.maxHp
      p.meter = Math.min(100, p.meter + 20)
      p.dead = false
      p.hitstun = 0
      p.attackKind = null
      p.attackFrame = 0
      p.activeMove = null
      p.jump = false
      p.jv = 0
      p.crouch = false
      p.blocking = false
      p.combo = 0
      p.flash = 0
      p.invuln = 20
      p.lastMoveBanner = 0
    }
    this.p1Motion.clear()
    this.p2Motion.clear()
    this.p1.x = 200
    this.p1.y = GROUND
    this.p1.facing = 1
    this.p2.x = 760
    this.p2.y = GROUND
    this.p2.facing = -1
    this.particles = []
  }

  private face(): void {
    if (this.p1.x <= this.p2.x) {
      this.p1.facing = 1
      this.p2.facing = -1
    } else {
      this.p1.facing = -1
      this.p2.facing = 1
    }
  }

  private clamp(): void {
    for (const p of [this.p1, this.p2]) {
      p.x = Math.max(48, Math.min(CANVAS_W - 48, p.x))
      if (p.y >= GROUND) {
        p.y = GROUND
        p.jump = false
        p.jv = 0
      }
    }
  }

  private startMove(self: FighterState, move: MoveDef): void {
    const pow = self.powers || powersReady(self.fighter)
    // Trait-scaled move frames (startup / active / recovery)
    const frames = Math.max(
      8,
      Math.round(move.frames * ((pow.startupMult + pow.recoveryMult) / 2)),
    )
    const scaled: MoveDef = {
      ...move,
      frames,
      activeStart: Math.max(1, Math.round(move.activeStart * pow.startupMult)),
      activeEnd: Math.max(
        2,
        Math.round(move.activeEnd * pow.activeMult * pow.startupMult),
      ),
      reach: Math.round(move.reach * pow.reachMult),
      meterCost: Math.max(0, Math.round(move.meterCost * pow.meterCostMult)),
      meterGain: Math.round(move.meterGain * pow.meterGainMult),
      knockback: move.knockback * pow.knockbackMult,
      hitstun: Math.round(move.hitstun * pow.hitstunMult),
      colorHint: move.colorHint || pow.vfxTint || undefined,
    }
    self.attackKind = scaled.slot
    self.activeMove = scaled
    self.attackFrame = 0
    // Recovery after animation — clear punish window (Nintendo readability)
    self.attackCd = Math.max(8, Math.floor(scaled.frames * 0.45 * pow.recoveryMult) + 4)
    self.meter = Math.max(0, self.meter - scaled.meterCost)
    self.hitOnce = false
    self.flash = scaled.secret ? 12 : scaled.slot === 'special' || scaled.slot === 'super' ? 8 : 3
    self.lastMoveName = scaled.name
    self.lastMoveBanner =
      scaled.secret || scaled.slot === 'super' || scaled.slot === 'special' ? 48 : 22
    const burstN = move.secret ? 16 : move.slot === 'super' ? 12 : 7
    this.burst(
      self.x,
      self.y - 30,
      burstN,
      move.colorHint || self.fighter.color,
      move.secret ? 'star' : 'ring',
    )
    if (move.secret || move.slot === 'super') {
      this.shake = Math.max(this.shake, 4)
      this.bgPulse = 10
      this.hitstop = Math.max(this.hitstop, 6)
      vibrate([10, 20, 10])
      sfx.special()
    } else if (move.slot === 'special') {
      this.hitstop = Math.max(this.hitstop, 3)
      vibrate(12)
      sfx.special()
    }
  }

  private simFighter(
    self: FighterState,
    input: InputState,
    edge: EdgeFlags,
    foe: FighterState,
    motion: MotionBuffer,
    side: Side,
  ): void {
    if (self.dead) return
    if (self.flash > 0) self.flash--
    if (self.invuln > 0) self.invuln--
    if (self.lastMoveBanner > 0) self.lastMoveBanner--

    // Buffer attack presses during recovery / hitstun (Nintendo-forgiving)
    const bufSlot = side === 'p1' ? 'buf1' : 'buf2'
    if (edge.punch) this[bufSlot] = { slot: 'punch', t: this.frame }
    else if (edge.kick) this[bufSlot] = { slot: 'kick', t: this.frame }
    else if (edge.special) {
      this[bufSlot] = {
        slot: input.left || input.right ? 'dash' : 'special',
        t: this.frame,
      }
    }
    const buf = this[bufSlot]
    const bufFresh =
      buf && this.frame - buf.t <= INPUT_BUFFER_FRAMES ? buf.slot : null
    if (buf && this.frame - buf.t > INPUT_BUFFER_FRAMES) this[bufSlot] = null

    if (self.hitstun > 0) {
      self.hitstun--
      if (self.jump) {
        self.jv += GRAVITY
        self.y += self.jv
      }
      self.attackKind = null
      self.activeMove = null
      // Clear combo drop when hitstun ends
      if (self.hitstun === 0) {
        self.combo = 0
        self.invuln = Math.max(self.invuln, 6)
      }
      return
    }

    if (self.attackCd > 0) self.attackCd--
    if (self.attackKind) {
      self.attackFrame++
      const max =
        self.activeMove?.frames ??
        (self.attackKind === 'special' ||
        self.attackKind === 'secret' ||
        self.attackKind === 'super'
          ? 28
          : self.attackKind === 'dash'
            ? 12
            : self.attackKind === 'kick'
              ? 16
              : 12)
      if (self.attackFrame > max) {
        self.attackKind = null
        self.activeMove = null
        self.attackFrame = 0
        self.hitOnce = false
        // Recovery gap — readable punish window
        self.attackCd = Math.max(self.attackCd, 6)
      }
    }

    self.blocking = input.block && !self.jump && !self.attackKind
    self.crouch = input.down && !self.jump && !self.attackKind

    // Trait status tick (burn/poison/void/etc.)
    if (self.status && self.status.ticks > 0 && !self.dead) {
      if (this.frame % 18 === 0) {
        const dot = Math.max(1, self.status.power)
        self.hp = Math.max(1, self.hp - dot)
        this.float(self.x, self.y - 55, self.status.kind.toUpperCase(), '#f97316')
        self.status.ticks--
        if (self.status.ticks <= 0) self.status = null
      }
    }

    // Walk: slower while crouching; block walk reduced · trait walkMult / speed
    const pow = self.powers || powersReady(self.fighter)
    const speed =
      WALK *
      (0.88 + self.fighter.stats.speed / 42) *
      pow.walkMult *
      (self.crouch ? 0.55 : 1)
    if (!self.attackKind && !self.blocking) {
      if (input.left) self.x -= speed
      if (input.right) self.x += speed
    } else if (self.blocking) {
      if (input.left) self.x -= speed * 0.28
      if (input.right) self.x += speed * 0.28
    }

    if (self.attackKind === 'dash' && self.attackFrame < 8) {
      self.x += self.facing * DASH * pow.walkMult
    }
    if (
      (self.attackKind === 'secret' || self.attackKind === 'super') &&
      self.attackFrame < 6
    ) {
      self.x += self.facing * 0.9
    }

    // Jump only on edge (hold does not re-jump midair spam)
    if (edge.up && !self.jump && !self.crouch && !self.attackKind) {
      self.jump = true
      self.y = GROUND - 0.1
      self.jv = JUMP_V * (self.powers?.jumpMult ?? 1)
    }
    if (self.jump) {
      self.jv += GRAVITY
      self.y += self.jv
      if (self.y >= GROUND) {
        self.y = GROUND
        self.jump = false
        self.jv = 0
        this.burst(self.x, GROUND, 4, '#94a3b8', 'dust')
        self.attackCd = Math.max(self.attackCd, 3)
      }
    }

    // Attacks: edge or buffered intent only — no hold-spam
    if (!self.attackKind && self.attackCd <= 0) {
      const kit = fighterMoves(self.fighter)
      const qcf = motion.matchQcf(this.frame)
      const qcb = motion.matchQcb(this.frame)
      const dp = motion.matchDp(this.frame)
      const circ = motion.matchCircle(this.frame)
      const chg = motion.matchChargeBf(this.frame)

      const wantPunch = edge.punch || bufFresh === 'punch'
      const wantKick = edge.kick || bufFresh === 'kick'
      const wantSpecial = edge.special || bufFresh === 'special'
      const wantDash =
        bufFresh === 'dash' ||
        (edge.special && (input.left || input.right) && self.meter >= 20)

      const secretMotionOk =
        (kit.secret.motion === 'qcf' && qcf) ||
        (kit.secret.motion === 'dp' && dp) ||
        (kit.secret.motion === 'full_circle' && circ) ||
        (kit.secret.motion === 'charge_b_f' && chg) ||
        (kit.secret.motion === 'qcb' && qcb) ||
        qcf

      let fired = false
      // SECRET: full meter — motion OR plain SP at 100 (forgiving for mobile)
      if (
        self.meter >= 100 &&
        (wantPunch || wantSpecial) &&
        (secretMotionOk || wantSpecial)
      ) {
        this.startMove(self, kit.secret)
        motion.clear()
        fired = true
      } else if (self.meter >= 75 && wantKick && (qcb || (input.down && secretMotionOk))) {
        this.startMove(self, kit.super)
        motion.clear()
        fired = true
      }
      if (!fired && wantSpecial && self.meter >= 50) {
        this.startMove(self, kit.special)
        motion.clear()
        fired = true
      } else if (!fired && wantDash && self.meter >= 20) {
        this.startMove(self, kit.dash)
        fired = true
      } else if (!fired && wantKick) {
        this.startMove(self, kit.kick)
        fired = true
      } else if (!fired && wantPunch) {
        this.startMove(self, kit.punch)
        fired = true
      }
      if (fired) this[bufSlot] = null
    }

    // Slow meter regen — specials feel earned
    if (this.frame % 36 === 0) {
      const regen = 2 + (self.powers?.meterRegenBonus ?? 0)
      self.meter = Math.min(100, self.meter + regen)
    }

    // Soft body push — no sticky clash
    const dx = foe.x - self.x
    if (Math.abs(dx) < 30 && Math.abs(self.y - foe.y) < 40) {
      const push = dx === 0 ? self.facing * 1.6 : Math.sign(dx) * 1.1
      self.x -= push
      foe.x += push
    }
  }

  private resolveHits(): void {
    this.tryHit(this.p1, this.p2)
    this.tryHit(this.p2, this.p1)
  }

  private tryHit(atk: FighterState, def: FighterState): void {
    if (!atk.attackKind || atk.dead || def.dead || def.invuln > 0) return
    const mv = atk.activeMove
    const active = mv
      ? atk.attackFrame >= mv.activeStart && atk.attackFrame <= mv.activeEnd
      : atk.attackKind === 'punch'
        ? atk.attackFrame >= 2 && atk.attackFrame <= 5
        : atk.attackKind === 'kick'
          ? atk.attackFrame >= 3 && atk.attackFrame <= 9
          : atk.attackKind === 'dash'
            ? atk.attackFrame >= 2 && atk.attackFrame <= 8
            : atk.attackFrame >= 5 && atk.attackFrame <= 16
    if (!active || atk.hitOnce) return

    const reach =
      mv?.reach ??
      (atk.attackKind === 'secret'
        ? 150
        : atk.attackKind === 'super'
          ? 130
          : atk.attackKind === 'special'
            ? 110
            : atk.attackKind === 'dash'
              ? 80
              : atk.attackKind === 'kick'
                ? 84
                : 64)
    const hx = atk.x + atk.facing * reach * 0.55
    const hy = atk.y - (atk.crouch ? 28 : 56)
    const dx = Math.abs(def.x - hx)
    const dy = Math.abs(def.y - 48 - hy)
    if (dx > reach * 0.55 || dy > 64) return

    // Combo cap — no endless mash strings
    if (def.combo >= MAX_COMBO && !def.blocking) {
      atk.hitOnce = true
      atk.attackFrame = (mv?.frames ?? 12) + 1
      return
    }

    atk.hitOnce = true
    const ap = atk.powers || powersReady(atk.fighter)
    const dp = def.powers || powersReady(def.fighter)
    const mult = mv?.damageMult ?? 1
    const isSpecial =
      atk.attackKind === 'secret' ||
      atk.attackKind === 'super' ||
      atk.attackKind === 'special'
    const base =
      isSpecial
        ? atk.fighter.stats.special * mult * 0.85 * ap.specialDamageMult
        : atk.fighter.stats.atk * mult * ap.damageMult
    const elBonus = elementMatchup(
      ap.element || atk.fighter.identity?.element,
      dp.element || def.fighter.identity?.element,
    )
    // Armor pen from traits ignores portion of DEF
    const effDef = def.fighter.stats.def * (1 - ap.armorPen) * dp.multDef
    let dmg = Math.max(
      3,
      Math.floor((base * elBonus - effDef * 0.28) * DMG_SCALE),
    )
    // Crit
    let didCrit = false
    if (Math.random() < ap.critChance) {
      dmg = Math.max(3, Math.floor(dmg * ap.critMult))
      didCrit = true
    }
    // First hit of a string
    if (def.combo === 0) {
      dmg = Math.max(3, Math.floor(dmg * (1 + ap.firstHitBonus)))
      atk.openedCombo = true
    }
    // HP threshold amps
    const atkHpRatio = atk.hp / Math.max(1, atk.maxHp)
    if (atkHpRatio < 0.3 && ap.lowHpAmp > 0) {
      dmg = Math.max(3, Math.floor(dmg * (1 + ap.lowHpAmp)))
    }
    if (atkHpRatio > 0.7 && ap.highHpAmp > 0) {
      dmg = Math.max(3, Math.floor(dmg * (1 + ap.highHpAmp)))
    }
    // Combo decay — trait resist softens falloff
    if (def.combo > 0) {
      const decay = Math.min(0.62, def.combo * 0.14 * (1 - ap.comboDecayResist))
      dmg = Math.max(2, Math.floor(dmg * (1 - decay)))
    }

    if (this.p2Mode === 'cpu') {
      const d = this.difficulty
      if (atk === this.p2) dmg = Math.max(1, Math.floor(dmg * d.dmgOut))
      if (def === this.p2) dmg = Math.max(1, Math.floor(dmg * d.dmgIn))
    }

    const blocked = def.blocking
    const isHeavy = isSpecial
    if (blocked) {
      const blockBase = atk.attackKind === 'secret' ? 0.22 : 0.12
      dmg = Math.max(
        1,
        Math.floor(dmg * blockBase * dp.blockDmgMult),
      )
      // Chip from attacker traits
      if (ap.chipDamage > 0) {
        dmg = Math.max(1, Math.floor(dmg + base * ap.chipDamage * 0.15))
      }
      def.meter = Math.min(100, def.meter + 10 * dp.meterGainMult)
      this.burst(def.x - def.facing * 10, def.y - 28, 5, '#e2e8f0', 'spark')
      this.float(def.x, def.y - 40, 'BLOCK', '#94a3b8')
      this.hitstop = 5
      this.shake = Math.max(this.shake, 1.2)
      sfx.block()
    } else {
      const hs = Math.min(
        20,
        Math.round(
          (mv?.hitstun ?? (isHeavy ? 14 : atk.attackKind === 'kick' ? 10 : 7)) *
            ap.hitstunMult *
            (1 - dp.hitstunResist),
        ),
      )
      def.hitstun = Math.max(4, hs)
      const kb = Math.min(
        18,
        (mv?.knockback ?? (isHeavy ? 9 : 5)) * ap.knockbackMult,
      )
      def.x += atk.facing * kb
      if ((mv?.launch || (isHeavy && atk.attackKind === 'secret')) && def.y >= GROUND - 1) {
        def.jump = true
        def.jv = (atk.attackKind === 'secret' ? -6.5 : -4.2) * ap.jumpMult
      }
      const mGain = Math.min(18, (mv?.meterGain ?? 8) * ap.meterGainMult)
      atk.meter = Math.min(100, atk.meter + mGain)
      // Life steal
      if (ap.lifeSteal > 0) {
        const heal = Math.max(1, Math.floor(dmg * ap.lifeSteal))
        atk.hp = Math.min(atk.maxHp, atk.hp + heal)
        this.float(atk.x, atk.y - 60, `+${heal}`, '#34d399')
      }
      // Status apply from attacker traits
      if (ap.status && Math.random() < ap.status.chance) {
        def.status = {
          kind: ap.status.kind,
          ticks: 5 + ap.status.power,
          power: ap.status.power,
        }
        this.float(def.x, def.y - 72, ap.status.kind.toUpperCase(), ap.vfxTint || '#f97316')
      }
      def.combo += 1
      atk.combo = def.combo
      this.lastComboMax = Math.max(this.lastComboMax, def.combo)
      this.comboCount = def.combo
      this.comboSide = atk === this.p1 ? 'p1' : 'p2'
      this.comboBanner = 40
      this.hooks.onCombo?.(this.comboSide, def.combo)
      if (didCrit) this.float(def.x, def.y - 88, 'CRIT!', '#fbbf24')
      if (atk.attackKind === 'secret') {
        sfx.special()
        this.float(def.x, def.y - 70, 'SECRET!', mv?.colorHint || ap.vfxTint || '#fbbf24')
      } else if (atk.attackKind === 'super') {
        sfx.special()
        this.float(def.x, def.y - 70, 'SUPER!', mv?.colorHint || ap.vfxTint || '#a78bfa')
      } else if (atk.attackKind === 'special') sfx.special()
      else if (def.combo >= 3) sfx.combo(def.combo)
      else if (atk.attackKind === 'kick') sfx.heavy()
      else sfx.hit()
      this.burst(
        def.x,
        def.y - 30,
        atk.attackKind === 'secret' ? 18 : isHeavy ? 12 : 7,
        mv?.colorHint || ap.vfxTint || atk.fighter.color,
        isHeavy ? 'star' : 'spark',
      )
      this.float(
        def.x,
        def.y - 48,
        def.combo > 1 ? `${def.combo} HIT` : `-${dmg}`,
        def.combo > 3 ? '#fbbf24' : '#f472b6',
      )
      this.hitstop =
        atk.attackKind === 'secret' ? 10 : isHeavy ? 7 : 5
      this.shake =
        atk.attackKind === 'secret' ? 5 : isHeavy ? 3 : 1.5
      def.flash = 5
      vibrate(def.combo > 3 ? [8, 14, 8] : 8)
    }

    def.hp = Math.max(0, def.hp - dmg)
    this.hooks.onHit?.(def === this.p1 ? 'p1' : 'p2', dmg, def.combo)

    if (def.hp <= 0) {
      def.dead = true
      def.hp = 0
      def.combo = 0
      const winSide: Side = atk === this.p1 ? 'p1' : 'p2'
      this.winner = winSide
      if (winSide === 'p1') this.p1.roundsWon++
      else this.p2.roundsWon++
      this.burst(def.x, def.y - 20, 28, '#fbbf24', 'star')
      this.shake = 10
      this.finishFlash = 24
      this.phase = 'finish'
      this.koT = 36
      this.float(CANVAS_W / 2, 90, 'K.O.!', '#f472b6')
      vibrate([30, 40, 30])
      sfx.ko()
      this.hooks.onRoundEnd?.(winSide, this.p1.roundsWon, this.p2.roundsWon)
    }
  }

  /** World-class VFX burst via 10 designers (element-aware). */
  private fx(
    method: 'hit' | 'heavy' | 'special' | 'secret' | 'block' | 'ko' | 'dash' | 'land',
    x: number,
    y: number,
    color: string,
    color2?: string,
    facing: 1 | -1 = 1,
    element?: string,
    power = 1,
  ): void {
    const designers = designersByElement(element)
    const opts = { x, y, color, color2, facing, element, power }
    if (method === 'dash' || method === 'land') {
      for (const d of designers) {
        const fn = d[method]
        if (fn) this.particles.push(...fn(opts))
      }
    } else {
      this.particles.push(...mergeBursts(designers, method, opts))
    }
    if (this.particles.length > 220) {
      this.particles.splice(0, this.particles.length - 220)
    }
  }

  private burst(
    x: number,
    y: number,
    n: number,
    color: string,
    kind: VfxParticle['kind'],
  ): void {
    // Legacy helper → impact designers
    const power = Math.min(2, n / 12)
    const method =
      kind === 'star' ? 'heavy' : kind === 'ring' ? 'special' : kind === 'dust' ? 'land' : 'hit'
    this.fx(method as 'hit' | 'heavy' | 'special' | 'land', x, y, color, undefined, 1, undefined, power)
  }

  private float(x: number, y: number, text: string, color: string): void {
    this.floaters.push({
      x,
      y,
      text,
      life: 48,
      color,
      vy: -1.05,
      scale: text.includes('SECRET') || text.includes('K.O') ? 1.35 : 1,
    })
    if (this.floaters.length > 20) this.floaters.shift()
  }

  private tickParticles(): void {
    this.particles = tickVfx(this.particles)
    for (const a of this.afterimages) a.life--
    this.afterimages = this.afterimages.filter((a) => a.life > 0)
  }

  private tickFloaters(): void {
    for (const f of this.floaters) {
      f.y += f.vy
      f.life--
    }
    this.floaters = this.floaters.filter((f) => f.life > 0)
  }

  private draw(): void {
    const ctx = this.ctx
    // Keep true-2D DPR transform + HD filters every frame
    restoreTrue2dTransform(ctx, this.dpr)
    applyHighQuality(ctx)
    clearTrue2d(ctx, CANVAS_W, CANVAS_H, '#050508')

    const sx = this.shake > 0.3 ? (Math.random() - 0.5) * this.shake : 0
    const sy = this.shake > 0.3 ? (Math.random() - 0.5) * this.shake : 0
    ctx.save()
    ctx.translate(sx, sy)

    drawStageTrue2d(
      ctx,
      this.frame,
      this.bgPulse,
      this.finishFlash,
      this.stageId,
      CANVAS_W,
      CANVAS_H,
    )
    // Soft color afterimages (engine trail) under full body ghosts drawn by fighter renderer
    for (const a of this.afterimages) {
      const t = a.life / 10
      ctx.globalAlpha = t * 0.22
      ctx.fillStyle = a.color
      ctx.beginPath()
      ctx.ellipse(a.x, a.y - 40, 22, 42, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    drawFighter(ctx, this.p1, this.frame)
    drawFighter(ctx, this.p2, this.frame)
    drawVfx(ctx, this.particles)
    this.drawFloaters(ctx)
    if (this.phase === 'ko' || this.phase === 'match_end' || this.phase === 'finish') {
      drawKoBurst(ctx, this.frame, this.koT)
    }
    drawHud(ctx, this)
    ctx.restore()
  }

  private drawFloaters(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center'
    for (const f of this.floaters) {
      const t = Math.min(1, f.life / 14)
      const sc = (f.scale || 1) * (0.9 + t * 0.2)
      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.scale(sc, sc)
      ctx.globalAlpha = t
      ctx.font = 'bold 22px system-ui,Segoe UI,sans-serif'
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillText(f.text, 2, 2)
      ctx.fillStyle = f.color
      ctx.shadowColor = f.color
      ctx.shadowBlur = 12
      ctx.fillText(f.text, 0, 0)
      ctx.restore()
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }
}

/** Fire > nature > ice > fire; void strong vs gods; same element slight resist */
function elementMatchup(atkEl?: string, defEl?: string): number {
  const a = (atkEl || '').toLowerCase()
  const d = (defEl || '').toLowerCase()
  if (!a || !d) return 1
  if (a === d || (a && d && a.includes(d.slice(0, 3)))) return 0.92
  if (/fire|ember|flame/.test(a) && /nature|earth|grove|jade|wood/.test(d)) return 1.18
  if (/nature|earth|grove|jade/.test(a) && /ice|water|frost/.test(d)) return 1.15
  if (/ice|water|frost/.test(a) && /fire|ember|flame/.test(d)) return 1.15
  if (/void|shadow|dark|null/.test(a) && /holy|divine|light|gold/.test(d)) return 1.2
  if (/holy|divine|light/.test(a) && /void|shadow|dark/.test(d)) return 1.15
  if (/electric|volt|cyber|storm/.test(a) && /water|ice/.test(d)) return 1.12
  return 1
}

type EdgeFlags = {
  punch: boolean
  kick: boolean
  special: boolean
  up: boolean
}

function edgesFrom(cur: InputState, prev: InputState): EdgeFlags {
  return {
    punch: cur.punch && !prev.punch,
    kick: cur.kick && !prev.kick,
    special: cur.special && !prev.special,
    up: cur.up && !prev.up,
  }
}

function makeState(f: Fighter, x: number, facing: 1 | -1): FighterState {
  // ensure moveset + trait powers attached for combat
  let fighter = f.moveset ? f : { ...f, moveset: fighterMoves(f) }
  fighter = withCombatPowers(fighter)
  const powers = powersReady(fighter)
  const maxHp = Math.max(80, Math.round(fighter.stats.hp * HP_SCALE))
  return {
    fighter,
    x,
    y: GROUND,
    facing,
    hp: maxHp,
    maxHp,
    meter: powers.meterStart,
    crouch: false,
    blocking: false,
    jump: false,
    jv: 0,
    attackCd: 0,
    hitstun: 0,
    attackKind: null,
    attackFrame: 0,
    hitOnce: false,
    dead: false,
    roundsWon: 0,
    combo: 0,
    flash: 0,
    invuln: 0,
    activeMove: null,
    lastMoveName: '',
    lastMoveBanner: 0,
    powers,
    status: null,
    openedCombo: false,
  }
}

function toSnap(p: FighterState): SnapFighter {
  return {
    id: p.fighter.id,
    name: p.fighter.name,
    color: p.fighter.color,
    color2: p.fighter.color2,
    image: p.fighter.image,
    x: p.x,
    y: p.y,
    facing: p.facing,
    hp: p.hp,
    maxHp: p.maxHp,
    meter: p.meter,
    crouch: p.crouch,
    blocking: p.blocking,
    jump: p.jump,
    attackKind: p.attackKind,
    hitstun: p.hitstun,
    dead: p.dead,
    roundsWon: p.roundsWon,
    combo: p.combo,
    flash: p.flash,
  }
}

function applySnap(p: FighterState, s: SnapFighter): void {
  p.x = s.x
  p.y = s.y
  p.facing = s.facing
  p.hp = s.hp
  p.maxHp = s.maxHp
  p.meter = s.meter
  p.crouch = s.crouch
  p.blocking = s.blocking
  p.jump = s.jump
  p.attackKind = s.attackKind
  p.hitstun = s.hitstun
  p.dead = s.dead
  p.roundsWon = s.roundsWon
  p.combo = s.combo
  p.flash = s.flash
  p.fighter = {
    ...p.fighter,
    id: s.id,
    name: s.name,
    color: s.color,
    color2: s.color2,
    image: s.image || p.fighter.image,
  }
  if (p.fighter.image) void loadNftSprite(p.fighter.image)
}

function thinkCpu(
  self: FighterState,
  foe: FighterState,
  frame: number,
  diff: DifficultyProfile,
): InputState {
  const i = emptyInput()
  if (self.dead || self.hitstun > 0) return i
  // Easy: skip turns so CPU feels sluggish
  if (diff.reactionFrames > 0 && frame % (diff.reactionFrames + 1) !== 0) {
    // Still walk slowly toward player so the fight moves
    const dx0 = foe.x - self.x
    if (Math.abs(dx0) > 80 && Math.random() < 0.4) {
      if (dx0 > 0) i.right = true
      else i.left = true
    }
    return i
  }
  const dx = foe.x - self.x
  const dist = Math.abs(dx)
  if (dist > 48) {
    if (dx > 0) i.right = true
    else i.left = true
  } else if (dist < 26) {
    if (dx > 0) i.left = true
    else i.right = true
  }
  if (foe.attackKind && dist < 60 && Math.random() < diff.blockChance) i.block = true
  // Specials / supers — rarer on Easy
  if (self.meter >= 100 && dist < 70 && frame % 55 < 8 && Math.random() < diff.specialChance * 4) {
    i.down = true
    if (frame % 55 > 3) {
      i.down = false
      if (dx > 0) i.right = true
      else i.left = true
      i.punch = true
    }
  } else if (self.meter >= 75 && dist < 60 && frame % 80 < 6 && Math.random() < diff.specialChance * 3) {
    i.down = true
    if (frame % 80 > 2) {
      if (dx > 0) i.left = true
      else i.right = true
      i.kick = true
    }
  } else if (dist < 48 && !i.block) {
    if (self.meter >= 50 && Math.random() < diff.specialChance) i.special = true
    else if (Math.random() < diff.attackChance) i.kick = true
    else if (Math.random() < diff.attackChance * 1.2) i.punch = true
    else if (self.meter >= 20 && dist > 30 && Math.random() < diff.specialChance * 0.5) {
      i.special = true
      if (dx > 0) i.right = true
      else i.left = true
    }
  }
  if (frame % 90 === 0 && Math.random() < diff.jumpChance) i.up = true
  if (Math.random() < 0.02) i.down = true
  return i
}

function drawStage(
  ctx: CanvasRenderingContext2D,
  frame: number,
  pulse: number,
  finish: number,
  stageId: StageId = 'neon-city',
): void {
  const painted = getStageImage(stageId)
  if (painted && painted.complete && painted.naturalWidth > 0) {
    // Full-bleed painted AAA stage (cover crop to 16:9 canvas)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    const iw = painted.naturalWidth
    const ih = painted.naturalHeight
    const scale = Math.max(CANVAS_W / iw, CANVAS_H / ih)
    const dw = iw * scale
    const dh = ih * scale
    // subtle parallax drift on sky/stage
    const px = Math.sin(frame * 0.004) * 10
    const py = Math.cos(frame * 0.003) * 4
    ctx.drawImage(painted, (CANVAS_W - dw) / 2 + px, (CANVAS_H - dh) / 2 + py - 8, dw, dh)

    // Darken upper HUD band slightly for readability
    const topShade = ctx.createLinearGradient(0, 0, 0, 130)
    topShade.addColorStop(0, 'rgba(0,0,0,0.45)')
    topShade.addColorStop(1, 'transparent')
    ctx.fillStyle = topShade
    ctx.fillRect(0, 0, CANVAS_W, 130)

    // Fight-plane lift near ground so fighters read
    const floorLift = ctx.createLinearGradient(0, GROUND - 40, 0, GROUND + 20)
    floorLift.addColorStop(0, 'transparent')
    floorLift.addColorStop(0.55, 'rgba(8,4,18,0.25)')
    floorLift.addColorStop(1, 'rgba(8,4,18,0.55)')
    ctx.fillStyle = floorLift
    ctx.fillRect(0, GROUND - 40, CANVAS_W, CANVAS_H - (GROUND - 40))

    // Neon ground contact line
    ctx.fillStyle = finish > 0 ? 'rgba(244,114,182,0.85)' : pulse > 0 ? 'rgba(167,139,250,0.9)' : 'rgba(139,92,246,0.75)'
    ctx.shadowColor = '#a78bfa'
    ctx.shadowBlur = 16
    ctx.fillRect(0, GROUND, CANVAS_W, 3)
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(34,211,238,0.35)'
    ctx.fillRect(0, GROUND + 3, CANVAS_W, 1)

    // Soft floor reflection band
    ctx.fillStyle = 'rgba(139,92,246,0.08)'
    ctx.fillRect(0, GROUND + 4, CANVAS_W, 48)

    // Pulse / finish color grade
    if (finish > 0) {
      ctx.fillStyle = `rgba(190,24,93,${Math.min(0.35, finish / 90)})`
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    } else if (pulse > 0) {
      ctx.fillStyle = `rgba(109,40,217,${Math.min(0.18, pulse / 40)})`
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    }

    // Cinematic vignette
    const vig = ctx.createRadialGradient(
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_H * 0.2,
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_W * 0.72,
    )
    vig.addColorStop(0, 'transparent')
    vig.addColorStop(1, 'rgba(0,0,0,0.5)')
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    return
  }

  // Fallback procedural stage if art not loaded yet
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  g.addColorStop(0, finish > 0 ? '#3b0a2e' : pulse > 0 ? '#1a0a40' : '#0a0618')
  g.addColorStop(0.4, '#14082e')
  g.addColorStop(0.75, '#0e0620')
  g.addColorStop(1, '#080410')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  const haze = ctx.createRadialGradient(CANVAS_W * 0.5, GROUND - 80, 40, CANVAS_W * 0.5, GROUND, 420)
  haze.addColorStop(0, 'rgba(139,92,246,0.12)')
  haze.addColorStop(1, 'transparent')
  ctx.fillStyle = haze
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.fillStyle = '#fde68a'
  ctx.beginPath()
  ctx.arc(780, 90, 36, 0, Math.PI * 2)
  ctx.fill()

  for (let i = 0; i < 14; i++) {
    const bx = ((i * 90 - frame * 0.55) % (CANVAS_W + 120)) - 60
    const bh = 100 + (i % 4) * 50
    ctx.fillStyle = i % 2 ? '#14122a' : '#1a1636'
    ctx.fillRect(bx, GROUND - bh, 72, bh)
  }

  const gg = ctx.createLinearGradient(0, GROUND, 0, CANVAS_H)
  gg.addColorStop(0, '#1a1230')
  gg.addColorStop(1, '#06040e')
  ctx.fillStyle = gg
  ctx.fillRect(0, GROUND + 1, CANVAS_W, CANVAS_H - GROUND)
  ctx.fillStyle = '#8b5cf6'
  ctx.fillRect(0, GROUND, CANVAS_W, 4)
}

/**
 * Street Fighter�standard draw path (Phase 1).
 * Articulated body + NFT face plate � not a floating portrait card.
 * @see docs/STREET_FIGHTER_GRAPHICS_PLAN.md
 */
function drawFighter(ctx: CanvasRenderingContext2D, p: FighterState, frame: number): void {
  // Prefer NFT metadata image as face/identity; fall back gracefully
  const image =
    p.fighter.image || p.fighter.originalImage || p.fighter.newImage || undefined
  const sprite = image ? getCachedSprite(image) : null
  if (image && !sprite) void loadNftSprite(image)
  drawFighterSf(ctx, p, frame, sprite)
}

/** Arena corner portrait — real NFT art next to HP plate. */
function drawCornerPortrait(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  x: number,
  y: number,
  left: boolean,
): void {
  const size = 52
  const image =
    fighter.image || fighter.originalImage || fighter.newImage || undefined
  const sprite = image ? getCachedSprite(image) : null
  if (image && !sprite) void loadNftSprite(image)

  ctx.save()
  // Solid plate (no gradient)
  ctx.fillStyle = '#0c0c14'
  ctx.strokeStyle = left ? '#22d3ee' : '#f472b6'
  ctx.lineWidth = 2
  ctx.beginPath()
  roundRectPath(ctx, x, y, size, size, 8)
  ctx.fill()
  ctx.stroke()

  if (sprite) {
    ctx.save()
    ctx.beginPath()
    roundRectPath(ctx, x + 2, y + 2, size - 4, size - 4, 6)
    ctx.clip()
    ctx.imageSmoothingEnabled = true
    try {
      ctx.imageSmoothingQuality = 'high'
    } catch {
      /* soft */
    }
    ctx.drawImage(sprite, x + 2, y + 2, size - 4, size - 4)
    ctx.restore()
  } else {
    // Solid color fallback from collection palette
    ctx.fillStyle = fighter.color || '#334155'
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = 'bold 16px system-ui,Segoe UI,sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText((fighter.name || '?').slice(0, 1).toUpperCase(), x + size / 2, y + size / 2)
  }
  ctx.restore()
}
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawKoBurst(ctx: CanvasRenderingContext2D, frame: number, koT: number): void {
  const img = getKoFx()
  if (!img || !img.complete) return
  const t = Math.min(1, (koT || 1) / 40)
  const scale = 0.55 + t * 0.9 + Math.sin(frame / 3) * 0.04
  const alpha = Math.max(0, 0.85 - t * 0.35)
  const size = 280 * scale
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // green-key soft: multiply + screen mix for punchy FX
  ctx.globalCompositeOperation = 'screen'
  ctx.drawImage(img, CANVAS_W / 2 - size / 2, CANVAS_H * 0.32 - size / 2, size, size)
  ctx.restore()
}

function drawHud(ctx: CanvasRenderingContext2D, eng: FightEngine): void {
  const p1 = eng.p1
  const p2 = eng.p2
  const W = CANVAS_W

  // cinematic bars when finish
  if (eng.finishFlash > 0) {
    ctx.fillStyle = `rgba(0,0,0,${0.25 + eng.finishFlash / 80})`
    ctx.fillRect(0, 0, W, 28)
    ctx.fillRect(0, CANVAS_H - 28, W, 28)
  }

  // Premium glass plates behind HP
  ctx.fillStyle = 'rgba(8,6,18,0.72)'
  ctx.strokeStyle = 'rgba(167,139,250,0.45)'
  ctx.lineWidth = 2
  roundRect(ctx, 22, 16, 360, 92, 10, true, true)
  roundRect(ctx, W - 382, 16, 360, 92, 10, true, true)

  // HP plates (arcade)
  barPlate(ctx, 36, 28, 332, 24, p1.hp / p1.maxHp, true)
  barPlate(ctx, W - 368, 28, 332, 24, p2.hp / p2.maxHp, false)
  // meter
  bar(ctx, 36, 60, 240, 12, p1.meter / 100, '#e879f9', '#3b0764')
  bar(ctx, W - 276, 60, 240, 12, p2.meter / 100, '#e879f9', '#3b0764')
  ctx.font = 'bold 11px system-ui,Segoe UI,sans-serif'
  if (p1.meter >= 100) {
    ctx.fillStyle = '#fbbf24'
    ctx.textAlign = 'left'
    ctx.shadowColor = '#f59e0b'
    ctx.shadowBlur = 10
    ctx.fillText('✦ SECRET READY · ↓↘→ + P', 36, 90)
    ctx.shadowBlur = 0
  } else if (p1.meter >= 75) {
    ctx.fillStyle = '#c4b5fd'
    ctx.textAlign = 'left'
    ctx.fillText('★ SUPER · ←↙↓ + K', 36, 90)
  } else if (p1.meter >= 50) {
    ctx.fillStyle = '#f0abfc'
    ctx.textAlign = 'left'
    ctx.shadowColor = '#e879f9'
    ctx.shadowBlur = 8
    ctx.fillText('SP READY', 36, 90)
    ctx.shadowBlur = 0
  }
  if (p2.meter >= 100) {
    ctx.fillStyle = '#fbbf24'
    ctx.textAlign = 'right'
    ctx.shadowColor = '#f59e0b'
    ctx.shadowBlur = 10
    ctx.fillText('P + ↓↘→ · SECRET READY ✦', W - 36, 90)
    ctx.shadowBlur = 0
  } else if (p2.meter >= 75) {
    ctx.fillStyle = '#c4b5fd'
    ctx.textAlign = 'right'
    ctx.fillText('K + ←↙↓ · SUPER ★', W - 36, 90)
  } else if (p2.meter >= 50) {
    ctx.fillStyle = '#f0abfc'
    ctx.textAlign = 'right'
    ctx.shadowColor = '#e879f9'
    ctx.shadowBlur = 8
    ctx.fillText('SP READY', W - 36, 90)
    ctx.shadowBlur = 0
  }

  for (let i = 0; i < eng.roundsToWin; i++) {
    ctx.shadowColor = '#fbbf24'
    ctx.shadowBlur = i < p1.roundsWon ? 10 : 0
    ctx.fillStyle = i < p1.roundsWon ? '#fbbf24' : '#1e293b'
    ctx.beginPath()
    ctx.arc(48 + i * 24, 112, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = i < p2.roundsWon ? 10 : 0
    ctx.fillStyle = i < p2.roundsWon ? '#fbbf24' : '#1e293b'
    ctx.beginPath()
    ctx.arc(W - 48 - i * 24, 112, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  // Corner NFT portraits (identity art) + names + Power Level
  drawCornerPortrait(ctx, p1.fighter, 28, 118, true)
  drawCornerPortrait(ctx, p2.fighter, W - 28 - 52, 118, false)

  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 15px system-ui,Segoe UI,sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(p1.fighter.name.slice(0, 22), 88, 140)
  const p1Pl =
    typeof p1.fighter.powerLevel === 'number'
      ? p1.fighter.powerLevel
      : Math.round(
          p1.fighter.stats.hp +
            p1.fighter.stats.atk * 3 +
            p1.fighter.stats.def * 2 +
            p1.fighter.stats.special,
        )
  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 12px system-ui,Segoe UI,sans-serif'
  ctx.fillText(`PL ${p1Pl}`, 88, 156)

  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 15px system-ui,Segoe UI,sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(p2.fighter.name.slice(0, 22), W - 88, 140)
  const p2Pl =
    typeof p2.fighter.powerLevel === 'number'
      ? p2.fighter.powerLevel
      : Math.round(
          p2.fighter.stats.hp +
            p2.fighter.stats.atk * 3 +
            p2.fighter.stats.def * 2 +
            p2.fighter.stats.special,
        )
  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 12px system-ui,Segoe UI,sans-serif'
  ctx.fillText(`PL ${p2Pl}`, W - 88, 156)

  // Center round badge
  ctx.fillStyle = 'rgba(9,9,11,0.75)'
  ctx.strokeStyle = 'rgba(196,181,253,0.55)'
  ctx.lineWidth = 2
  roundRect(ctx, W / 2 - 64, 18, 128, 36, 8, true, true)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#e9d5ff'
  ctx.font = 'bold 16px system-ui,Segoe UI,sans-serif'
  ctx.fillText(`ROUND ${eng.round}`, W / 2, 42)

  if (eng.comboBanner > 0 && eng.comboCount >= 2) {
    const pulse = 1 + Math.sin(eng.frame / 4) * 0.08
    ctx.save()
    ctx.translate(W / 2, 160)
    ctx.scale(pulse, pulse)
    ctx.fillStyle = 'rgba(0,0,0,.6)'
    ctx.fillRect(-90, -20, 180, 40)
    ctx.fillStyle = eng.comboCount >= 5 ? '#fbbf24' : '#f472b6'
    ctx.font = 'bold 22px monospace'
    ctx.fillText(`${eng.comboCount} HIT COMBO!`, 0, 8)
    ctx.restore()
  }

  if (eng.phase === 'intro') {
    ctx.fillStyle = 'rgba(0,0,0,.58)'
    roundRect(ctx, W / 2 - 200, 228, 400, 88, 12, true, false)
    ctx.strokeStyle = 'rgba(251,191,36,0.55)'
    ctx.lineWidth = 2
    roundRect(ctx, W / 2 - 200, 228, 400, 88, 12, false, true)
    ctx.fillStyle = '#fbbf24'
    ctx.font = 'bold 44px system-ui,Segoe UI,sans-serif'
    ctx.textAlign = 'center'
    ctx.shadowColor = '#f59e0b'
    ctx.shadowBlur = 16
    ctx.fillText(eng.introT > 35 ? `ROUND ${eng.round}` : 'FIGHT!', W / 2, 288)
    ctx.shadowBlur = 0
  }
  if (eng.phase === 'finish' || eng.phase === 'ko') {
    ctx.fillStyle = 'rgba(0,0,0,.62)'
    roundRect(ctx, W / 2 - 180, 228, 360, 88, 12, true, false)
    ctx.fillStyle = eng.phase === 'finish' ? '#f472b6' : '#fb7185'
    ctx.font = 'bold 56px system-ui,Segoe UI,sans-serif'
    ctx.textAlign = 'center'
    ctx.shadowColor = '#db2777'
    ctx.shadowBlur = 20
    ctx.fillText(eng.phase === 'finish' ? 'FINISH!' : 'K.O.', W / 2, 290)
    ctx.shadowBlur = 0
  }
  if (eng.phase === 'match_end') {
    ctx.fillStyle = 'rgba(0,0,0,.68)'
    roundRect(ctx, W / 2 - 220, 208, 440, 110, 14, true, false)
    ctx.strokeStyle = 'rgba(52,211,153,0.55)'
    ctx.lineWidth = 2
    roundRect(ctx, W / 2 - 220, 208, 440, 110, 14, false, true)
    ctx.fillStyle = '#6ee7b7'
    ctx.font = 'bold 34px system-ui,Segoe UI,sans-serif'
    ctx.textAlign = 'center'
    ctx.shadowColor = '#059669'
    ctx.shadowBlur = 14
    const name = eng.winner === 'p1' ? p1.fighter.name : p2.fighter.name
    ctx.fillText(`${name.slice(0, 22)} WINS!`, W / 2, 275)
    ctx.shadowBlur = 0
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: boolean,
  stroke: boolean,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
  if (fill) ctx.fill()
  if (stroke) ctx.stroke()
}

function barPlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
  left: boolean,
): void {
  ctx.fillStyle = '#05050c'
  roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 6, true, false)
  ctx.fillStyle = '#1a1030'
  roundRect(ctx, x, y, w, h, 4, true, false)
  const fill = Math.max(0, Math.min(1, t))
  const grd = ctx.createLinearGradient(x, y, x + w, y)
  if (fill > 0.5) {
    grd.addColorStop(0, '#86efac')
    grd.addColorStop(0.5, '#4ade80')
    grd.addColorStop(1, '#16a34a')
  } else if (fill > 0.25) {
    grd.addColorStop(0, '#fde68a')
    grd.addColorStop(1, '#f59e0b')
  } else {
    grd.addColorStop(0, '#fca5a5')
    grd.addColorStop(1, '#dc2626')
  }
  ctx.fillStyle = grd
  ctx.save()
  // clip fill to rounded track
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 3, false, false)
  ctx.clip()
  if (left) ctx.fillRect(x, y, Math.floor(w * fill), h)
  else ctx.fillRect(x + Math.floor(w * (1 - fill)), y, Math.floor(w * fill), h)
  // gloss
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.fillRect(x, y, w, Math.max(2, h * 0.35))
  ctx.restore()
  ctx.strokeStyle = 'rgba(226,232,240,0.65)'
  ctx.lineWidth = 1.5
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 4, false, true)
}

function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
  fg: string,
  bg: string,
): void {
  ctx.fillStyle = bg
  roundRect(ctx, x, y, w, h, 4, true, false)
  ctx.fillStyle = fg
  const fw = Math.max(0, Math.floor(w * Math.min(1, Math.max(0, t))))
  if (fw > 0) {
    ctx.save()
    roundRect(ctx, x, y, w, h, 4, false, false)
    ctx.clip()
    ctx.fillRect(x, y, fw, h)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(x, y, fw, Math.max(2, h * 0.4))
    ctx.restore()
  }
}
