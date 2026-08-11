# Castle System (shared game shell)

Single source of truth for the medieval / castle look across Riddle game apps:

| App | Shell attr | Tokens path |
|-----|------------|-------------|
| **riddle-cities** | `data-med-shell="1"` + `data-castle-shell="1"` | `src/shell/castle-tokens.css` |
| **riddle-fighter** | `data-med-arena="1"` + `data-castle-shell="1"` | `src/castle-tokens.css` |
| **riddle-civilisation** | `data-med-shell="1"` + `data-castle-shell="1"` | `src/castle-tokens.css` |

**SSOT package:** `packages/suite-castle/`  
Sync tokens into apps with:

```bash
node packages/suite-castle/sync-vendored.mjs
# or check only:
node packages/suite-castle/sync-vendored.mjs --check
```

Do **not** hand-edit app copies without re-running sync. Do **not** put product gradients in `castle-tokens.css`.

---

## 1. Color tokens (`--castle-*`)

| Token | Role | Hex |
|-------|------|-----|
| `--castle-ink` | Page / stage background | `#0a0806` |
| `--castle-panel` | Cards, plates, HUD panels | `#14100c` |
| `--castle-gold` | Primary accent, borders, CTAs | `#c9a227` |
| `--castle-crimson` | Danger, blood, fight accent | `#8b1538` |
| `--castle-parchment` | Soft highlight / secondary text | `#e8d5a3` |
| `--castle-mute` | Muted labels / meta | `#9a8b72` |
| `--castle-text` | Primary body text | `#f5ecd4` |

Also defined (solid only): `--castle-panel-2`, `--castle-edge`, `--castle-gold-hi`, `--castle-gold-dim`, `--castle-crimson-hi`, `--castle-green`, fonts, and **aliases**:

- `--med-*` → castle (cities shell / arena skin)
- `--fd-*` → castle (fighter dash)
- `--riddle-*`, `--violet` / `--fuchsia` / `--cyan` → gold/parchment (kill neon)

**Rule:** new CSS uses `--castle-*`. No linear/radial gradients inside `castle-tokens.css`.

---

## 2. Shell attributes

Put these on the app root (the element that owns game chrome, not the suite header alone):

| Attribute | Value | Use |
|-----------|-------|-----|
| `data-castle-shell` | `"1"` | Shared castle scope (all three games) |
| `data-med-shell` | `"1"` | Cities + Civilisation medieval shell |
| `data-med-arena` | `"1"` | Fighter arena / lobby skin |

Examples (do not rewrite entire Apps — pattern only):

```tsx
// cities
<div className="app has-suite-chrome" data-med-shell="1" data-castle-shell="1">

// fighter
<div className="app has-suite-chrome" data-med-arena="1" data-castle-shell="1" data-screen={screen}>

// civilisation
<div className="civ-app" data-castle-shell="1" data-med-shell="1">
```

Import tokens early (before app CSS that consumes them):

```ts
import './shell/castle-tokens.css' // cities
import './castle-tokens.css'       // fighter / civilisation
```

---

## 3. Class prefixes (map from `btn` / `sf` / `fd`)

Legacy prefixes stay for builds; prefer castle names for new UI.

| Castle class | Maps from | Role |
|--------------|-----------|------|
| `castle-btn` | `btn`, `btn-primary`, `btn-ok`, `btn-ghost`, `med-btn` | Buttons / CTAs |
| `castle-btn--primary` | `btn-primary`, `btn-ok` | Solid gold primary |
| `castle-panel` | `sf-screen`, card panels, `med-plate`, `fd-mode` plates | Surfaces |
| `castle-chip` | `fd-badge`, select badges, small status pills | Chips / badges |

### Prefix map by app

