import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
import { router } from './router'
import { registerPwa } from './composables/usePwa'
import './style.css'

createApp(App).use(createPinia()).use(router).use(i18n).mount('#app')
registerPwa()
