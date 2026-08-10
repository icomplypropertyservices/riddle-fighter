# Riddle Fighter

**Standalone full game** — Street Fighter–style **HD NFT arena** for the Riddle suite.

- **URL:** https://fighter.riddlewallet.com  
- **Stack:** Vite + React + canvas (**smooth HD**, not 8-bit) + PeerJS online + PWA  
- **Characters:** Built from owned XRPL NFTs (Inquiry gods, Inquisition humans, traits → stats + moves)  
- **Credits:** suite SSOT only — **wagers & tournament entry** (lock / settle / refund)

## Modes

| Mode | Description |
|------|-------------|
| **Vs Computer** | AI opponent · optional @handle stand-in |
| **Local 2P** | Same device · dual touch pads · WASD vs arrows |
| **Online** | Host room code · guest joins · live multiplayer |
| **Tournament** | 4/8 single-elim · suite credit entry pot · 10% cut |

## Match features

- Best-of rounds (first to 1 / 2 / 3)
- **Punch · kick · block · special (50 meter)**
- **Secret supers (100 meter + ↓↘→ + P)** — unique per NFT archetype
- **Secondary super (75 meter + ←↙↓ + K)**
- Dash (forward/back + SP, 20 meter)
- HD NFT sprites (384 bake, smooth scale) + painted stages
- Suite credit match wagers (optional)
- Wins / losses / history
- Mobile-first touch controls + landscape layout
- Installable PWA

### Secret / special inputs

| Move | Meter | Input |
|------|-------|--------|
| Special | 50 | **SP** (or ↓↘→ + SP) |
| Dash | 20 | Hold ←/→ + **SP** |
| Super | 75 | **← ↙ ↓** then **K** |
| **Secret** | **100** | **↓ ↘ →** then **P** (or SP) |

Move names (and many stats) come from NFT traits when present (`RF Special Name`, `RF Super Name`, Power, Defense, Element, …).

## Dev

```bash
cd riddle-fighter
npm install
npm run dev    # http://localhost:5190
npm run build
```

## Deploy (live)

| | |
|--|--|
| **Production** | https://fighter.riddlewallet.com |
| **Vercel alias** | https://riddle-fighter.vercel.app |
| **Project** | `icomplypropertyservices-projects/riddle-fighter` |

```bash
cd riddle-fighter
npx vercel --prod --yes --scope icomplypropertyservices-projects
```

Wallet hub → **Fighter** tile opens this app (not Reborn dash).
