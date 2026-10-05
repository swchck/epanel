import { computed, ref, watchEffect } from 'vue'

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

export const isDark = computed(() => mode.value === 'dark' || (mode.value === 'auto' && systemDark.value))

// read back from the CSS tokens rather than hardcoded, so the browser bar can't drift from the page;
// a 1px canvas turns oklch() into the sRGB hex that theme-color is safe with everywhere
function pageColor(): string | null {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor
  ctx.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

watchEffect(() => {
  const dark = isDark.value
  document.documentElement.classList.toggle('dark', dark)
  // scrollbars and form controls follow the chosen theme, not only the system one from the meta tag
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  const color = pageColor()
  // the static tags carry media queries for the first paint; a chosen theme overrides both of them
  if (color) for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', color)
  try {
    localStorage.setItem(STORAGE, mode.value)
  } catch {
    // storage blocked
  }
})

export function useTheme() {
  return { mode }
}
