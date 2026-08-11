/**
 * Castle / medieval arena UI structural checks for riddle-fighter.
 *
 *   node scripts/verify-castle-ui.mjs
 *
 * Checks:
 * 1. App.tsx has data-med-arena and/or castle shell markers
 * 2. App.tsx uses useSuiteCreditsBridge
 * 3. main.tsx has exactly one medieval-arena CSS import path
 * 4. Reports App.tsx line count
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP = join(ROOT, 'src', 'App.tsx')
const MAIN = join(ROOT, 'src', 'main.tsx')
const SCREENS = join(ROOT, 'src', 'screens')

let failed = 0
const results = []

function pass(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  failed++
  results.push({ ok: false, name, detail })
  console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

function info(name, detail = '') {
  results.push({ ok: true, name, detail, info: true })
  console.log(`  INFO  ${name}${detail ? ` — ${detail}` : ''}`)
}

console.log('verify-castle-ui — riddle-fighter\n')

if (!existsSync(APP)) {
  fail('App.tsx exists', APP)
  process.exit(1)
}
if (!existsSync(MAIN)) {
  fail('main.tsx exists', MAIN)
  process.exit(1)
}

const appSrc = readFileSync(APP, 'utf8')
const mainSrc = readFileSync(MAIN, 'utf8')
const appLines = appSrc.split(/\r?\n/).length

// 1. data-med-arena or castle shell on App root
const hasMedArena =
  /data-med-arena\s*=\s*["']1["']/.test(appSrc) || /data-med-arena/.test(appSrc)
const hasCastleShell =
  /data-castle-shell\s*=\s*["']1["']/.test(appSrc) ||
  /data-castle-shell/.test(appSrc) ||
  /castle-shell|castle/.test(appSrc)

if (hasMedArena || hasCastleShell) {
  pass(
    'castle / med-arena markers in App.tsx',
    `data-med-arena=${hasMedArena} data-castle-shell=${/data-castle-shell/.test(appSrc)}`,
  )
} else {
  fail(
    'castle / med-arena markers in App.tsx',
    'expected data-med-arena and/or data-castle-shell / castle',
  )
}

// Prefer both present (stronger castle shell)
if (hasMedArena && /data-castle-shell/.test(appSrc)) {
  pass('full castle shell pair', 'data-med-arena + data-castle-shell')
} else if (hasMedArena) {
  info('partial shell', 'data-med-arena present; data-castle-shell missing')
}

// 2. useSuiteCreditsBridge
if (/useSuiteCreditsBridge/.test(appSrc)) {
  const imported = /import\s*\{[^}]*useSuiteCreditsBridge[^}]*\}\s*from\s*['"]@riddle\/suite-credits['"]/.test(
    appSrc,
  )
  const called = /useSuiteCreditsBridge\s*\(/.test(appSrc)
  if (imported && called) {
    pass('useSuiteCreditsBridge', 'imported from @riddle/suite-credits and called')
  } else if (called) {
    pass('useSuiteCreditsBridge', 'hook called (import path may differ)')
  } else {
    fail('useSuiteCreditsBridge', 'symbol present but not called as a hook')
  }
} else {
  fail('useSuiteCreditsBridge', 'not found in App.tsx')
}

// 3. Exactly one medieval-arena import path in main.tsx
const medImports = [
  ...mainSrc.matchAll(
    /import\s+['"]([^'"]*medieval-arena[^'"]*)['"]/g,
  ),
].map((m) => m[1])

if (medImports.length === 1) {
  pass('single medieval-arena import in main.tsx', medImports[0])
} else if (medImports.length === 0) {
  fail('single medieval-arena import in main.tsx', 'no medieval-arena CSS import found')
} else {
  fail(
    'single medieval-arena import in main.tsx',
    `found ${medImports.length}: ${medImports.join(', ')}`,
  )
}

// 4. App.tsx line count
info('App.tsx line count', String(appLines))

// Optional: screens wiring status
if (existsSync(SCREENS)) {
  let screenFiles = []
  try {
    const walk = (dir) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name)
        if (ent.isDirectory()) walk(p)
        else if (/\.(tsx?|jsx?)$/.test(ent.name)) screenFiles.push(p)
      }
    }
    walk(SCREENS)
  } catch {
    screenFiles = []
  }
  const hasLobby = screenFiles.some((f) => /LobbyScreen/i.test(f))
  const hasWallet = screenFiles.some((f) => /WalletConnectPanel/i.test(f))
  info(
    'src/screens/',
    screenFiles.length
      ? `${screenFiles.length} file(s); LobbyScreen=${hasLobby} WalletConnectPanel=${hasWallet}`
      : 'directory empty (no screen modules yet)',
  )
  if (hasLobby || hasWallet) {
    const wiredLobby = /LobbyScreen/.test(appSrc)
    const wiredWallet = /WalletConnectPanel/.test(appSrc)
    if (hasLobby && !wiredLobby) {
      fail('LobbyScreen wired in App.tsx', 'screen exists but App does not import/use it')
    } else if (hasLobby) {
      pass('LobbyScreen wired in App.tsx')
    }
    if (hasWallet && !wiredWallet) {
      fail(
        'WalletConnectPanel wired in App.tsx',
        'panel exists but App does not import/use it',
      )
    } else if (hasWallet) {
      pass('WalletConnectPanel wired in App.tsx')
    }
  }
} else {
  info('src/screens/', 'not present')
}

console.log('')
console.log(`App.tsx lines: ${appLines}`)
console.log(
  failed === 0
    ? `OK — ${results.filter((r) => !r.info).length} checks passed`
    : `FAILED — ${failed} check(s) failed`,
)

process.exit(failed === 0 ? 0 : 1)
