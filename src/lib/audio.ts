/**
 * Web Audio SFX + looping BGM — no external asset files required.
 * Music is a short synthesized battle loop (unlock on first user gesture).
 */

let ctx: AudioContext | null = null
let unlocked = false
let sfxEnabled = true
let musicEnabled = true
let musicNodes: { stop: () => void } | null = null
let musicGain: GainNode | null = null

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  return ctx
}

export function unlockAudio(): void {
  const c = ac()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  unlocked = true
  if (musicEnabled && !musicNodes) startMusic()
}

export function setAudioEnabled(on: boolean): void {
  sfxEnabled = on
  try {
    localStorage.setItem('rf_sfx', on ? '1' : '0')
  } catch {
    /* soft */
  }
}

export function isAudioEnabled(): boolean {
  try {
    const v = localStorage.getItem('rf_sfx')
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* soft */
  }
  return sfxEnabled
}

export function setMusicEnabled(on: boolean): void {
  musicEnabled = on
  try {
    localStorage.setItem('rf_music', on ? '1' : '0')
  } catch {
    /* soft */
  }
  if (!on) stopMusic()
  else if (unlocked) startMusic()
}

export function isMusicEnabled(): boolean {
  try {
    const v = localStorage.getItem('rf_music')
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* soft */
  }
  return musicEnabled
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = 'square',
  gain = 0.04,
  slide = 0,
): void {
  if (!sfxEnabled || !unlocked) return
  const c = ac()
  if (!c) return
  const t0 = c.currentTime
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur)
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

/** Minor battle motif loop via scheduled oscillators */
export function startMusic(): void {
  if (!musicEnabled || !unlocked) return
  const c = ac()
  if (!c || musicNodes) return
  if (c.state === 'suspended') void c.resume()

  const master = c.createGain()
  master.gain.value = 0.028
  master.connect(c.destination)
  musicGain = master

  // Dark pad
  const pad = c.createOscillator()
  pad.type = 'sawtooth'
  pad.frequency.value = 55
  const padG = c.createGain()
  padG.gain.value = 0.35
  const padF = c.createBiquadFilter()
  padF.type = 'lowpass'
  padF.frequency.value = 420
  pad.connect(padF)
  padF.connect(padG)
  padG.connect(master)
  pad.start()

  // Pulse bass pattern
  const bass = c.createOscillator()
  bass.type = 'triangle'
  bass.frequency.value = 82.41
  const bassG = c.createGain()
  bassG.gain.value = 0
  bass.connect(bassG)
  bassG.connect(master)
  bass.start()

  // Lead arpeggio
  const lead = c.createOscillator()
  lead.type = 'square'
  lead.frequency.value = 220
  const leadG = c.createGain()
  leadG.gain.value = 0
  lead.connect(leadG)
  leadG.connect(master)
  lead.start()

  const notes = [220, 261.63, 293.66, 329.63, 293.66, 261.63, 246.94, 220]
  const bassNotes = [82.41, 82.41, 98, 73.42, 82.41, 82.41, 110, 73.42]
  let step = 0
  const beat = 0.28
  let timer = window.setInterval(() => {
    if (!musicEnabled || !unlocked) return
    const t = c.currentTime
    const n = notes[step % notes.length]!
    const b = bassNotes[step % bassNotes.length]!
    lead.frequency.setValueAtTime(n, t)
    leadG.gain.cancelScheduledValues(t)
    leadG.gain.setValueAtTime(0.0001, t)
    leadG.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
    leadG.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.85)

    bass.frequency.setValueAtTime(b, t)
    bassG.gain.cancelScheduledValues(t)
    bassG.gain.setValueAtTime(0.0001, t)
    bassG.gain.exponentialRampToValueAtTime(0.4, t + 0.03)
    bassG.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.9)

    // filter breathe
    padF.frequency.setTargetAtTime(380 + (step % 4) * 40, t, 0.08)
    step++
  }, beat * 1000)

  musicNodes = {
    stop: () => {
      window.clearInterval(timer)
      try {
        pad.stop()
        bass.stop()
        lead.stop()
      } catch {
        /* soft */
      }
      try {
        master.disconnect()
      } catch {
        /* soft */
      }
      musicNodes = null
      musicGain = null
    },
  }
}

export function stopMusic(): void {
  musicNodes?.stop()
  musicNodes = null
}

/** Louder during fight, softer in lobby */
export function setMusicIntensity(mode: 'lobby' | 'fight'): void {
  if (!musicGain) return
  const c = ac()
  if (!c) return
  const target = mode === 'fight' ? 0.042 : 0.024
  musicGain.gain.cancelScheduledValues(c.currentTime)
  musicGain.gain.setTargetAtTime(target, c.currentTime, 0.3)
}

export const sfx = {
  hit: () => tone(180, 0.06, 'square', 0.05, -80),
  heavy: () => {
    tone(120, 0.1, 'sawtooth', 0.06, -60)
    tone(60, 0.12, 'triangle', 0.04)
  },
  block: () => tone(400, 0.05, 'triangle', 0.03),
  special: () => {
    tone(220, 0.08, 'sawtooth', 0.05, 120)
    tone(440, 0.12, 'square', 0.03, 200)
  },
  ko: () => {
    tone(150, 0.2, 'sawtooth', 0.07, -100)
    tone(80, 0.35, 'triangle', 0.05, -40)
  },
  fight: () => tone(520, 0.12, 'square', 0.04, 80),
  win: () => {
    tone(523, 0.1, 'square', 0.04)
    setTimeout(() => tone(659, 0.1, 'square', 0.04), 90)
    setTimeout(() => tone(784, 0.18, 'square', 0.05), 180)
  },
  ui: () => tone(660, 0.04, 'triangle', 0.025),
  combo: (n: number) => tone(300 + n * 40, 0.05, 'square', 0.035, 40),
  select: () => {
    tone(440, 0.05, 'triangle', 0.03)
    tone(660, 0.06, 'square', 0.02, 40)
  },
}
