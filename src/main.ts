import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n, i18nReady } from './i18n'
import { router } from './router'
import { registerPwa } from './composables/usePwa'
import './style.css'

i18nReady.then(() => createApp(App).use(createPinia()).use(router).use(i18n).mount('#app'))
registerPwa()
