<script setup lang="ts">
import { MapPin } from '@lucide/vue'
import DeviceChip from '@/components/common/DeviceChip.vue'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'
import MarkdownText from '@/components/common/MarkdownText.vue'

defineProps<{ title?: string; hint?: string }>()
const data = useData()
const { t, tx } = useText()
</script>

<template>
  <section v-if="data.outside.length" class="rounded-2xl border bg-card p-4">
    <h2 class="flex items-center gap-2 text-sm font-medium"><MapPin class="size-4 text-primary" /> {{ title ?? t('panel.outside.title') }}</h2>
    <p v-if="hint" class="mt-1 text-sm text-muted-foreground">{{ hint }}</p>
    <ul class="mt-3 space-y-3">
      <li v-for="dev in data.outside" :key="dev.id">
        <RouterLink :to="`/d/${dev.id}`" class="group block">
          <div class="flex items-center gap-2">
            <DeviceChip :device="dev" size="sm" />
            <span class="min-w-0 truncate text-sm font-medium group-hover:underline">{{ tx(dev.label) || t(`device.type.${dev.type}`) }}</span>
          </div>
          <MarkdownText :text="tx(dev.location)" class="mt-1 text-sm text-muted-foreground" />
          <p v-if="dev.serial" class="mt-0.5 font-mono text-xs text-muted-foreground">№ {{ dev.serial }}</p>
        </RouterLink>
      </li>
    </ul>
    <p v-if="data.data?.supply.account" class="mt-3 border-t pt-3 text-sm">
      {{ t('panel.outside.account') }} <span class="font-mono">{{ data.data.supply.account }}</span>
    </p>
  </section>
</template>
