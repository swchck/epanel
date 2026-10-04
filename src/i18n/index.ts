import { createI18n } from 'vue-i18n'
import { LOCALES, type Locale } from '@/domain/schema'
import en from './en.json'
import es from './es.json'
import ru from './ru.json'
import sr from './sr.json'

const STORAGE = 'panel.locale'

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE) as Locale | null
    if (saved && LOCALES.includes(saved)) return saved
  } catch {
    // storage blocked
  }
  const nav = (navigator.language || 'ru').slice(0, 2) as Locale
  return LOCALES.includes(nav) ? nav : 'ru'
}

export const LOCALE_NAMES: Record<Locale, string> = { ru: 'Русский', en: 'English', sr: 'Srpski', es: 'Español' }

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: ['en', 'ru'],
  messages: { ru, en, sr, es },
  missingWarn: false,
  fallbackWarn: false,
})

export function setLocale(l: Locale) {
  i18n.global.locale.value = l
  document.documentElement.lang = l
  try {
    localStorage.setItem(STORAGE, l)
  } catch {
    // storage blocked
  }
}
