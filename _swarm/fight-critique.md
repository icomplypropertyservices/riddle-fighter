# AGENT-LEAD-FIGHT — Riddle Fighter Arena UI Critique

**Scope:** `App.tsx` screens, `game-ui/*`, `FighterPicker`, `Arena`, `TouchControls`/`PsControls`, `styles.css`, `fighter-dash.css`, `game-ui.css`  
**Lens:** Ruthless SF / medieval arena critic  
**Date:** 2026-08-11

---

## Score: **34 / 100**

| Axis | Score | Note |
|------|------:|------|
| Character select energy | 28 | Tiny thumbs, SaaS cards, no plaque / challenge frame |
| VS / HP chrome | 30 | Cyan neon bar, chip soup, not SF plates |
| Lobby focus | 25 | Wall of panels before you ever pick a fighter |
| Visual identity | 32 | Crypto-violet / neon cyan, not stone / gold / blood |
| Mobile fight controls | 40 | Functional pads; PS face glyph + neon active states wrong |
| Fight HUD shell | 38 | Pink/cyan side labels; violet canvas glow |

This is a **wallet dashboard with a fight button**, not an arena. Kill the neon. Bring stone, gold, and blood.

---

## Top 15 Flaws

### 1. Character select has zero SF energy
`FighterPicker` (`fp-card`) uses 72px portrait strips, soft violet select rings, and chip rows that read like a marketplace. No large selected champion, no “CHALLENGER” plate, no gold frame when armed for battle.

### 2. VS strip is cyber chrome, not arena chrome
`.g-vs` is framed in cyan (`fighter-dash.css` overrides + `box-shadow: 0 0 0 1px #22d3ee22`). P1 cyan / P2 pink borders are synthwave, not red-blue SF or gold/crimson medieval.

### 3. HP / stat chrome is SaaS pill soup
`.g-vs-stats-row span` and hero `.fd-stat` are muted dark cards with cyan accents — dashboard KPI tiles, not HP plates or life bars.

### 4. Lobby is a vertical landfill
`App.tsx` lobby stacks: build tag → hero → modes → VS → handle panel → wallet → mint → picker → lands → online/tourney/offer → moves → history. Player never gets a clean “pick → fight” funnel.

### 5. Neon leftover everywhere
`text-shadow: 0 0 28px #22d3ee55` on title accent; VS glow; `g-hero-word-accent` violet bloom; canvas `box-shadow` violet ring; moves dots with purple glow. Explicitly anti-medieval and anti-SF solid-plate language.

### 6. Mobile controls still speak PlayStation, not arena
`PsControls` △○✕□ + L2/R2 are fine as inputs but **look** like a console skin on a fantasy NFT fighter. Active states paint violet. `TouchControls` special is fuchsia neon. No iron/wood pad treatment.

### 7. FIGHT CTA is a dead cyan/violet pill
Ready state jumps between violet (`game-ui.css`) and cyan (`fighter-dash.css` `!important`). Neither reads as arcade **FIGHT** — needs gold on dark stone, heavy letter-spacing, slam presence.

### 8. Mode select is mute SaaS tiles
`.fd-mode` / `.g-mode-card` are tiny muted boxes. No cabinet energy, no ranked/tourney drama. Five equal tiles dilute hierarchy (VS CPU should dominate).

### 9. Hero is crypto branding, not attract mode
`GameHero` / `.fd-hero`: “FIGHTER · LIVE” badges, cyan title glow, step wizard UI. Reads as onboarding SaaS, not “INSERT COIN / ENTER THE ARENA.”

### 10. Fight shell side colors are synthwave
`.g-fight-p1 { color: #22d3ee }` / `.g-fight-p2 { color: #f472b6 }` — pure neon leftover. SF uses strong left/right contrast without hot pink.

### 11. Result screen is generic win/lose banner
`ResultArcade` is a flat green/red strip. No KO stamp, no gold wreath for win, no cracked stone for loss. Rematch buttons are stock suite pills.

