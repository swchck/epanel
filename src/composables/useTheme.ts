import { ref, watchEffect } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'auto'
const STORAGE = 'panel.theme'

function read(): ThemeMode {
  try {
    return (localStorage.getItem(STORAGE) as ThemeMode) || 'auto'
  } catch {
    return 'auto'
  }
}

const mode = ref<ThemeMode>(read())
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
const systemDark = ref(media?.matches ?? false)
media?.addEventListener('change', (e) => (systemDark.value = e.matches))

watchEffect(() => {
  const dark = mode.value === 'dark' || (mode.value === 'auto' && systemDark.value)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#16181d' : '#f7f5ef')
  try {
    localStorage.setItem(STORAGE, mode.value)
  } catch {
    // storage blocked
  }
})

export function useTheme() {
  return { mode }
}
