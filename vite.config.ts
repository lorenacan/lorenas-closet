import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: "Lorena's Closet",
        short_name: "Lorena's Closet",
        description: 'Armario digital y generador de looks',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5_000_000,
        // El modelo de recorte de fondo se descarga una vez y queda disponible sin conexión
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/staticimgly\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'bg-removal-model', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 60 } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
