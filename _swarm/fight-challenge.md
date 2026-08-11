# FIGHT CHALLENGE — Devil’s Advocate (Lobby / Result / Picker)

**Agent:** DEVIL’S-ADVOCATE  
**Target:** Riddle Fighter lobby · mode picker · VS ready · result  
**Verdict:** **Not Street Fighter enough.** Lead left neon-violet SaaS chrome. Kill it.

---

## 1. Critique — “not SF enough”

### What SF actually does (the bar)

Street Fighter sells **spectacle before the bout**:

| Beat | SF II / III / V / 6 energy | Riddle Fighter today |
|------|----------------------------|----------------------|
| Title | Heavy wordmark, arcade weight, gold/red threat | Soft SaaS “RIDDLE × FIGHTER” + violet LIVE chip |
| Mode select | Character / mode tiles with **identity crests** | Flat muted pills, cyan “is-on” glow |
| VS strip | Portraits + giant **FIGHT** plate, metal UI | Thin cards, cyan border, purple kit text |
| Result | **KO / YOU WIN** full-bleed drama | Green/red web banner + cyan credits line |
| Palette | Gold, crimson, ink black, parchment | **Neon violet (#8b5cf6), cyan, lavender** |
| Feel | Arcade cabinet / tournament flyer | Discord settings panel with fighters glued on |

### Specific failures

1. **Lobby reads as product onboarding, not arena entry.**  
   Three-step “Connect → Pick NFT → Fight” is correct *flow*, wrong *costume*. SF doesn’t say “connect wallet.” It says **CHALLENGER APPROACHING** and puts weight on the nameplate.

2. **ModeSelect is spreadsheet UI.**  
   Five equal muted tiles with “cr” prices. No crest, no shield, no “VS CPU” arcade stamp. Selected state is **cyan outline** — cyber, not colosseum.

3. **VsReadyBar is polite.**  
   FIGHT should be a **raised metal plate** you want to slam. Ready state uses cyan fill. P2 kit stats are violet. Borders glow like a neon bar, not a VS banner.

4. **ResultArcade is a bootstrap card, not KO parchment.**  
   “YOU WIN / YOU LOSE” strip is fine wording, wrong material: flat `#065f46` / `#7f1d1d` blocks, rounded SaaS frame, cyan money. SF finishes with **KO**, freeze, gold letters on blood-dark ground — parchment seal energy, not toast notification.

5. **Fighter picker inherits violet selection.**  
   `.g-pick-card.is-on` / art backgrounds still pull **#8b5cf6 / #1a1030** purple caves. SF select screens use gold frames and strong silhouette cards.

6. **Neon violet is the villain.**  
   Lead palette: `--riddle-violet`, `--fd-violet`, glow shadows, purple badges. That is **suite hub**, not fighter arcade. Devil’s advocate: every violet pixel is a design debt until gold/crimson owns the lobby.

### What we do *not* touch

- Engine sim, Arena, match end payouts, wallet connect logic, online/tournament state machines.  
- **Preserve fight logic.** Skin only: hero, modes, VS bar, result, tokens, wrappers.

---

## 2. Aggressive fix (this challenge)

| Surface | Change |
|---------|--------|
| `GameHero` | Medieval title block: crest marks, gold/crimson RIDDLE FIGHTER, path steps as **ordeal seals** |
| `ModeSelect` | Mode **crests** (heraldic glyphs), gold active rim |
| `ResultArcade` | **KO parchment** frame, WIN/LOSE seal, rematch as decree |
| `VsReadyBar` | **FIGHT plate** (raised brass), VS gem, ink portraits |
| `styles.css` `:root` | Gold / crimson primary — kill violet as brand accent |
| `medieval-arena.css` | Full arena skin under `[data-med-arena]` |
| `main.tsx` | Import `medieval-arena.css` |
| `App.tsx` | `data-med-arena` + med wrappers on lobby/result |

**Palette law:** gold `#d4a017` / `#f0c14b`, crimson `#8b1538` / `#c41e3a`, ink `#0a0806`, parchment `#e8d5a3`. No neon violet. No cyan primary.

---

## 3. Success criteria

- [ ] Lobby looks like tournament flyer, not suite settings  
- [ ] FIGHT plate is the loudest control  
- [ ] Result reads as KO parchment  
- [ ] Modes have crests  
- [ ] `tsc --noEmit` clean  
- [ ] Fight logic unchanged  

**Done report:** `_swarm/fight-challenge-done.md`
