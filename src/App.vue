<script setup lang="ts">
import { onMounted, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import 'vue-sonner/style.css'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import AppShell from '@/components/common/AppShell.vue'
import SplashScreen from '@/components/common/SplashScreen.vue'
import UnlockView from '@/views/UnlockView.vue'
import StartView from '@/views/StartView.vue'
import NotPublishedView from '@/views/NotPublishedView.vue'
import { useTheme } from '@/composables/useTheme'
import { useData } from '@/stores/data'
import { confirmAction, isDesktop, onOpenFile, viewerOnly } from '@/platform'
import { i18n } from '@/i18n'
import { tr } from '@/domain/model'

useTheme()
const data = useData()
const router = useRouter()
const route = useRoute()
const overlayTitlebar = document.documentElement.dataset.titlebar === 'overlay'

watchEffect(() => {
  const title = tr(data.data?.meta.title, i18n.global.locale.value)
  document.title = title || i18n.global.t('app.name')
})

onMounted(async () => {
  await router.isReady()
  const { k, demo, ...rest } = route.query
  const key = typeof k === 'string' && k ? k : undefined
  // the password from a QR code must not linger in the address bar or history, not even while PBKDF2 runs
  if (key) await router.replace({ path: route.path, query: { ...rest, ...(demo !== undefined ? { demo } : {}) } })
  await data.init({ key, demo: viewerOnly || demo === undefined ? false : typeof demo === 'string' && demo ? demo : true })
  if (isDesktop) onOpenFile(openFromOs)
})

async function openFromOs(f: { name: string; path?: string; text: string }) {
  if (data.hasDraft) {
    if (!(await confirmAction(i18n.global.t('start.replaceDraft', { name: f.name })))) return
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
    <div v-if="overlayTitlebar" data-tauri-drag-region class="no-print fixed top-0 left-0 z-[60] h-(--titlebar)" :class="data.status === 'ready' ? 'w-(--sidebar-w)' : 'right-0'" />
    <SplashScreen v-if="data.status === 'idle' || data.status === 'loading'" />
    <UnlockView v-else-if="data.status === 'locked'" />
    <template v-else-if="data.status === 'empty' || data.status === 'error'">
      <NotPublishedView v-if="viewerOnly" />
      <StartView v-else />
    </template>
    <AppShell v-else />
    <Toaster position="top-center" rich-colors />
  </TooltipProvider>
</template>
