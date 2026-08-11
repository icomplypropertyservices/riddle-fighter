# QA Report — riddle-fighter

**Date:** 2026-08-11  
**Agent:** QA (Riddle suite)  
**Scope:** TypeScript check + production Vite build; list remaining visual debt (no redesign).

---

## Commands

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | **PASS** (exit 0) |
| Production build | `npx vite build` | **PASS** (exit 0, ~2.8s) |

### Build output (summary)

- Vite 6.4.3 · 158 modules transformed
- PWA: precache **26** entries (~8859 KiB)
- Main JS chunk: `index-Bqb2ZDDh.js` **584.09 kB** (gzip 171.08 kB)
- CSS: `index-Blcjs1TV.css` **75.62 kB** (gzip 13.32 kB)
- Secondary: `bundler-zlg29qOW.js` 123.51 kB
- Warning only: chunk > 500 kB (code-split opportunity — not a failure)

### TypeScript fixes applied

**None.** No compile errors; no source changes required for green build.

---

## Visual debt (remaining)

Build is green. Per `docs/STREET_FIGHTER_GRAPHICS_PLAN.md` and current `public/art` inventory:

### Character body art (primary debt)
Painted magenta-keyed bodies live under `/art/characters/`. Coverage is **thin** vs full SF pose set:

| Body key | Present files | Debt |
|----------|---------------|------|
| **starter** | idle, punch, kick | Missing dedicated crouch/jump/block/hit/special/ko (reuse idle or punch) |
| **inquisition** | idle, punch | Kick/special reuse punch; other poses → idle |
| **inquiry** | idle only | All non-idle poses map to idle |
| **reborn** | idle only | Same |
| **bridge** | idle only | Same |
| **ember** | idle only | Same |
| **void** | idle only | Same |

1. **Most collections only have idle sprites** — punch/kick/crouch/jump/block/hit/special/ko silently alias idle or a single attack PNG (`characterBodies.ts`). Move readability is weak outside starter (+ partial inquisition).
2. **Procedural / frameBake fallback** — `fighterRenderer` still draws articulated procedural silhouettes while packs bake or when painted body missing; frameBake multi-frame packs are not replaced by hand-painted sheets yet.
3. **Optional hand-painted replacement sheets** — Graphics plan Phase 3 open item: drop-in 256×384 cell sheets not shipped.

### Stage / VFX
4. **Stage art set small** — only `stage-neon-city.jpg`, `stage-crystal-ruin.jpg`, `stage-hud-plate.jpg`, `fx-ko-burst.jpg`. Engine still has **procedural stage fallback** if art not loaded (`engine.ts`).
5. **PERFECT card sprite** — Phase 4 optional polish still open in graphics plan.
6. **Parallax/crowd** are code-drawn silhouettes — acceptable but not painted mid-ground layers.

### UI / shell
7. **TEMP suite chrome** — `suite-chrome.css`: wallet-product TEMP layout (no UnifiedSuiteHeader / bottom dock) still marked temporary.
8. **NFT detail “Soon” art slots** — `NftDetail` shows placeholder art tile when NEW art pending (`nd-art-ph`).
9. **Portrait / color soft fallbacks** — fighter picker prefers body art then canvas portrait then solid color (`fighters.ts`); some NFTs may still present as color swatches or plates rather than full bodies.
10. **Main JS ~584 kB** — first-fight paint can lag on mid phones before arena + bodies load.

### Plan checklist leftovers
From `STREET_FIGHTER_GRAPHICS_PLAN.md`:
- [ ] Optional hand-painted replacement sheets (Phase 3)
- [ ] PERFECT card sprite (Phase 4 optional)

Phases 1–2 foundation, true2d, afterimages, hitstop, parallax, juice are marked shipped.

---

## Verdict

| Item | Status |
|------|--------|
| `tsc --noEmit` | PASS |
| `vite build` | PASS |
| TS fixes needed | None |
| Ship-ready (compile) | **Yes** |
| Visual polish complete | **No** — body pose coverage is the main gap |

**Next polish priorities (optional, not this QA):**
1. Author punch/kick/crouch/jump/block/hit/ko PNGs for inquiry, reborn, bridge, ember, void (and complete inquisition kick).
2. Drop hand-painted frame sheets into the frameBake cell size pipeline.
3. Add PERFECT finish card + one more stage plate if product wants SF-level arena variety.
4. Resolve TEMP suite chrome vs full suite header/dock consistency.