| App | Existing prefix | Meaning | Castle target |
|-----|-----------------|---------|---------------|
| Cities | `sf-*` | Stage, HUD, arcade tabs, land strip | Prefer `castle-*` for new; keep `sf-*` working |
| Cities | `btn*` | Shared buttons | Style under shell; new = `castle-btn` |
| Fighter | `fd-*` | Hero, modes, stats (fighter dash) | Tokens via `--fd-*` aliases; new = `castle-*` |
| Fighter | `med-*` / `g-*` | Arena skin, lobby stack, VS | Stay under `data-med-arena` |
| All | `med-*` | Medieval skin utilities | Aliased to `--castle-*` |

**Build safety:** do not mass-rename `btn` / `sf-` / `fd-` in App trees. Add castle classes alongside or in new components only.

---

## 4. Credits — `useSuiteCreditsBridge` only

Spendable / display balance for game chrome comes from **suite SSOT**, not a private local ledger as the live source of truth.

```ts
import { useSuiteCreditsBridge } from '@riddle/suite-credits'

const { balance, refresh } = useSuiteCreditsBridge({
  topUpUrl: 'https://wallet.riddlewallet.com/?tab=credits&from=<app>',
})
```

Rules:

- **Only** `useSuiteCreditsBridge` (or other `@riddle/suite-credits` exports) for suite credit balance sync.
- Local game fee helpers may call suite spend APIs; do not invent a second cookie/LS balance.
- Pass `suiteCredits` / `credits` into screen components as props — screens stay presentational.

Used today:

- `riddle-cities` → `App.tsx` + `KeepScreen` props
- `riddle-fighter` → `App.tsx` + lobby/fight UI
- `riddle-civilisation` → `CreditsTab.tsx`

---

## 5. Screens pattern: `KeepScreen` / `LobbyScreen`

**Pattern:** extract play surfaces into props-driven screens. **App** owns wallet, mode, credits bridge, and side-effects. Screens do not fetch suite credits themselves.

### Cities — `KeepScreen`

- Path: `riddle-cities/src/screens/KeepScreen.tsx`
- Export: `screens/index.ts`
- Role: keep play surface (HUD, canvas, inspect, map controls)
- Props include `suiteCredits`, `city`, tools/mode, and callbacks (`onOpenEconomy`, `onCellAction`, …)
- No local game engine state inside the screen

### Fighter — `LobbyScreen`

- Path: `riddle-fighter/src/screens/LobbyScreen.tsx`
- Role: lobby shell (`g-lobby-stack` / `med-lobby`) — hero, mode crests, roster, fight CTA
- Props include `credits`, `playMode`, roster selection, `onFight`, etc.
- App keeps `screen: 'lobby' | 'fight' | 'result' | …` and mounts lobby UI accordingly

### Shared conventions

1. **Props-only** — no hidden global game state in the screen file.
2. **Credits in, actions out** — balance as number prop; mutations via parent callbacks.
3. **Shell classes** — wrap with existing `sf-screen` / `med-lobby` / future `castle-panel` as needed.
4. **Do not rewrite entire App files** to adopt this — extract incrementally; keep builds green.

---

## 6. What not to do

- Do not add neon suite gradients under `data-castle-shell` / `data-med-*`.
- Do not fork `castle-tokens.css` per app (sync from package).
- Do not use a non-suite credits bridge for the displayed suite balance.
- Do not put large orchestration logic into `KeepScreen` / `LobbyScreen`.

---

## 7. File checklist

| Path | Purpose |
|------|---------|
| `packages/suite-castle/castle-tokens.css` | Token SSOT |
| `packages/suite-castle/CASTLE_SYSTEM.md` | This design doc |
| `packages/suite-castle/sync-vendored.mjs` | Copy tokens → apps |
| `riddle-cities/src/shell/CASTLE_SYSTEM.md` | App-local copy of this doc |
| `riddle-fighter/src/shell/CASTLE_SYSTEM.md` | App-local copy of this doc |
| `riddle-cities/src/shell/castle-tokens.css` | Vendored tokens |
| `riddle-fighter/src/castle-tokens.css` | Vendored tokens |
| `riddle-civilisation/src/castle-tokens.css` | Vendored tokens |
