import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// base, start_url and scope must never change: the URL is where each person's data lives.
const BASE = '/lift-log/';

export default defineConfig({
  base: BASE,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered from src/pwa/register.ts, which shows the "Updated – tap to reload" toast instead of reloading.
      injectRegister: false,
      // globPatterns below already precaches every icon in public/.
      includeManifestIcons: false,
      manifest: {
        name: 'Lift Log',
        short_name: 'Lift Log',
        description: 'An offline training log for lifting and running.',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        // Placeholder colors from src/styles/tokens.css (light --bg) until DESIGN.md exists.
        theme_color: '#f4f4f2',
        background_color: '#f4f4f2',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        // Precache the whole app shell so it runs fully offline. User data lives only in IndexedDB.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        cleanupOutdatedCaches: true,
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
