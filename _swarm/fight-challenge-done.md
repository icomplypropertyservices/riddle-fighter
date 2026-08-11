# FIGHT CHALLENGE — DONE

**Agent:** DEVIL’S-ADVOCATE  
**Date:** 2026-08-11  
**Status:** Implemented + `tsc --noEmit` **exit 0**

---

## 1. Critique (not SF enough)

Full write-up: [`fight-challenge.md`](./fight-challenge.md)

**Verdict:** Lobby / mode picker / VS / result were suite SaaS with neon violet — not Street Fighter arcade entry.

| Beat | Fail | Fix |
|------|------|-----|
| Title | Soft product hero + violet chips | Medieval nameplate, gold/crimson wordmark, crest badges |
| Modes | Flat muted pills | **Heraldic crests** (shield / blades / crown / colosseum / scroll) |
| VS | Cyan border, polite CTA | Raised **FIGHT plate** (gold→crimson metal) |
| Result | Bootstrap card + cyan money | **KO parchment** + `KoBanner` seal |
| Palette | `#8b5cf6` neon | Gold `#d4a017` / crimson `#c41e3a` — neon killed |

---

## 2. Implemented

### Docs
- `_swarm/fight-challenge.md` — critique + plan  
- `_swarm/fight-challenge-done.md` — this report  

### Components (props / fight logic unchanged)
- `src/components/game-ui/GameHero.tsx` — `med-hero`, `med-title`, ornament, challenger badges  
- `src/components/game-ui/ModeSelect.tsx` — `med-crest` glyphs per mode  
- `src/components/game-ui/ResultArcade.tsx` — `med-ko-parchment` + `KoBanner` seal + `med-decree`  
- `src/components/game-ui/VsReadyBar.tsx` — `med-fight-plate`, gold/crimson portrait rims  

### Skin / wiring
- `src/medieval-arena.css` — **full** gold/crimson arena CSS under `[data-med-arena]`  
- `src/shell/medieval-arena.css` — parallel shell theme (also imported)  
- `src/main.tsx` — imports both `./shell/medieval-arena.css` and `./medieval-arena.css`  
- `src/App.tsx` — `data-med-arena="1"`, `med-lobby-wrap`, `med-result-wrap`  
- `src/styles.css` + `src/fighter-dash.css` `:root` — gold/crimson primary (violet remapped)  
- `src/game-ui.css` / `src/suite-chrome.css` — hardcode neon hex → gold/crimson  
- `src/ui/KoBanner.tsx` — result KO banner (integrated)  

### Preserved
- Engine, Arena, match end, credits, wallet, online, tournament — **untouched**

---

## 3. Verification

```text
cd riddle-fighter
npx tsc --noEmit   → EXIT:0
```

Markers:
- `App.tsx` → `data-med-arena="1"`
- `ModeSelect` → `med-crest`
- `ResultArcade` → `med-ko-parchment` + `KoBanner`
- `VsReadyBar` → `med-fight-plate`
- `GameHero` → `med-title` / `med-ornament`
- CSS import chain in `main.tsx`

---

## 4. Residual

- In-fight canvas HUD not reskinned (challenge scope = lobby/result/picker).  
- Stage file names (`stage-neon-city.jpg`) unchanged.  
- Two CSS skins load (shell + src root); both gold/crimson, no neon.
