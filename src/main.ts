import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n, i18nReady } from './i18n'
import { router } from './router'
import { registerPwa } from './composables/usePwa'
import './style.css'
import { isDesktop, routeExternalLinks, watchFullscreen } from './platform'

// the macOS window has no title bar (titleBarStyle: Overlay), so the page keeps the traffic lights' strip clear;
// fullscreen hides the traffic lights, and the strip goes with them
if (isDesktop && /Mac/.test(navigator.userAgent)) {
  document.documentElement.dataset.titlebar = 'overlay'
  void watchFullscreen((full) => {
    if (full) delete document.documentElement.dataset.titlebar
    else document.documentElement.dataset.titlebar = 'overlay'
  })
}

i18nReady.then(() => createApp(App).use(createPinia()).use(router).use(i18n).mount('#app'))
registerPwa()
routeExternalLinks()
