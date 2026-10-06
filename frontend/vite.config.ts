import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaManifest } from './src/pwa/manifest.js';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: pwaManifest,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      },
    }),
  ],
  optimizeDeps: {
    // maplibre-gl ships its own worker bundle; pre-bundling it breaks the
    // worker URL resolution ("Worker failed to load") in dev mode.
    exclude: ['maplibre-gl'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setupTests.ts'],
    globals: true,
  },
});
