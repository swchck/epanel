import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const desktop = process.env.VITE_TARGET === 'desktop'
// GitHub Pages serves a project site under /<repo>/; CI sets BASE_PATH accordingly
const base = desktop ? '/' : (process.env.BASE_PATH ?? '/')
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const page = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      disable: desktop,
      registerType: 'autoUpdate',
      injectRegister: false,
      scope: `${base}app/`,
      manifest: {
        name: 'Электрощиток',
        short_name: 'Щиток',
        description: 'Interactive map of an apartment electrical panel',
        id: `${base}app/`,
        start_url: `${base}app/`,
        scope: `${base}app/`,
        display: 'standalone',
        background_color: '#16181d',
        theme_color: '#16181d',
        icons: [
          { src: `${base}icons/pwa-64x64.png`, sizes: '64x64', type: 'image/png' },
          { src: `${base}icons/pwa-192x192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/pwa-512x512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${base}icons/maskable-icon-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}', 'app/demo.panel'],
        // the PDF worker is 1.2 MB and only the editor's plan import needs it
        globIgnores: ['**/pdf.worker*'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}app/index.html`,
        navigateFallbackAllowlist: [/\/app\//],
        runtimeCaching: [
          {
            // fresh data when online, the last copy when the power (and the router) is out
            urlPattern: /panel\.enc\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'panel-data', networkTimeoutSeconds: 4, expiration: { maxEntries: 2 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: Number(process.env.PORT) || 5180, strictPort: true },
  build: {
    outDir: desktop ? 'dist-desktop' : 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: desktop ? { app: page('./app/index.html') } : { landing: page('./index.html'), app: page('./app/index.html') },
    },
  },
})
