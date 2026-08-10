import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './game-ui.css'
import './fighter-dash.css'
import { preloadAllStages, preloadKoFx } from './lib/stageAssets'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

// Suite bottom nav clearance: body flag + .has-suite-chrome on shell
document.body.classList.add('has-suite-chrome')
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
