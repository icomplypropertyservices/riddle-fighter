/**
 * EVERY NFT trait → a real combat function.
 * No decorative-only traits: unknown keys still get a deterministic power
 * from hash so nothing is lazy/ignored.
 *
 * Pipeline:
 *   raw traits → TraitEffect[] → CombatPowers (aggregated) → engine
 */

import { traitMap } from './moveset'
import type { Fighter, FighterIdentity, FighterStats } from './fighters'
import { collectionGameplayFor, mergeEquipHooks } from './collectionMatrix'
import {
  resolveCollectionWiring,
  wiringToHooks,
  type CollectionWiringEntry,
} from './collectionWiring'
import {
  resolveGameMetaScoreSync,
  scannedStatsToMults,
  type GameMetaFighterScore,
} from './gameMetaScores'

// ─── Types ──────────────────────────────────────────────────────────────────

export type StatusKind = 'burn' | 'frost' | 'shock' | 'void' | 'bleed' | 'poison'

export type TraitEffectKind =
  | 'stat'
  | 'combat'
  | 'meter'
  | 'status'
  | 'move'
  | 'vfx'
  | 'utility'

/** One resolved effect from one trait row. */
export type TraitEffect = {
  /** Original trait_type */
  trait: string
  /** Original value */
  value: string
  /** Short UI label */
  label: string
  kind: TraitEffectKind
  /** What it does in plain English */
  desc: string
  /** Numeric payload (engine reads aggregated CombatPowers) */
  tags: string[]
}

/** Aggregated kit applied every frame / hit. */
export type CombatPowers = {
  effects: TraitEffect[]
  /** Stat multipliers (1 = baseline after statsFromTraits) */
  multHp: number
  multAtk: number
  multDef: number
  multSpeed: number
  multSpecial: number
  /** Movement */
  walkMult: number
  jumpMult: number
  /** Offense */
  reachMult: number
  damageMult: number
  specialDamageMult: number
  critChance: number
  critMult: number
  armorPen: number
  firstHitBonus: number
  comboDecayResist: number
  knockbackMult: number
  hitstunMult: number
  lifeSteal: number
  chipDamage: number
  /** Defense */
  blockDmgMult: number
  hitstunResist: number
  /** Meter */
  meterStart: number
  meterGainMult: number
  meterCostMult: number
  meterRegenBonus: number
  /** HP thresholds */
  lowHpAmp: number
  highHpAmp: number
  /** Status inflicted on hit */
  status: { kind: StatusKind; chance: number; power: number } | null
  /** Identity */
  element: string
  weaponClass: 'fist' | 'blade' | 'blunt' | 'pole' | 'ranged' | 'magic' | 'shield' | 'unknown'
  stance: string
  classId: string
  /** VFX / palette */
  vfxTint: string | null
  afterimage: boolean
  /** Move frame tweaks */
  startupMult: number
  recoveryMult: number
  activeMult: number
}

