import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { i18n } from '@/i18n'
import Landing from './Landing.vue'
import '../style.css'

createApp(Landing).use(createPinia()).use(i18n).mount('#landing')
