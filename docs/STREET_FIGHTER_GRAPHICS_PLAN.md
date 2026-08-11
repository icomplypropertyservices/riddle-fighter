# Riddle Fighter — Street Fighter Standard Graphics Plan

**Status:** Phase 1 foundation (procedural keyframe fighter)  
**Goal:** Arcade-readable 2D fighters, move silhouettes, and stage presentation at Street Fighter II / III / V *readability* standards — not portrait cards glued to the ground.

---

## 0. Problem (current)

| Symptom | Root cause |
|---------|------------|
| “Shocking” / amateur look | Fighters are **static NFT plates** (`drawImage` of portrait) with bob + glow |
| Moves don’t read | Attack = lean + beam FX; no punch/kick pose change |
| No SF silhouette | Portrait crop ≠ side-view fighter |
| Fallback is blob | Ellipse stack, not keyed animation |

**No shortcuts:** we do not ship more glow on the same plate. We change the **character presentation model**.

---

## 1. Target quality bar (Street Fighter standard)

1. **Readability first** — at 960×540, player always knows: facing, crouch, jump, attack type, hitstun, KO  
2. **Silhouette language** — punch ≠ kick ≠ special (limb extension + body lean)  
3. **Frame structure** — startup / active / recovery *visible* in pose, not only hitboxes  
4. **Consistent scale** — both fighters same world height (~200–230px idle)  
5. **Ground contact** — feet on plane, shadow, no floating trading cards  
6. **Impact** — freeze frames, white flash, sparks, screen punch (already partial)  
7. **Identity** — NFT art lives on **face / chest plate**, not whole body  

---

## 2. Architecture (layers)

```
Engine (sim) ──► FighterState (x,y,facing,attackKind,attackFrame,hitstun,…)
                      │
                      ▼
              AnimDirector  (maps state → clip + local frame)
                      │
                      ▼
              PoseLibrary   (keyframed joints / layers)
                      │
                      ▼
              FighterRenderer
                 ├── body limbs (procedural SF silhouette)
                 ├── face/chest (NFT sprite inset, clipped)
                 ├── attack trails / afterimages
                 └── ground shadow
                      │
                      ▼
              StageRenderer + VFX + HUD
```

### Modules (code)

| Path | Role |
|------|------|
| `src/game/render/types.ts` | Pose, clip, layer types |
| `src/game/render/poseLibrary.ts` | Keyframes: idle, walk, crouch, jump, punch, kick, special, secret, hit, block, ko |
| `src/game/render/animDirector.ts` | Resolve clip from `FighterState` |
| `src/game/render/fighterRenderer.ts` | Draw articulated fighter + NFT face |
| `src/game/render/stageRenderer.ts` | Stage plate + parallax (phase 2) |
| `src/game/render/index.ts` | Public API for engine |

**Engine stays sim-only**; drawing leaves `drawFighter` glue only.

---

## 3. Animation model (Phase 1 — ship now)

### 3.1 Procedural keyframe body (required)

- 2D side-view stick-rig with filled limbs (torso, head, upper/lower arms, thighs, calves, feet)  
- Keyframes per clip; linear / smoothstep blend between keys  
- Attack clips use `attackFrame / frames` from active move  
- Idle: breathing + weight shift  
- Walk: driven by `|vx|` or walk intent later  

### 3.2 NFT identity plate

- Use existing `loadNftSprite` plate as **head / upper torso decal** only  
- Circular/soft mask on head region  
- Palette colors from fighter `color` / `color2` for suit  

### 3.3 Move mapping

| Engine `attackKind` | Clip | Notes |
|---------------------|------|--------|
| punch | `punch` | Lead arm extend, torso twist |
| kick | `kick` | Front leg high |
| special | `special` | Charge + forward burst pose |
| secret / super | `secret` | Bigger windup, afterimage |
| dash | `dash` | Low lean |
| hitstun | `hit` | Recoil |
| blocking | `block` | Guard arms |
| dead | `ko` | Collapse |
| crouch | `crouch` | |
| jump | `jump` | |

---

## 4. Phases (honest roadmap)

### Phase 1 — Foundation ✅ shipped
- [x] Plan doc  
- [x] Pose library + anim director + fighter renderer  
- [x] Engine uses renderer (replace plate-as-body)  
- [x] True 2D high-DPI pipeline (`true2dCanvas` + `stageRenderer`)  
- [x] Walk clips, floor reflection, volumetric limbs  
- [x] Build green  
 

### Phase 2 — Move fidelity
- [x] Afterimages on special/secret/dash  
- [x] Hitstop (impact freeze) + screen shake  
- [x] Active attack trails + flash  
- [x] Distinct recovery keys in punch/kick clips  

### Phase 3 — Art pipeline (real SF assets)
- [x] Multi-frame packs via `frameBake.ts` (walk 10 / idle 8 / attacks) per collection look  
- [x] Runtime bake + playback in `fighterRenderer`  
- [x] Tooling: `scripts/export-pose-preview.html` + `window.__riddleFighterPreviewWalk`  
- [x] Artist brief: canvas 256×384 per frame, transparent PNG (see export-pose-preview.html)  
- [ ] Optional hand-painted replacement sheets drop-in (same cell size)  

### Phase 4 — Stages
- [x] Parallax drift + floor plane + reflection strip  
- [x] Crowd silhouettes + mid haze  
- [x] KO / finish flash grade  
- [ ] PERFECT card sprite (optional polish)  

### Phase 5 — Juice
- [x] Super freeze + desat background  
- [x] Victory pose + WINNER banner on match_end  
- [x] Smooth facing turn + walkSpeed gait  
- [x] Immersive fullscreen fight shell  


---

## 5. Non-goals / anti-shortcuts

- ❌ More blur/glow on the same portrait card  
- ❌ “Fake” 8-bit filter as a style fix  
- ❌ Hardcoding one hero sprite for all NFTs without identity plate  
- ❌ Shipping Phase 3 art before Phase 1 poses read on device  

---

## 6. Acceptance criteria (Phase 1)

1. Idle fighters read as **side-view humans**, feet on ground  
2. Punch and kick **visibly different** silhouettes  
3. Crouch / jump change pose, not only Y  
4. NFT still visible on face plate when loaded  
5. `npm run build` passes  
6. 60fps target on mid phone (procedural only — no huge GPU cost)  

---

## 7. Verification

```bash
cd riddle-fighter
npm run build
npm run dev
# Start CPU fight — confirm poses, not floating portraits
```
