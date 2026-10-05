<script setup lang="ts">
import { computed } from 'vue'
import { useOnline } from '@vueuse/core'
import { CloudCheck, WifiOff } from '@lucide/vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { offlineReady } from '@/composables/usePwa'
import { useText } from '@/composables/useText'

const online = useOnline()
const { t } = useText()
const state = computed(() => (!online.value ? 'offline' : offlineReady.value ? 'ready' : null))
</script>

<!-- an icon with a tooltip: the sidebar footer has no room for the label next to the other controls -->
<template>
  <Tooltip v-if="state">
    <TooltipTrigger as-child>
      <span
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-full"
        :class="state === 'offline' ? 'bg-warn/15 text-warn' : 'bg-ok/12 text-ok'"
        role="status"
        :aria-label="t(state === 'offline' ? 'pwa.offline' : 'pwa.ready')"
      >
        <component :is="state === 'offline' ? WifiOff : CloudCheck" class="size-3.5" />
      </span>
    </TooltipTrigger>
    <TooltipContent side="top">
      <div class="font-medium">{{ t(state === 'offline' ? 'pwa.offline' : 'pwa.ready') }}</div>
      <div v-if="state === 'ready'" class="max-w-56 text-xs opacity-80">{{ t('pwa.readyHint') }}</div>
    </TooltipContent>
  </Tooltip>
</template>
