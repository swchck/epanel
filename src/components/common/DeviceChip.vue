<script setup lang="ts">
import type { Device } from '@/domain/model'
import { TYPE_ACCENT } from '@/components/panel/geometry'

defineProps<{ device: Pick<Device, 'id' | 'type'>; size?: 'sm' | 'md' | 'lg' }>()
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-card font-mono font-semibold"
    :class="size === 'lg' ? 'px-2.5 py-1 text-base' : size === 'sm' ? 'px-1.5 py-0 text-[11px]' : 'px-2 py-0.5 text-xs'"
  >
    <span class="size-2 rounded-full" :style="{ background: TYPE_ACCENT[device.type] }" />
    {{ device.id }}
  </span>
</template>
