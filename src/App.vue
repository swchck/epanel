<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import 'vue-sonner/style.css'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import AppShell from '@/components/common/AppShell.vue'
import SplashScreen from '@/components/common/SplashScreen.vue'
import UnlockView from '@/views/UnlockView.vue'
import StartView from '@/views/StartView.vue'
import { useTheme } from '@/composables/useTheme'
import { useData } from '@/stores/data'
import { isDesktop, onOpenFile } from '@/platform'

useTheme()
const data = useData()
const router = useRouter()
const route = useRoute()

onMounted(async () => {
  await router.isReady()
  const { k, demo, ...rest } = route.query
  const key = typeof k === 'string' && k ? k : undefined
  await data.init({ key, demo: demo === undefined ? false : typeof demo === 'string' && demo ? demo : true })
  // the password from a QR code must not linger in the address bar or history
  if (key) await router.replace({ path: route.path, query: { ...rest, ...(demo !== undefined ? { demo } : {}) } })
  if (isDesktop) onOpenFile(openFromOs)
})

async function openFromOs(f: { name: string; path?: string; text: string }) {
  if (data.hasDraft) {
    const { ask } = await import('@tauri-apps/plugin-dialog')
    if (!(await ask(f.name, { title: '⚠', kind: 'warning' }))) return
  }
  const r = await data.loadText(f.text, { name: f.name, path: f.path })
  if (r.ok) return router.push('/')
  if (r.reason === 'needs-password') {
    data.pendingFile = f
    data.status = 'empty'
  }
}
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <SplashScreen v-if="data.status === 'idle' || data.status === 'loading'" />
    <UnlockView v-else-if="data.status === 'locked'" />
    <StartView v-else-if="data.status === 'empty' || data.status === 'error'" />
    <AppShell v-else />
    <Toaster position="top-center" rich-colors />
  </TooltipProvider>
</template>
