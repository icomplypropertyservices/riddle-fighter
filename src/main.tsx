import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
/* CSS load order: base styles → castle SSOT tokens → arena shell once → game UI lightly */
import './styles.css'
import './castle-tokens.css'
import './shell/medieval-arena.css'
import './game-ui.css'
import './fighter-dash.css'
import './tournament-board.css'
import { preloadAllStages, preloadKoFx } from './lib/stageAssets'
import { ensureFramePacksBaked, compositeWalkStrip } from './game/render/frameBake'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

// Suite bottom nav clearance: body flag + .has-suite-chrome on shell
document.body.classList.add('has-suite-chrome')

// Warm multi-frame walk/attack packs + expose artist preview hook
void ensureFramePacksBaked()
if (typeof window !== 'undefined') {
  ;(
    window as unknown as {
      __riddleFighterPreviewWalk?: (id: string) => HTMLCanvasElement | null
    }
  ).__riddleFighterPreviewWalk = (id: string) => {
    void ensureFramePacksBaked()
    return compositeWalkStrip(id as never)
  }
}

// Warm painted arena art ASAP for first fight
preloadAllStages()
void preloadKoFx()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA register (vite-plugin-pwa)
void import('virtual:pwa-register')
  .then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
  .catch(() => {
    /* plugin optional in plain preview */
  })
