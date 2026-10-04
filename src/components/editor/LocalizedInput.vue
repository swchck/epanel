<script setup lang="ts">
import { computed, ref } from 'vue'
import { Languages } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LOCALES, type Locale, type LocalizedText } from '@/domain/model'
import { useText } from '@/composables/useText'

const model = defineModel<LocalizedText | undefined>()
const props = defineProps<{ multiline?: boolean; placeholder?: string; id?: string }>()
const { locale, t } = useText()
const expanded = ref(typeof model.value === 'object' && model.value !== null && Object.keys(model.value).length > 1)

function get(l: Locale): string {
  const v = model.value
  if (v === undefined) return ''
  if (typeof v === 'string') return l === locale.value ? v : ''
  return v[l] ?? ''
}

function set(l: Locale, value: string) {
  const v = model.value
  if (!expanded.value && (v === undefined || typeof v === 'string')) {
    model.value = value
    return
  }
  const obj: Partial<Record<Locale, string>> = typeof v === 'string' ? { [locale.value as Locale]: v } : { ...(v ?? {}) }
  if (value) obj[l] = value
  else delete obj[l]
  model.value = obj
}

const current = computed({
  get: () => {
    const v = model.value
    if (typeof v === 'string') return v
    return get(locale.value as Locale)
  },
  set: (s: string) => set(locale.value as Locale, s),
})

function toggle() {
  expanded.value = !expanded.value
  if (expanded.value && typeof model.value === 'string' && model.value) model.value = { [locale.value]: model.value }
}
</script>

<template>
  <div class="space-y-1.5">
    <div class="relative">
      <template v-if="!expanded">
        <Textarea v-if="props.multiline" :id="id" v-model="current" rows="2" :placeholder="placeholder" class="pr-9" />
        <Input v-else :id="id" v-model="current" :placeholder="placeholder" class="pr-9" />
      </template>
      <div v-else class="space-y-1.5">
        <div v-for="l in LOCALES" :key="l" class="flex items-center gap-2">
          <span class="w-6 font-mono text-[11px] text-muted-foreground uppercase">{{ l }}</span>
          <Textarea v-if="props.multiline" :model-value="get(l)" rows="2" class="flex-1" @update:model-value="(v) => set(l, String(v))" />
          <Input v-else :model-value="get(l)" class="flex-1" @update:model-value="(v) => set(l, String(v))" />
        </div>
      </div>
      <button
        type="button"
        class="absolute top-1.5 right-1.5 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        :class="{ 'static float-right mt-1': expanded, 'text-primary': expanded }"
        :title="t('editor.translations')"
        @click="toggle"
      >
        <Languages class="size-4" />
      </button>
    </div>
  </div>
</template>
