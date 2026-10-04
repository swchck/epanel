<script setup lang="ts">
import { Input } from '@/components/ui/input'

const model = defineModel<number | undefined>()
defineProps<{ min?: number; max?: number; step?: number; placeholder?: string; suffix?: string }>()

function update(v: string | number) {
  const s = String(v).replace(',', '.').trim()
  model.value = s === '' || Number.isNaN(Number(s)) ? undefined : Number(s)
}
</script>

<template>
  <div class="relative">
    <Input :model-value="model ?? ''" inputmode="decimal" :placeholder="placeholder" :class="suffix ? 'pr-10' : ''" @update:model-value="update" />
    <span v-if="suffix" class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{{ suffix }}</span>
  </div>
</template>