const DEFAULT_POWERS: Omit<CombatPowers, 'effects'> = {
  multHp: 1,
  multAtk: 1,
  multDef: 1,
  multSpeed: 1,
  multSpecial: 1,
  walkMult: 1,
  jumpMult: 1,
  reachMult: 1,
  damageMult: 1,
  specialDamageMult: 1,
  critChance: 0,
  critMult: 1.5,
  armorPen: 0,
  firstHitBonus: 0,
  comboDecayResist: 0,
  knockbackMult: 1,
  hitstunMult: 1,
  lifeSteal: 0,
  chipDamage: 0,
  blockDmgMult: 1,
  hitstunResist: 0,
  meterStart: 35,
  meterGainMult: 1,
  meterCostMult: 1,
  meterRegenBonus: 0,
  lowHpAmp: 0,
  highHpAmp: 0,
  status: null,
  element: '',
  weaponClass: 'unknown',
  stance: '',
  classId: '',
  vfxTint: null,
  afterimage: false,
  startupMult: 1,
  recoveryMult: 1,
  activeMult: 1,
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function numVal(v: string): number | null {
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function normKey(k: string): string {
  return k.trim().toLowerCase().replace(/[_-]+/g, ' ')
}

// ─── Per-trait resolvers (every known family + fallback) ────────────────────

type Resolver = (
  key: string,
  value: string,
  p: CombatPowers,
) => TraitEffect | null

const RESOLVERS: Array<{ test: RegExp; run: Resolver }> = [
  // ── Core stats ──────────────────────────────────────────────────────────
  {
    test: /^(power|rf atk|inherited power|atk|attack|strength|might|force)$/,
    run: (k, v, p) => {
      const n = numVal(v) ?? 10
      const m = 1 + clamp(n, 0, 100) * 0.004
      p.multAtk *= m
      p.damageMult *= 1 + clamp(n, 0, 100) * 0.002
      return {
        trait: k,
        value: v,
        label: 'Power',
        kind: 'stat',
        desc: `ATK ×${m.toFixed(2)} · damage +${(clamp(n, 0, 100) * 0.2).toFixed(0)}%`,
        tags: ['atk', 'damage'],
      }
    },
  },
  {
    test: /^(defense|defence|rf def|inherited defen[cs]e|def|armor|armour|resilience)$/,
    run: (k, v, p) => {
      const n = numVal(v) ?? 10
      const m = 1 + clamp(n, 0, 100) * 0.004
      p.multDef *= m
      p.blockDmgMult *= 1 - clamp(n, 0, 80) * 0.0015
      return {
        trait: k,
        value: v,
        label: 'Defense',
        kind: 'stat',
        desc: `DEF ×${m.toFixed(2)} · better block mitigation`,
        tags: ['def', 'block'],
      }
    },
  },
  {
    test: /^(rf hp|inherited health|health|hp|vitality|max hp|endurance|stamina)$/,
    run: (k, v, p) => {
      const n = numVal(v) ?? 10
      const m = 1 + clamp(n, 0, 200) * 0.003
      p.multHp *= m
      if (/endurance|stamina/i.test(k)) p.hitstunResist += 0.08
      return {
        trait: k,
        value: v,
        label: 'Vitality',
        kind: 'stat',
        desc: `Max HP ×${m.toFixed(2)}`,
        tags: ['hp'],
      }
    },
  },
  {
    test: /^(rf speed|speed|spd|agility|dex|dexterity|swiftness)$/,
    run: (k, v, p) => {
      const n = numVal(v) ?? 10
      const m = 1 + clamp(n, 0, 100) * 0.0045
      p.multSpeed *= m
      p.walkMult *= 1 + clamp(n, 0, 100) * 0.003
      p.startupMult *= 1 - clamp(n, 0, 60) * 0.002
      return {
        trait: k,
        value: v,
        label: 'Speed',
        kind: 'stat',
        desc: `SPD ×${m.toFixed(2)} · faster walk & startup`,
        tags: ['speed', 'walk', 'startup'],
      }
    },
  },
  {
    test: /^(rf special|special|magic|spirit|energy|mana|chi|will)$/,
    run: (k, v, p) => {
      const n = numVal(v) ?? 10
      const m = 1 + clamp(n, 0, 100) * 0.0045
      p.multSpecial *= m
      p.specialDamageMult *= 1 + clamp(n, 0, 100) * 0.003
      p.meterGainMult *= 1 + clamp(n, 0, 80) * 0.002
      return {
        trait: k,
        value: v,
        label: 'Special',
        kind: 'stat',
        desc: `Special ×${m.toFixed(2)} · stronger supers · faster meter`,
        tags: ['special', 'meter'],
      }
    },
  },
  {
    test: /^(level|lvl|rf level)$/,
    run: (k, v, p) => {
      const n = clamp(numVal(v) ?? 1, 1, 99)
      const m = 1 + (n - 1) * 0.006
      p.multHp *= m
      p.multAtk *= m
      p.multDef *= 1 + (n - 1) * 0.004
      p.multSpecial *= 1 + (n - 1) * 0.005
      p.meterStart = Math.min(60, p.meterStart + Math.floor(n / 5))
      return {
        trait: k,
        value: v,
        label: `Lv ${n}`,
        kind: 'stat',
        desc: `Level ${n}: all stats scale · meter start ${p.meterStart}`,
        tags: ['level', 'scale'],
      }
    },
  },
  {
    test: /^(xp|experience|rf xp)$/,
    run: (k, v, p) => {
      const n = clamp(numVal(v) ?? 0, 0, 50000)
      const bonus = Math.floor(n / 800) * 0.01
      p.multHp *= 1 + bonus
      p.meterGainMult *= 1 + bonus * 0.5
      return {
        trait: k,
        value: v,
        label: 'XP',
        kind: 'stat',
        desc: `XP ${n}: HP +${(bonus * 100).toFixed(0)}% · meter gain`,
        tags: ['xp'],
      }
    },
  },
  // ── Element ─────────────────────────────────────────────────────────────
  {
    test: /^(inherited element|element|rf element|affinity|elemental)$/,
    run: (k, v, p) => {
      const el = v.toLowerCase()
      p.element = el
      p.vfxTint =
        /fire|ember|flame|solar/.test(el)
          ? '#f97316'
          : /void|shadow|dark|null/.test(el)
            ? '#a78bfa'
            : /ice|water|frost/.test(el)
              ? '#67e8f9'
              : /nature|earth|grove|jade|wood/.test(el)
                ? '#34d399'
                : /electric|volt|cyber|storm|thunder/.test(el)
                  ? '#22d3ee'
                  : /holy|divine|light|gold|radiant/.test(el)
                    ? '#fde68a'
                    : /iron|steel|metal/.test(el)
                      ? '#94a3b8'
                      : null
      if (/fire|ember|flame/.test(el)) {
        p.specialDamageMult *= 1.08
        p.status = { kind: 'burn', chance: 0.18, power: 3 }
        p.damageMult *= 1.04
      } else if (/void|shadow|dark/.test(el)) {
        p.specialDamageMult *= 1.1
        p.armorPen += 0.08
        p.status = { kind: 'void', chance: 0.15, power: 2 }
        p.afterimage = true
      } else if (/ice|frost|water/.test(el)) {
        p.multDef *= 1.06
        p.hitstunMult *= 1.08
        p.status = { kind: 'frost', chance: 0.16, power: 2 }
      } else if (/nature|earth|grove|jade/.test(el)) {
        p.multHp *= 1.08
        p.lifeSteal += 0.04
        p.status = { kind: 'poison', chance: 0.12, power: 2 }
      } else if (/electric|volt|cyber|storm/.test(el)) {
        p.multSpeed *= 1.08
        p.critChance += 0.06
        p.status = { kind: 'shock', chance: 0.2, power: 2 }
        p.startupMult *= 0.94
      } else if (/holy|divine|light|gold/.test(el)) {
        p.specialDamageMult *= 1.08
        p.meterGainMult *= 1.1
        p.highHpAmp += 0.08
      } else if (/iron|steel|metal/.test(el)) {
        p.multDef *= 1.1
        p.knockbackMult *= 0.9
        p.hitstunResist += 0.1
      } else {
        p.damageMult *= 1.03
      }
      return {
        trait: k,
        value: v,
        label: `Element · ${v}`,
        kind: 'combat',
        desc: `Element ${v}: matchups, status, VFX tint active`,
        tags: ['element', el],
      }
    },
  },
  // ── Weapon ──────────────────────────────────────────────────────────────
  {
    test: /^(weapon|armament|rf weapon|equipped|gear|loadout)$/,
    run: (k, v, p) => {
      const w = v.toLowerCase()
      if (/sword|blade|katana|saber|scimitar|knife|dagger|scythe/.test(w)) {
        p.weaponClass = 'blade'
        p.damageMult *= 1.08
        p.reachMult *= 1.06
        p.critChance += 0.04
        p.status = p.status || { kind: 'bleed', chance: 0.14, power: 2 }
      } else if (/axe|hammer|mace|club|flail|maul/.test(w)) {
        p.weaponClass = 'blunt'
        p.damageMult *= 1.1
        p.knockbackMult *= 1.2
        p.hitstunMult *= 1.1
        p.startupMult *= 1.06
      } else if (/spear|halberd|pike|pole|lance|staff|glaive/.test(w)) {
        p.weaponClass = 'pole'
        p.reachMult *= 1.18
        p.damageMult *= 1.05
      } else if (/gun|rifle|bow|crossbow|pistol|cannon|launcher/.test(w)) {
        p.weaponClass = 'ranged'
        p.reachMult *= 1.22
        p.startupMult *= 1.08
        p.critChance += 0.05
      } else if (/wand|tome|scepter|orb|grimoire|relic/.test(w)) {
        p.weaponClass = 'magic'
        p.specialDamageMult *= 1.15
        p.meterGainMult *= 1.08
        p.meterCostMult *= 0.95
      } else if (/shield|buckler|barrier|aegis|plate/.test(w)) {
        p.weaponClass = 'shield'
        p.multDef *= 1.12
        p.blockDmgMult *= 0.75
        p.chipDamage += 0.04
      } else if (/fist|gauntlet|claw|knuckle/.test(w)) {
        p.weaponClass = 'fist'
        p.startupMult *= 0.92
        p.comboDecayResist += 0.15
        p.critChance += 0.03
      } else {
        p.weaponClass = 'unknown'
        p.damageMult *= 1.04
        p.reachMult *= 1.03
      }
      return {
        trait: k,
        value: v,
        label: `Weapon · ${v}`,
        kind: 'combat',
        desc: `Weapon class ${p.weaponClass}: reach/damage/status tuned`,
        tags: ['weapon', p.weaponClass],
      }
    },
  },
  // ── Class / role ────────────────────────────────────────────────────────
  {
    test: /^(game class|class|role|rf class|archetype|job)$/,
    run: (k, v, p) => {
      const c = v.toLowerCase()
      p.classId = c
      if (/tank|guard|warden|knight|heavy|paladin|sentinel/.test(c)) {
        p.multHp *= 1.12
        p.multDef *= 1.1
        p.walkMult *= 0.92
        p.blockDmgMult *= 0.85
        p.highHpAmp += 0.05
      } else if (/assassin|rogue|striker|ninja|swift|slayer|hunter/.test(c)) {
        p.multSpeed *= 1.12
        p.critChance += 0.1
        p.startupMult *= 0.9
        p.firstHitBonus += 0.12
        p.multHp *= 0.94
      } else if (/mage|oracle|void|mystic|sorcer|caster|wizard|priest/.test(c)) {
        p.multSpecial *= 1.15
        p.specialDamageMult *= 1.12
        p.meterCostMult *= 0.92
        p.meterStart += 8
      } else if (/brawler|fighter|monk|soldier|warrior|berserker|barbarian/.test(c)) {
        p.multAtk *= 1.08
        p.comboDecayResist += 0.12
        p.lowHpAmp += 0.12
        p.knockbackMult *= 1.08
      } else if (/support|healer|medic|bard/.test(c)) {
        p.lifeSteal += 0.08
        p.meterGainMult *= 1.15
        p.multDef *= 1.04
      } else if (/ranger|sniper|gunner|archer/.test(c)) {
        p.reachMult *= 1.15
        p.critChance += 0.08
        p.critMult *= 1.1
      } else {
        p.multAtk *= 1.03
        p.multSpecial *= 1.03
      }
      return {
        trait: k,
        value: v,
        label: `Class · ${v}`,
        kind: 'combat',
        desc: `Class kit active for ${v}`,
        tags: ['class', c],
      }
    },
  },
  // ── Weight / stance / style ─────────────────────────────────────────────
  {
    test: /^(rf weight|weight|build|body type|frame)$/,
    run: (k, v, p) => {
      const w = v.toLowerCase()
      if (/heavy|tank|armor|bulky|massive/.test(w)) {
        p.multDef *= 1.08
        p.walkMult *= 0.9
        p.knockbackMult *= 0.85
        p.hitstunResist += 0.12
        p.jumpMult *= 0.92
      } else if (/light|agile|glass|slim|lean|feather/.test(w)) {
        p.walkMult *= 1.12
        p.jumpMult *= 1.1
        p.startupMult *= 0.94
        p.multDef *= 0.95
        p.critChance += 0.04
      } else if (/medium|balanced|average|standard/.test(w)) {
        p.damageMult *= 1.03
        p.multHp *= 1.02
      } else {
        p.walkMult *= 1.02
      }
      return {
        trait: k,
        value: v,
        label: `Weight · ${v}`,
        kind: 'combat',
        desc: `Build ${v}: movement & defense tuned`,
        tags: ['weight', w],
      }
    },
  },
  {
    test: /^(rf stance|stance|rf battle stance|style|fighting style|form)$/,
    run: (k, v, p) => {
      p.stance = v.toLowerCase()
      const s = p.stance
      if (/aggressive|offense|blitz|rush|pressure/.test(s)) {
        p.damageMult *= 1.08
        p.meterGainMult *= 1.08
        p.blockDmgMult *= 1.08
      } else if (/defensive|guard|counter|turtle|iron/.test(s)) {
        p.blockDmgMult *= 0.8
        p.chipDamage += 0.05
        p.meterGainMult *= 1.05
      } else if (/balanced|neutral|standard|mid/.test(s)) {
        p.comboDecayResist += 0.08
        p.meterRegenBonus += 0.5
      } else if (/evasive|mobile|hit.?and.?run|skirmish/.test(s)) {
        p.walkMult *= 1.1
        p.hitstunResist += 0.08
        p.recoveryMult *= 0.94
      } else if (/patient|zoning|keep.?away/.test(s)) {
        p.reachMult *= 1.1
        p.specialDamageMult *= 1.06
      } else {
        p.comboDecayResist += 0.05
      }
      return {
        trait: k,
        value: v,
        label: `Stance · ${v}`,
        kind: 'combat',
        desc: `Fighting stance ${v} alters offense/defense`,
        tags: ['stance', s],
      }
    },
  },
  // ── Army / faction / title ──────────────────────────────────────────────
  {
    test: /^(army|owner army|faction army|legion|guild|clan)$/,
    run: (k, v, p) => {
      p.multHp *= 1.04
      p.meterStart += 4
      p.meterRegenBonus += 0.3
      return {
        trait: k,
        value: v,
        label: `Army · ${v}`,
        kind: 'utility',
        desc: `Army ${v}: +HP · meter start & regen`,
        tags: ['army'],
      }
    },
  },
  {
    test: /^(faction bias|faction|side|allegiance|order)$/,
    run: (k, v, p) => {
      p.multSpecial *= 1.04
      p.specialDamageMult *= 1.04
      if (/inquisit/i.test(v)) {
        p.critChance += 0.03
        p.damageMult *= 1.03
      }
      return {
        trait: k,
        value: v,
        label: `Faction · ${v}`,
        kind: 'utility',
        desc: `Faction ${v}: special power up`,
        tags: ['faction'],
      }
    },
  },
  {
    test: /^(rf title|title|rank title|rank|title rank)$/,
    run: (k, v, p) => {
      const t = v.toLowerCase()
      p.meterStart += 5
      if (/legend|champion|master|grand|elite|hero|god|king|queen|lord/.test(t)) {
        p.multAtk *= 1.05
        p.multSpecial *= 1.05
        p.critChance += 0.04
        p.afterimage = true
      } else if (/veteran|captain|knight|officer/.test(t)) {
        p.multDef *= 1.04
        p.meterGainMult *= 1.06
      } else {
        p.meterGainMult *= 1.03
      }
      return {
        trait: k,
        value: v,
        label: `Title · ${v}`,
        kind: 'utility',
        desc: `Title ${v}: prestige combat bonuses`,
        tags: ['title'],
      }
    },
  },
  {
    test: /^(uniform|outfit|skin|armor set|costume|apparel)$/,
    run: (k, v, p) => {
      p.multDef *= 1.03
      p.blockDmgMult *= 0.97
      if (/heavy|plate|armor|mail/i.test(v)) {
        p.multDef *= 1.05
        p.walkMult *= 0.96
      } else if (/cloak|robe|silk|light/i.test(v)) {
        p.walkMult *= 1.04
        p.critChance += 0.02
      }
      return {
        trait: k,
        value: v,
        label: `Uniform · ${v}`,
        kind: 'vfx',
        desc: `Uniform ${v}: armor & mobility`,
        tags: ['uniform'],
      }
    },
  },
  // ── Rarity / generation / serial ────────────────────────────────────────
  {
    test: /^(rarity|tier|grade|quality|rf rarity)$/,
    run: (k, v, p) => {
      const r = v.toLowerCase()
      let bump = 0.02
      if (/legendary|mythic|unique|god|ssr|legendary/.test(r)) bump = 0.1
      else if (/epic|rare|sr|elite/.test(r)) bump = 0.06
      else if (/uncommon|fine/.test(r)) bump = 0.04
      else if (/common|basic|normal/.test(r)) bump = 0.02
      p.multHp *= 1 + bump
      p.multAtk *= 1 + bump
      p.multSpecial *= 1 + bump
      p.critChance += bump * 0.3
      if (bump >= 0.08) p.afterimage = true
      return {
        trait: k,
        value: v,
        label: `Rarity · ${v}`,
        kind: 'stat',
        desc: `Rarity ${v}: +${(bump * 100).toFixed(0)}% core stats`,
        tags: ['rarity'],
      }
    },
  },
  {
    test: /^(generation|gen|edition|series|season|drop)$/,
    run: (k, v, p) => {
      const n = numVal(v)
      if (n != null && n <= 1) {
        p.multAtk *= 1.05
        p.meterStart += 5
      } else if (n != null) {
        p.multHp *= 1 + Math.min(0.06, n * 0.008)
      } else {
        p.multSpecial *= 1.03
      }
      return {
        trait: k,
        value: v,
        label: `Gen · ${v}`,
        kind: 'stat',
        desc: `Generation/edition ${v} scales combat`,
        tags: ['generation'],
      }
    },
  },
  {
    test: /^(serial|number|token id|#|id|plot|land id)$/,
    run: (k, v, p) => {
      const n = numVal(v) ?? hash(v) % 1000
      const seed = (n % 97) / 97
      p.critChance += seed * 0.04
      p.meterRegenBonus += seed * 0.4
      return {
        trait: k,
        value: v,
        label: `ID · ${v}`,
        kind: 'utility',
        desc: `Serial ${v}: unique crit/meter seed`,
        tags: ['serial'],
      }
    },
  },
  // ── Named specials / moves ──────────────────────────────────────────────
  {
    test: /^(rf special name|inherited special ability 1|special name|special ability|ability 1|skill 1)$/,
    run: (k, v, p) => {
      p.specialDamageMult *= 1.06
      p.meterCostMult *= 0.97
      return {
        trait: k,
        value: v,
        label: `Special · ${v}`,
        kind: 'move',
        desc: `Named special "${v}": +damage · cheaper meter`,
        tags: ['move', 'special'],
      }
    },
  },
  {
    test: /^(rf super name|inherited special ability 2|super name|secret name|ability 2|ultimate)$/,
    run: (k, v, p) => {
      p.specialDamageMult *= 1.1
      p.meterStart += 5
      p.afterimage = true
      return {
        trait: k,
        value: v,
        label: `Secret · ${v}`,
        kind: 'move',
        desc: `Secret "${v}": super damage · afterimage`,
        tags: ['move', 'secret'],
      }
    },
  },
  {
    test: /^(rf moveset|moveset|style kit|combo kit)$/,
    run: (k, v, p) => {
      p.comboDecayResist += 0.1
      p.startupMult *= 0.97
      return {
        trait: k,
        value: v,
        label: `Moveset · ${v}`,
        kind: 'move',
        desc: `Moveset ${v}: combo sustain · faster startup`,
        tags: ['move', 'combo'],
      }
    },
  },
  // ── Colors (visual + tiny combat identity) ──────────────────────────────
  {
    test: /^(rf color primary|primary color|color|color primary|main color|base color)$/,
    run: (k, v, p) => {
      if (/^#?[0-9a-f]{3,8}$/i.test(v)) p.vfxTint = v.startsWith('#') ? v : `#${v}`
      p.meterGainMult *= 1.01
      return {
        trait: k,
        value: v,
        label: 'Primary color',
        kind: 'vfx',
        desc: `Primary color ${v} drives aura / VFX`,
        tags: ['color', 'vfx'],
      }
    },
  },
  {
    test: /^(rf color secondary|secondary color|accent|color secondary)$/,
    run: (k, v, p) => {
      p.critChance += 0.01
      return {
        trait: k,
        value: v,
        label: 'Accent color',
        kind: 'vfx',
        desc: `Accent ${v}: crit micro-bonus + VFX`,
        tags: ['color', 'vfx'],
      }
    },
  },
  // ── Combat keywords often as free-text traits ───────────────────────────
  {
    test: /^(crit|critical|luck|fortune|precision)$/,
    run: (k, v, p) => {
      const n = numVal(v)
      const c = n != null ? clamp(n, 0, 50) * 0.004 : 0.05
      p.critChance += c
      p.critMult *= 1.05
      return {
        trait: k,
        value: v,
        label: 'Crit',
        kind: 'combat',
        desc: `Crit chance +${(c * 100).toFixed(1)}%`,
        tags: ['crit'],
      }
    },
  },
  {
    test: /^(lifesteal|vamp|drain|leech|siphon)$/,
    run: (k, v, p) => {
      const n = numVal(v)
      p.lifeSteal += n != null ? clamp(n, 0, 40) * 0.005 : 0.06
      return {
        trait: k,
        value: v,
        label: 'Life steal',
        kind: 'combat',
        desc: `Heal ${(p.lifeSteal * 100).toFixed(0)}% of damage dealt`,
        tags: ['lifesteal'],
      }
    },
  },
  {
    test: /^(rage|berserk|fury|bloodlust)$/,
    run: (k, v, p) => {
      p.lowHpAmp += 0.18
      p.damageMult *= 1.04
      return {
        trait: k,
        value: v,
        label: 'Rage',
        kind: 'combat',
        desc: 'Low-HP damage amplifier',
        tags: ['rage', 'lowhp'],
      }
    },
  },
  {
    test: /^(guardian|protector|bulwark|fortress)$/,
    run: (k, v, p) => {
      p.highHpAmp += 0.1
      p.blockDmgMult *= 0.9
      p.multDef *= 1.05
      return {
        trait: k,
        value: v,
        label: 'Guardian',
        kind: 'combat',
        desc: 'High-HP pressure + stronger block',
        tags: ['guardian'],
      }
    },
  },
  {
    test: /^(predator|ambush|first strike|opener)$/,
    run: (k, v, p) => {
      p.firstHitBonus += 0.15
      p.critChance += 0.03
      return {
        trait: k,
        value: v,
        label: 'Predator',
        kind: 'combat',
        desc: 'First hit of combo deals bonus damage',
        tags: ['firsthit'],
      }
    },
  },
  {
    test: /^(armor pen|penetration|pierce|sunder)$/,
    run: (k, v, p) => {
      const n = numVal(v)
      p.armorPen += n != null ? clamp(n, 0, 50) * 0.008 : 0.1
      return {
        trait: k,
        value: v,
        label: 'Armor pen',
        kind: 'combat',
        desc: `Ignore ${(p.armorPen * 100).toFixed(0)}% defense`,
        tags: ['armorpen'],
      }
    },
  },
  {
    test: /^(handle|rf handle|username|user|owner handle)$/,
    run: (k, v, p) => {
      p.meterStart += 2
      return {
        trait: k,
        value: v,
        label: `Handle · ${v}`,
        kind: 'utility',
        desc: `Bound handle @${v}: identity meter bump`,
        tags: ['handle'],
      }
    },
  },
  {
    test: /^(burn|poison|bleed|frost|shock|curse|plague)$/,
    run: (k, v, p) => {
      const kind = (/burn|flame/.test(k)
        ? 'burn'
        : /poison|plague/.test(k)
          ? 'poison'
          : /bleed|blood/.test(k)
            ? 'bleed'
            : /frost|ice|chill/.test(k)
              ? 'frost'
              : /shock|volt|electric/.test(k)
                ? 'shock'
                : 'void') as StatusKind
      const n = numVal(v)
      p.status = {
        kind,
        chance: 0.2,
        power: n != null ? clamp(n, 1, 10) : 3,
      }
      return {
        trait: k,
        value: v,
        label: `Status · ${kind}`,
        kind: 'status',
        desc: `On-hit ${kind} (${(p.status.chance * 100).toFixed(0)}%)`,
        tags: ['status', kind],
      }
    },
  },
]

/**
 * Fallback: any trait not matched still gets a deterministic power.
 * This is the anti-lazy guarantee.
 */
function fallbackEffect(key: string, value: string, p: CombatPowers): TraitEffect {
  const h = hash(`${key}:${value}`)
  const lane = h % 8
  const strength = 0.02 + ((h >> 3) % 8) * 0.005
  switch (lane) {
    case 0:
      p.multAtk *= 1 + strength
      break
    case 1:
      p.multDef *= 1 + strength
      break
    case 2:
      p.multHp *= 1 + strength
      break
    case 3:
      p.multSpeed *= 1 + strength
      break
    case 4:
      p.multSpecial *= 1 + strength
      break
    case 5:
      p.meterGainMult *= 1 + strength
      break
    case 6:
      p.critChance += strength * 0.5
      break
    default:
      p.reachMult *= 1 + strength * 0.5
      p.damageMult *= 1 + strength * 0.4
  }
  const lanes = ['ATK', 'DEF', 'HP', 'SPD', 'Special', 'Meter', 'Crit', 'Reach']
  return {
    trait: key,
    value,
    label: `${key}`,
    kind: 'utility',
    desc: `Trait "${key}=${value}" → ${lanes[lane]} power (+${(strength * 100).toFixed(1)}%)`,
    tags: ['fallback', lanes[lane]!.toLowerCase()],
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Resolve every trait on the NFT into effects + aggregated CombatPowers. */
export function buildCombatPowers(
  traits?: Array<{ trait_type?: string; value?: unknown }>,
  identity?: FighterIdentity,
): CombatPowers {
  const p: CombatPowers = { ...DEFAULT_POWERS, effects: [] }
  const tm = traitMap(traits)

  // Seed identity fields when not in raw traits
  if (identity?.element && !tm['inherited element'] && !tm['element']) {
    tm['inherited element'] = identity.element
  }
  if (identity?.weapon && !tm['weapon']) tm['weapon'] = identity.weapon
  if (identity?.gameClass && !tm['game class']) tm['game class'] = identity.gameClass
  if (identity?.stance && !tm['rf stance']) tm['rf stance'] = identity.stance
  if (identity?.weight && !tm['rf weight']) tm['rf weight'] = identity.weight
  if (identity?.army && !tm['army']) tm['army'] = identity.army
  if (identity?.faction && !tm['faction']) tm['faction'] = identity.faction
  if (identity?.title && !tm['rf title']) tm['rf title'] = identity.title

  const seen = new Set<string>()
  for (const [rawKey, rawVal] of Object.entries(tm)) {
    const key = normKey(rawKey)
    const value = String(rawVal ?? '').trim()
    if (!key || !value) continue
    const dedupe = `${key}::${value}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)

    let effect: TraitEffect | null = null
    for (const r of RESOLVERS) {
      if (r.test.test(key)) {
        effect = r.run(key, value, p)
        break
      }
    }
    if (!effect) effect = fallbackEffect(key, value, p)
    p.effects.push(effect)
  }

  // Always at least element from identity if still empty
  if (!p.element && identity?.element) {
    p.element = identity.element
  }

  // Clamp wild stacks
  p.multHp = clamp(p.multHp, 0.75, 1.55)
  p.multAtk = clamp(p.multAtk, 0.75, 1.55)
  p.multDef = clamp(p.multDef, 0.75, 1.55)
  p.multSpeed = clamp(p.multSpeed, 0.75, 1.5)
  p.multSpecial = clamp(p.multSpecial, 0.75, 1.55)
  p.walkMult = clamp(p.walkMult, 0.8, 1.35)
  p.reachMult = clamp(p.reachMult, 0.85, 1.4)
  p.damageMult = clamp(p.damageMult, 0.85, 1.45)
  p.specialDamageMult = clamp(p.specialDamageMult, 0.85, 1.5)
  p.critChance = clamp(p.critChance, 0, 0.35)
  p.critMult = clamp(p.critMult, 1.25, 2.25)
  p.armorPen = clamp(p.armorPen, 0, 0.4)
  p.lifeSteal = clamp(p.lifeSteal, 0, 0.25)
  p.blockDmgMult = clamp(p.blockDmgMult, 0.45, 1.15)
  p.meterStart = clamp(p.meterStart, 20, 70)
  p.meterGainMult = clamp(p.meterGainMult, 0.7, 1.5)
  p.meterCostMult = clamp(p.meterCostMult, 0.7, 1.25)
  p.startupMult = clamp(p.startupMult, 0.8, 1.2)
  p.comboDecayResist = clamp(p.comboDecayResist, 0, 0.5)

  return p
}

/** Apply power multipliers onto base stats (post statsFromTraits). */
export function applyPowersToStats(stats: FighterStats, powers: CombatPowers): FighterStats {
  return {
    hp: Math.round(clamp(stats.hp * powers.multHp, 70, 220)),
    atk: Math.round(clamp(stats.atk * powers.multAtk, 6, 40)),
    def: Math.round(clamp(stats.def * powers.multDef, 3, 32)),
    speed: Math.round(clamp(stats.speed * powers.multSpeed, 5, 28)),
    special: Math.round(clamp(stats.special * powers.multSpecial, 12, 48)),
  }
}

// ─── Transparent Power Level ────────────────────────────────────────────────

/** One line of the Power Level breakdown (base + each trait + collection). */
export type PowerContribution = {
  source: 'base' | 'trait' | 'collection' | 'stats' | 'scanned'
  trait?: string
  value?: string
  label: string
  contribution: number
  desc: string
}

export type PowerLevelBreakdown = {
  /** Final display Power Level (integer). */
  total: number
  base: number
  lines: PowerContribution[]
  /** Present when hand-scored game-meta Power Level is authoritative. */
  scanned?: {
    powerLevel: number
    provenance: string
    sourceLabel: string
    comboKey?: string
    archetype?: string
  }
  /** Local trait-computed PL (fallback / comparison when scanned is used). */
  localTotal?: number
}

const BASE_POWER_LEVEL = 100

/** Estimate PL points from a single trait effect using its tags + desc. */
function contributionFromEffect(e: TraitEffect): number {
  // Deterministic from trait+value so UI is stable
  const h = hash(`${e.trait}:${e.value}:${e.kind}`)
  let pts = 4 + (h % 7) // 4–10 base for any real trait

  // Kind weights — combat identity matters more than pure VFX
  switch (e.kind) {
    case 'stat':
      pts += 6
      break
    case 'combat':
      pts += 8
      break
    case 'move':
      pts += 7
      break
    case 'status':
      pts += 5
      break
    case 'meter':
      pts += 4
      break
    case 'utility':
      pts += 3
      break
    case 'vfx':
      pts += 1
      break
  }

  // Numeric trait values scale contribution
  const n = numVal(e.value)
  if (n != null) {
    if (/level|lvl/i.test(e.trait)) pts += Math.floor(clamp(n, 1, 99) * 0.35)
    else if (/power|atk|attack|strength/i.test(e.trait)) pts += Math.floor(clamp(n, 0, 100) * 0.12)
    else if (/defen|armor|hp|health|vital/i.test(e.trait)) pts += Math.floor(clamp(n, 0, 100) * 0.1)
    else if (/speed|special|magic/i.test(e.trait)) pts += Math.floor(clamp(n, 0, 100) * 0.1)
    else if (/xp|experience/i.test(e.trait)) pts += Math.floor(clamp(n, 0, 50000) / 2000)
    else if (/rarity|legendary|mythic|epic|rare/i.test(e.value)) pts += 8
    else pts += Math.floor(clamp(Math.abs(n), 0, 50) * 0.06)
  }

  // Tag boosts
  if (e.tags.includes('element')) pts += 4
  if (e.tags.includes('weapon')) pts += 4
  if (e.tags.includes('class')) pts += 5
  if (e.tags.includes('rarity')) pts += 6
  if (e.tags.includes('collection')) pts += 5

  return Math.max(1, Math.round(pts))
}

/**
 * Transparent Power Level = base + per-trait contributions + collection + stats.
 * When a hand-scanned game-meta score exists, that powerLevel is authoritative;
 * local trait math remains as fallback + breakdown source.
 * Shown on picker cards, detail panel, and VS screen.
 */
export function computePowerLevel(
  f: Pick<
    Fighter,
    | 'stats'
    | 'powers'
    | 'traits'
    | 'identity'
    | 'taxon'
    | 'collection'
    | 'category'
    | 'nftId'
    | 'id'
  >,
  powersOverride?: CombatPowers,
  scannedOverride?: GameMetaFighterScore | null,
): PowerLevelBreakdown {
  const powers = powersOverride || f.powers || buildCombatPowers(f.traits, f.identity)
  const lines: PowerContribution[] = [
    {
      source: 'base',
      label: 'Base',
      contribution: BASE_POWER_LEVEL,
      desc: 'Arena baseline for every fighter',
    },
  ]

  let total = BASE_POWER_LEVEL

  for (const e of powers.effects) {
    if (e.tags.includes('collection')) continue // handled separately below
    if (e.tags.includes('scanned')) continue // shown as scanned provenance line
    const c = contributionFromEffect(e)
    total += c
    lines.push({
      source: 'trait',
      trait: e.trait,
      value: e.value,
      label: e.label,
      contribution: c,
      desc: e.desc,
    })
  }

  // Collection wiring contribution
  const wiring = resolveCollectionWiring({
    taxon: f.taxon,
    collection: f.collection,
    category: f.category,
  })
  const biasAvg =
    (wiring.statBias.power +
      wiring.statBias.speed +
      wiring.statBias.defense +
      wiring.statBias.technique) /
    4
  const collPts = Math.round((biasAvg - 1) * 80) + (wiring.fightable ? 8 : 2)
  const collContrib = Math.max(2, collPts)
  total += collContrib
  lines.push({
    source: 'collection',
    trait: 'collection',
    value: wiring.name,
    label: wiring.name,
    contribution: collContrib,
    desc: `${wiring.archetype} · ${wiring.combatStyle}`,
  })

  // Live stats soft scale (post-power stats if present)
  const s = f.stats
  if (s) {
    const statPts = Math.round(
      (s.hp - 100) * 0.15 +
        (s.atk - 12) * 1.2 +
        (s.def - 8) * 1.0 +
        (s.speed - 10) * 0.8 +
        (s.special - 18) * 0.9,
    )
    if (statPts !== 0) {
      const c = clamp(statPts, -20, 60)
      total += c
      lines.push({
        source: 'stats',
        label: 'Combat stats',
        contribution: c,
        desc: `HP ${s.hp} · ATK ${s.atk} · DEF ${s.def} · SPD ${s.speed} · SP ${s.special}`,
      })
    }
  }

  const localTotal = Math.round(clamp(total, 80, 999))

  // Hand-scanned game-meta score (authoritative when present)
  const scanned =
    scannedOverride === undefined
      ? resolveGameMetaScoreSync({
          nftId: f.nftId || (typeof f.id === 'string' ? f.id.replace(/^nft-/i, '') : undefined),
          collection: f.collection,
          taxon: f.taxon,
          category: f.category,
          traits: f.traits,
        })
      : scannedOverride

  if (scanned && scanned.powerLevel > 0) {
    // Display scale: map 0–100 scanned band onto arena PL so sort stays comparable
    // while scanned value remains the source of truth (shown as "scanned score").
    const scannedDisplay = Math.round(clamp(BASE_POWER_LEVEL + scanned.powerLevel * 2.4, 80, 999))
    lines.unshift({
      source: 'scanned',
      trait: 'game-meta',
      value: String(scanned.powerLevel),
      label: 'Scanned score',
      contribution: scanned.powerLevel,
      desc: `${scanned.sourceLabel}${scanned.archetype ? ` · ${scanned.archetype}` : ''} (meta PL ${scanned.powerLevel} → arena ${scannedDisplay})`,
    })
    return {
      total: scannedDisplay,
      base: BASE_POWER_LEVEL,
      lines,
      localTotal,
      scanned: {
        powerLevel: scanned.powerLevel,
        provenance: scanned.provenance,
        sourceLabel: scanned.sourceLabel,
        comboKey: scanned.comboKey,
        archetype: scanned.archetype,
      },
    }
  }

  return { total: localTotal, base: BASE_POWER_LEVEL, lines, localTotal }
}

/** Convenience: total PL number for sort / badges. */
export function powerLevelOf(f: Fighter | null | undefined): number {
  if (!f) return BASE_POWER_LEVEL
  if (typeof f.powerLevel === 'number' && f.powerLevel > 0) return f.powerLevel
  return computePowerLevel(f).total
}

/**
 * Attach powers to a fighter.
 * Stacks: NFT traits + collection matrix hooks + hand-authored wiring biases
 * + optional hand-scanned game-meta score (authoritative Power Level).
 * Optional equip: weapons/ammo/charms via f.equipped.
 * Idempotent: safe to call from picker + engine (no double stat mult).
 */
export function withCombatPowers(f: Fighter): Fighter {
  // Already fully wired — return as-is (engine + picker both call this)
  if (
    f.powers?.effects?.some((e) => e.tags.includes('collection')) &&
    typeof f.powerLevel === 'number' &&
    f.powerBreakdown &&
    !(f as { equipped?: unknown[] }).equipped
  ) {
    return f
  }

  // Prefer pre-power baseline when stamped (avoids double mult after re-entry)
  const baseStats: FighterStats =
    (f as { baseStats?: FighterStats }).baseStats || f.stats

  let powers = buildCombatPowers(f.traits, f.identity)

  // Hand-authored collection wiring (stat biases + archetype hooks)
  const wiring: CollectionWiringEntry = resolveCollectionWiring({
    taxon: f.taxon,
    collection: f.collection,
    category: f.category,
    issuer: f.issuer,
  })
  const wHooks = wiringToHooks(wiring)
  powers = {
    ...powers,
    multAtk: powers.multAtk * wHooks.atkMult,
    multDef: powers.multDef * wHooks.defMult,
    multSpecial: powers.multSpecial * wHooks.specialMult,
    multSpeed: powers.multSpeed * wiring.statBias.speed,
    reachMult: powers.reachMult * wHooks.reachMult,
    meterStart: Math.min(70, powers.meterStart + wHooks.meterStartBonus),
    critChance: Math.min(0.4, powers.critChance + wHooks.critBonus),
    lifeSteal: Math.min(0.3, powers.lifeSteal + wHooks.lifeSteal),
    armorPen: Math.min(0.45, powers.armorPen + wHooks.armorPen),
    effects: [
      {
        trait: 'collection',
        value: wiring.name,
        label: wiring.name,
        kind: 'combat',
        desc: `${wiring.archetype} · ${wiring.combatStyle}`,
        tags: ['collection', wiring.key, wiring.archetype],
      },
      ...powers.effects,
    ],
  }

  // Hand-scanned game-meta (offline traits / cache) — blends combat mults
  const scanned = resolveGameMetaScoreSync({
    nftId: f.nftId || (typeof f.id === 'string' ? f.id.replace(/^nft-/i, '') : undefined),
    collection: f.collection,
    taxon: f.taxon,
    category: f.category,
    traits: f.traits,
  })
  if (scanned) {
    const m = scannedStatsToMults(scanned)
    powers = {
      ...powers,
      multAtk: powers.multAtk * m.multAtk,
      multDef: powers.multDef * m.multDef,
      multSpeed: powers.multSpeed * m.multSpeed,
      multSpecial: powers.multSpecial * m.multSpecial,
      multHp: powers.multHp * m.multHp,
      effects: [
        {
          trait: 'game-meta',
          value: String(scanned.powerLevel),
          label: 'Scanned score',
          kind: 'stat',
          desc: scanned.sourceLabel,
          tags: ['scanned', scanned.slug, scanned.provenance],
        },
        ...powers.effects,
      ],
    }
  }

  // Legacy matrix hooks (gear equip merge) — keep for weapons/ammo stacks
  const coll = collectionGameplayFor({
    taxon: f.taxon,
    collection: f.collection,
    category: f.category,
  })
  if (coll) {
    const gearHooks = ((f as { equipped?: Array<{ taxon?: number; collection?: string; category?: string }> })
      .equipped || [])
      .map((e) => collectionGameplayFor(e)?.hooks || {})
    if (gearHooks.length) {
      const merged = mergeEquipHooks({}, gearHooks)
      powers = {
        ...powers,
        multAtk: powers.multAtk * merged.atkMult,
        multDef: powers.multDef * merged.defMult,
        multSpecial: powers.multSpecial * merged.specialMult,
        reachMult: powers.reachMult * merged.reachMult,
        meterStart: Math.min(70, powers.meterStart + merged.meterStartBonus),
        critChance: Math.min(0.4, powers.critChance + merged.critBonus),
        lifeSteal: Math.min(0.3, powers.lifeSteal + merged.lifeSteal),
        armorPen: Math.min(0.45, powers.armorPen + merged.armorPen),
      }
    }
  }

  // Re-clamp after wiring stacks
  powers.multHp = clamp(powers.multHp, 0.75, 1.55)
  powers.multAtk = clamp(powers.multAtk, 0.75, 1.55)
  powers.multDef = clamp(powers.multDef, 0.75, 1.55)
  powers.multSpeed = clamp(powers.multSpeed, 0.75, 1.5)
  powers.multSpecial = clamp(powers.multSpecial, 0.75, 1.55)

  const stats = applyPowersToStats(baseStats, powers)
  const pl = computePowerLevel({ ...f, stats, powers }, powers, scanned)
  return {
    ...f,
    stats,
    powers,
    powerLevel: pl.total,
    powerBreakdown: pl,
    // stamp baseline so a second call cannot double-apply
    ...( { baseStats } as { baseStats: FighterStats } ),
  }
}

/** UI lines for picker / detail. */
export function powerSummary(powers: CombatPowers, limit = 12): string[] {
  return powers.effects.slice(0, limit).map((e) => `${e.label}: ${e.desc}`)
}

export function powersReady(f: Fighter | null | undefined): CombatPowers {
  if (!f) return { ...DEFAULT_POWERS, effects: [] }
  if (f.powers) return f.powers
  return buildCombatPowers(f.traits, f.identity)
}
