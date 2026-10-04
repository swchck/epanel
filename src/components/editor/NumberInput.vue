<script setup lang="ts">
import { ref, watch } from 'vue'
import { Input } from '@/components/ui/input'

const model = defineModel<number | undefined>()
const props = defineProps<{
  // empty input clears the value; otherwise an empty field keeps the last valid number
  optional?: boolean
  allowZero?: boolean
  integer?: boolean
  max?: number
  placeholder?: string
  suffix?: string
}>()

const text = ref(String(model.value ?? ''))
watch(model, (v) => {
  if (parse(text.value) !== v) text.value = String(v ?? '')
})

function parse(s: string): number | undefined | null {
  const t = s.replace(',', '.').trim()
  if (t === '') return props.optional ? undefined : null
  let n = Number(t)
  if (!Number.isFinite(n)) return null
  if (props.integer) n = Math.round(n)
  if (props.max !== undefined) n = Math.min(props.max, n)
  return n > 0 || (props.allowZero && n === 0) ? n : null
}

function update(v: string | number) {
  text.value = String(v)
  const n = parse(text.value)
  if (n !== null) model.value = n
}
</script>

<template>
  <div class="relative">
    <Input
      :model-value="text"
      inputmode="decimal"
      :placeholder="placeholder"
      :class="suffix ? 'pr-10' : ''"
      :aria-invalid="parse(text) === null || undefined"
      @update:model-value="update"
      @blur="text = String(model ?? '')"
    />
    <span v-if="suffix" class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{{ suffix }}</span>
  </div>
</template>
