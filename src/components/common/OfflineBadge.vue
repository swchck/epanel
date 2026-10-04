<script setup lang="ts">
import { useOnline } from '@vueuse/core'
import { CloudCheck, WifiOff } from '@lucide/vue'
import { offlineReady } from '@/composables/usePwa'

const online = useOnline()
</script>

<template>
  <span
    v-if="!online"
    class="inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-2 py-1 text-[11px] font-medium text-warn"
  >
    <WifiOff class="size-3.5" />{{ $t('pwa.offline') }}
  </span>
  <span
    v-else-if="offlineReady"
    class="inline-flex items-center gap-1.5 rounded-full bg-ok/12 px-2 py-1 text-[11px] font-medium text-ok"
    :title="$t('pwa.readyHint')"
  >
    <CloudCheck class="size-3.5" />{{ $t('pwa.ready') }}
  </span>
</template>
