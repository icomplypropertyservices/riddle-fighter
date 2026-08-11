import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*'],
      manifest: {
        name: 'Riddle Fighter',
        short_name: 'Fighter',
        description:
          'Street Fighter–style NFT arena — 32-bit, mobile-first. Wager suite credits · find @handles.',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        id: 'riddle-fighter',
        categories: ['games', 'entertainment'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Bump cache so phones drop stale SW that kept ghost session UI
        cacheId: 'riddle-fighter-2026-08-04-identity-ssot-v2',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@riddle/suite-chrome/css': fileURLToPath(
        new URL('./packages/suite-chrome/src/suite-chrome.css', import.meta.url),
      ),
      '@riddle/suite-chrome': fileURLToPath(
        new URL('./packages/suite-chrome/src/index.ts', import.meta.url),
      ),
      '@riddle/suite-credits': fileURLToPath(
        new URL('./packages/suite-credits/src/index.ts', import.meta.url),
      ),
      '@riddle/suite-game-economy': fileURLToPath(
        new URL('./packages/suite-game-economy/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5190,
    host: true,
  },
  optimizeDeps: {
    include: [],
    exclude: [
      '@riddle/suite-chrome',
      '@riddle/suite-credits',
      '@riddle/suite-game-economy',
    ],
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
  },
})