### 12. Arena stage still glows violet
`.arena-wrap canvas` box-shadow uses `rgba(139, 92, 246, 0.25)`. Stage should sit in iron frame / dark stone, not suite purple.

### 13. Debug / build chrome in production lobby
`.fd-build-tag` (“FIGHTER · OWNED NFTS · …”) is internal rebuild noise. Tutorial banner + heat bar + header chip army add more chrome before the fight.

### 14. Dual CSS systems fight each other
`g-*` (game-ui) vs `fd-*` (fighter-dash) with `!important` cyan overrides on VS/picker. No single arena theme token layer. Result: inconsistent borders, competing pink/cyan accents.

### 15. Selection / ready feedback is purple neon ring
`.fp-card.is-on`, `.g-pick-card.is-on`, selected strip `#8b5cf655` — violet glow “selected” is suite brand, not “this champion is locked for the arena.”

---

## Exact Fixes Per File

| File | Fix |
|------|-----|
| `src/shell/medieval-arena.css` | **NEW** — palette tokens (stone, gold, crimson, parchment), scoped under `[data-med-arena]`. Override hero, modes, VS, pick cards, fight shell, result, touch/ps pads. Kill cyan/pink neon. |
| `src/main.tsx` | Import `./shell/medieval-arena.css` after fighter-dash so arena wins cascade. |
| `src/App.tsx` | `data-med-arena="1"` on root shell; hide/remove `fd-build-tag` in lobby; keep engine/wallet/credits/online logic untouched. |
| `src/components/game-ui/GameHero.tsx` | Arena kicker copy (“ENTER THE ARENA”), gold title treatment classes, drop neon “LIVE” cyber badge language. |
| `src/components/game-ui/VsReadyBar.tsx` | Portrait plate classes, YOU/RIVAL → side labels with med-arena structure, solid FIGHT button (no cyan). |
| `src/components/game-ui/ModeSelect.tsx` | Cabinet-style labels; primary mode emphasis class for CPU. |
| `src/components/game-ui/ResultArcade.tsx` | KO/WIN stamp classes; stone frame; rematch as gold CTA. |
| `src/components/game-ui/MovesLegend.tsx` | Remove inline neon purple; use CSS classes for dots. |
| `src/components/FighterPicker.tsx` | Selected strip as champion plaque; card structure for med-arena frames; keep all select/filter/wallet logic. |
| `src/components/TouchControls.tsx` | Add `med-pad` class hooks (structure only; style in CSS). |
| `src/components/PsControls.tsx` | Optional `med-pad` class on pads (CSS-only retheme preferred). |
| `src/styles.css` | Arena canvas frame (iron, no violet glow); soften suite cyan hovers where fight-facing; leave suite chrome mostly alone. |
| `src/fighter-dash.css` | Strip cyan `!important` VS overrides; gold/crimson ready states; kill title text-shadow glow. |
| `src/game-ui.css` | Neutralize VS cyan box-shadow; fight-p1/p2 colors; result frame; picker select rings → gold. |

**Do not touch:** `game/engine.ts`, wallet/Xaman, credits ledger, online host/guest refs, match end economy.

---

## MUST FIX NOW — Top 5

1. **`src/shell/medieval-arena.css`** — single theme layer: stone/gold/crimson, kill neon under `[data-med-arena]`.
2. **`App.tsx` + `main.tsx`** — enable `data-med-arena`, import CSS, remove build-tag clutter.
3. **VS / HP / fight chrome** — retheme `VsReadyBar` + fight shell + `fighter-dash`/`game-ui` VS overrides to gold/iron plates.
4. **game-ui redesign** — `GameHero`, `ModeSelect`, `ResultArcade`, `MovesLegend` arena language.
5. **FighterPicker polish** — champion selected plaque + gold select frames (CSS + light markup).

---

## Implementation order

1. Write tokens + overrides in `medieval-arena.css`  
2. Wire attribute + import  
3. Component class/copy polish  
4. `tsc --noEmit`  
5. Ship `fight-done.md`
