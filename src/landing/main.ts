import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { i18n, i18nReady } from '@/i18n'
import Landing from './Landing.vue'
import '../style.css'

i18nReady.then(() => createApp(Landing).use(createPinia()).use(i18n).mount('#landing'))
