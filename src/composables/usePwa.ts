import { ref } from 'vue'

export const offlineReady = ref(false)
export const needRefresh = ref(false)
let updater: ((reload?: boolean) => Promise<void>) | undefined

export async function registerPwa() {
  if (import.meta.env.DEV || import.meta.env.VITE_TARGET === 'desktop') return
  const { registerSW } = await import('virtual:pwa-register')
  updater = registerSW({
    immediate: true,
    onOfflineReady: () => (offlineReady.value = true),
    onNeedRefresh: () => (needRefresh.value = true),
    onRegisteredSW: (_url, reg) => {
      if (reg?.active) offlineReady.value = true
    },
  })
}

export function applyUpdate() {
  return updater?.(true)
}
