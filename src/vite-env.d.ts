/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_WALLET_URL?: string
  readonly VITE_SOCIAL_URL?: string
  readonly VITE_WORLD_URL?: string
  readonly VITE_SUITE_URL?: string
  readonly VITE_FIGHTER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
