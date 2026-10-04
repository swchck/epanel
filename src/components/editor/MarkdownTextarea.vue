<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Bold, Eye, Italic, Link, List, ListOrdered, Pencil } from '@lucide/vue'
import MarkdownText from '@/components/common/MarkdownText.vue'
import { useText } from '@/composables/useText'

const model = defineModel<string>({ default: '' })
defineProps<{ placeholder?: string; rows?: number; id?: string }>()
const { t } = useText()
const area = ref<HTMLTextAreaElement>()
const preview = ref(false)

async function apply(edit: (text: string, start: number, end: number) => { text: string; start: number; end: number }) {
  const el = area.value
  if (!el) return
  const r = edit(model.value, el.selectionStart, el.selectionEnd)
  model.value = r.text
  await nextTick()
  el.focus()
  el.setSelectionRange(r.start, r.end)
}

function wrap(mark: string, fallback: string) {
  void apply((text, start, end) => {
    const inner = text.slice(start, end) || fallback
    return { text: text.slice(0, start) + mark + inner + mark + text.slice(end), start: start + mark.length, end: start + mark.length + inner.length }
  })
}

function prefixLines(numbered: boolean) {
  void apply((text, start, end) => {
    const from = text.lastIndexOf('\n', start - 1) + 1
    const lines = text.slice(from, end).split('\n')
    const out = lines.map((l, i) => (numbered ? `${i + 1}. ` : '- ') + l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')).join('\n')
    return { text: text.slice(0, from) + out + text.slice(end), start: from, end: from + out.length }
  })
}

function link() {
  void apply((text, start, end) => {
    const label = text.slice(start, end) || t('editor.md.linkText')
    const md = `[${label}](https://)`
    const urlAt = start + label.length + 3
    return { text: text.slice(0, start) + md + text.slice(end), start: urlAt, end: urlAt + 8 }
  })
}

const TOOLS = [
  { key: 'bold', icon: Bold, run: () => wrap('**', t('editor.md.boldText')) },
  { key: 'italic', icon: Italic, run: () => wrap('*', t('editor.md.italicText')) },
  { key: 'list', icon: List, run: () => prefixLines(false) },
  { key: 'numbered', icon: ListOrdered, run: () => prefixLines(true) },
  { key: 'link', icon: Link, run: link },
] as const

function onKey(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey)) return
  if (e.key === 'b') {
    e.preventDefault()
    wrap('**', t('editor.md.boldText'))
  } else if (e.key === 'i') {
    e.preventDefault()
    wrap('*', t('editor.md.italicText'))
  }
}
</script>

<template>
  <div class="rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
    <div class="flex items-center gap-0.5 border-b border-input px-1 py-0.5">
      <button
        v-for="tool in TOOLS"
        :key="tool.key"
        type="button"
        class="grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
        :title="t(`editor.md.${tool.key}`)"
        :aria-label="t(`editor.md.${tool.key}`)"
        :disabled="preview"
        @click="tool.run()"
      >
        <component :is="tool.icon" class="size-3.5" />
      </button>
      <button
        type="button"
        class="ml-1 inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
        :class="{ 'bg-accent text-foreground': preview }"
        :aria-pressed="preview"
        @click="preview = !preview"
      >
        <component :is="preview ? Pencil : Eye" class="size-3.5" /> {{ t(preview ? 'editor.md.edit' : 'editor.md.preview') }}
      </button>
      <div class="ml-auto"><slot name="actions" /></div>
    </div>
    <MarkdownText v-if="preview" :text="model" class="min-h-16 px-2.5 py-2 text-sm" />
    <textarea
      v-else
      :id="id"
      ref="area"
      v-model="model"
      :rows="rows ?? 3"
      :placeholder="placeholder"
      class="field-sizing-content block min-h-16 w-full resize-y bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground md:text-sm"
      @keydown="onKey"
    />
  </div>
</template>
