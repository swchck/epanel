<script setup lang="ts">
import { computed, ref } from 'vue'
import { Languages } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { LOCALES, type Locale, type LocalizedText } from '@/domain/model'
import { LOCALE_NAMES } from '@/i18n'
import { useText } from '@/composables/useText'
import MarkdownTextarea from './MarkdownTextarea.vue'

const model = defineModel<LocalizedText | undefined>()
const props = defineProps<{ multiline?: boolean; placeholder?: string; id?: string }>()
const { locale, t } = useText()
const open = ref(false)

function get(l: Locale): string {
  const v = model.value
  if (v === undefined) return ''
  if (typeof v === 'string') return l === locale.value ? v : ''
  return v[l] ?? ''
}

// a plain string stays a plain string until a second language is filled in, so untranslated files stay simple
function set(l: Locale, value: string) {
  const v = model.value
  if ((v === undefined || typeof v === 'string') && l === locale.value) {
    model.value = value || undefined
    return
  }
  const obj: Partial<Record<Locale, string>> = typeof v === 'string' ? { [locale.value as Locale]: v } : { ...(v ?? {}) }
  if (value) obj[l] = value
  else delete obj[l]
  const keys = Object.keys(obj) as Locale[]
  model.value = keys.length === 0 ? undefined : keys.length === 1 && keys[0] === locale.value ? obj[keys[0]] : obj
}

const current = computed({
  get: () => get(locale.value as Locale),
  set: (s: string) => set(locale.value as Locale, s),
})
const filled = computed(() => LOCALES.filter((l) => get(l)).length)
</script>

<template>
  <div class="relative">
    <MarkdownTextarea v-if="props.multiline" :id="id" v-model="current" :placeholder="placeholder">
      <template #actions>
        <button
          type="button"
          class="flex h-6 items-center gap-1 rounded-md px-1.5 font-mono text-[11px] leading-none text-muted-foreground transition hover:bg-accent hover:text-foreground"
          :class="{ 'text-primary': filled > 1 }"
          :title="t('editor.translations')"
          :aria-label="t('editor.translations')"
          @click="open = true"
        >
          <Languages class="size-3.5" />
          {{ filled }}/{{ LOCALES.length }}
        </button>
      </template>
    </MarkdownTextarea>
    <template v-else>
      <Input :id="id" v-model="current" :placeholder="placeholder" class="pr-16" />
      <button
        type="button"
        class="absolute top-1/2 right-1.5 flex h-6 -translate-y-1/2 items-center gap-1 rounded-md px-1.5 font-mono text-[11px] leading-none text-muted-foreground transition hover:bg-accent hover:text-foreground"
        :class="{ 'text-primary': filled > 1 }"
        :title="t('editor.translations')"
        :aria-label="t('editor.translations')"
        @click="open = true"
      >
        <Languages class="size-3.5" />
        {{ filled }}/{{ LOCALES.length }}
      </button>
    </template>

    <Dialog v-model:open="open">
      <DialogContent class="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ t('editor.translations') }}</DialogTitle>
          <DialogDescription>{{ t('editor.translationsHint') }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div v-for="l in LOCALES" :key="l" class="space-y-1">
            <span class="flex items-center gap-2 text-xs text-muted-foreground">
              <span class="font-mono uppercase">{{ l }}</span> {{ LOCALE_NAMES[l] }}
            </span>
            <MarkdownTextarea v-if="props.multiline" :model-value="get(l)" :rows="2" @update:model-value="(v) => set(l, v)" />
            <Input v-else :model-value="get(l)" @update:model-value="(v) => set(l, String(v))" />
          </div>
        </div>
        <DialogFooter>
          <Button @click="open = false">{{ t('common.done') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
