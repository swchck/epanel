import { fileURLToPath, URL } from 'node:url'
import { readFileSync, rmSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const desktop = process.env.VITE_TARGET === 'desktop'
// GitHub Pages serves a project site under /<repo>/; CI sets BASE_PATH accordingly
const base = desktop ? '/' : (process.env.BASE_PATH ?? '/')
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const page = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// The locale messages and the zod parser are dynamic imports, so the browser would only discover them
// after main.js runs. Preloading them from the HTML saves that round trip on every cold start.
function preloadStartupChunks(): Plugin {
  const locales = ['ru', 'en', 'sr', 'es']
  return {
    name: 'preload-startup-chunks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        const chunks = Object.values(ctx.bundle).flatMap((c) => (c.type === 'chunk' ? [c] : []))
        const url = (file: string) => base + file
        // compiled locale chunks get anonymous virtual ids, so they are told apart by one of their strings
        const files: Record<string, string> = {}
        for (const l of locales) {
          const marker = (JSON.parse(readFileSync(page(`./src/i18n/${l}.json`), 'utf8')) as { common: { loading: string } }).common.loading
          const chunk = chunks.find((c) => c.fileName.includes('intlify') && c.code.includes(marker))
          if (chunk) files[l] = url(chunk.fileName)
        }
        const parser = chunks.find((c) => c.moduleIds.some((m) => m.endsWith('/src/domain/bundle.ts')))
        const pick = `(function(){var f=${JSON.stringify(files)},l;try{l=localStorage.getItem('panel.locale')}catch(e){}l=f[l]?l:(navigator.language||'').slice(0,2);if(!f[l])l='ru';var e=document.createElement('link');e.rel='modulepreload';e.href=f[l];document.head.appendChild(e)})()`
        const tags = [`<script>${pick}</script>`, parser ? `<link rel="modulepreload" href="${url(parser.fileName)}">` : '']
        return html.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`)
      },
    },
  }
}

export default defineConfig({
  // the desktop build serves the app page as its root, so Tauri finds index.html where it expects it
  root: desktop ? 'app' : undefined,
  publicDir: desktop ? page('./public/app') : page('./public'),
  envDir: page('.'),
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // set by GitHub Actions; the landing page links releases and the source from it
    __REPO_URL__: JSON.stringify(process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : (process.env.REPO_URL ?? '')),
  },
  plugins: [
    {
      // the desktop editor opens files; it must never ship whatever data the website currently publishes
      name: 'strip-published-data',
      apply: 'build',
      closeBundle() {
        if (desktop) rmSync(page('./dist-desktop/panel.enc.json'), { force: true })
      },
    },
    preloadStartupChunks(),
    {
      // icons and the PWA manifest live next to the landing page; the desktop shell has neither
      name: 'desktop-head',
      apply: () => desktop,
      transformIndexHtml: (html) => html.replace(/\s*<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g, ''),
    },
    vue(),
    // messages compiled at build time: the runtime-only vue-i18n ships no message compiler
    VueI18nPlugin({ include: [page('./src/i18n/*.json')], runtimeOnly: true, compositionOnly: true, fullInstall: false }),
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}', 'app/demo*.panel'],
        // offline matters for the panel itself: PDF import is editor-only (pdf.js and its 1.2 MB worker),
        // and font subsets for scripts the four locales don't use would only bloat the first install
        globIgnores: ['**/pdf.worker*', '**/pdf-*.js', '**/*-{greek,greek-ext,vietnamese,cyrillic-ext}-*.woff2', 'index.html', '**/landing-*'],
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
  server: { port: Number(process.env.PORT) || (desktop ? 5181 : 5180), strictPort: true },
  build: {
    outDir: desktop ? page('./dist-desktop') : page('./dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: desktop ? { app: page('./app/index.html') } : { landing: page('./index.html'), app: page('./app/index.html') },
    },
  },
})
