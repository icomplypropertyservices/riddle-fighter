# AGENT-LEAD-FIGHT — Implementation Done

**Critique:** `_swarm/fight-critique.md` (score **34/100** → target retheme)  
**Date:** 2026-08-11  
**tsc --noEmit:** **PASS** (`npx tsc --noEmit -p tsconfig.json`)

---

## MUST FIX NOW (top 5) — shipped

### 1. `src/shell/medieval-arena.css` (NEW)
- Full stone / gold / crimson / parchment token layer under `[data-med-arena]`
- Remaps `--riddle-*` + `--fd-*` away from neon cyan/pink/violet
- Overrides: hero, modes, VS plate, fight shell, picker, result, moves, iron pads (PS + touch)
- Hides `.fd-build-tag` debug chrome
- Iron arena canvas frame (no violet glow)
- Champion plaque (`fp-selected::before CHAMPION`)
- FIGHT ready = crimson + gold border (not cyan/violet pill)

### 2. App shell + CSS wire
- `App.tsx`: `data-med-arena="1"` on root `.app`
- Lobby: removed `fd-build-tag` strip (clutter)
- `main.tsx`: imports `./shell/medieval-arena.css` (+ root `./medieval-arena.css` companion skin)
- Engine / wallet / credits / online logic **untouched**

### 3. VS / HP / fight chrome retheme
- `fighter-dash.css`: gold tokens; VS ready solid crimson; picker select gold; art bg iron; panel titles gold
- `game-ui.css`: VS box-shadow neon killed; VS crimson; fight P1 gold / P2 crimson; ready CTA solid; moves dots gold (no purple glow)
- `styles.css`: canvas box-shadow iron edge (no violet)

### 4. game-ui redesign
- `GameHero.tsx` — arena attract copy / badges (CHALLENGER · ARENA)
- `ModeSelect.tsx` — crest mode tiles
- `VsReadyBar.tsx` — gold/crimson portrait accents, solid FIGHT plate
- `ResultArcade.tsx` — KO parchment + `KoBanner` win/lose stamp
- `MovesLegend.tsx` — class-based trait dots (no inline neon purple)

### 5. FighterPicker polish
- `med-char-select` / `g-pick` dual hooks for arena CSS
- Champion selected strip + `med-char-frame`
- Cards: `g-pick-card` / `g-pick-art` / `g-pick-pl` class bridges
- Copy: “champions · enter the lists”
- Select/filter/credit logic preserved

---

## Files touched (this agent + coordinated skin)

| Path | Change |
|------|--------|
| `_swarm/fight-critique.md` | Written |
| `_swarm/fight-done.md` | Written |
| `src/shell/medieval-arena.css` | **Created** — primary scoped theme |
| `src/medieval-arena.css` | Companion skin; build-tag hidden |
| `src/main.tsx` | Import arena CSS |
| `src/App.tsx` | `data-med-arena`; remove build-tag |
| `src/styles.css` | Iron canvas frame |
| `src/fighter-dash.css` | Gold/crimson tokens; kill cyan VS/picker neon |
| `src/game-ui.css` | VS/fight/moves/result de-neon |
| `src/components/game-ui/*` | Arena language redesign |
| `src/components/FighterPicker.tsx` | Champion plaque + pick class bridges |
| `src/ui/*` | Supporting KO/VS chrome (swarm-adjacent) |

---

## Preserved (do not regress)

- `game/engine.ts` sim + render pipeline
- Wallet / Xaman / Riddle connect
- Credits entry fees + ledger
- Online host/guest refs + snapshots
- Fighter select/filter/sort power level

---

## Residual risk / next swarm pass

1. Lobby still deep (wallet + mint + lands below pick) — funnel collapse is next product pass  
2. Dual CSS (`shell/medieval-arena.css` + root `medieval-arena.css`) — consider single source later  
3. PS face glyphs remain (inputs OK); iron skin only — optional icon swap  
4. Character art height still modest on phones — bigger champion strip if art budget allows  

---

## Verify

```bash
cd C:\Users\E-Store\riddle-fighter
npx tsc --noEmit -p tsconfig.json
# exit 0
```
