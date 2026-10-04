<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/lib/markdown'

const props = defineProps<{ text?: string }>()
const html = computed(() => renderMarkdown(props.text ?? ''))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown escapes the source, so only its own tags get through -->
  <div class="md" v-html="html" />
</template>

<style scoped>
.md :deep(p + p),
.md :deep(p + ul),
.md :deep(p + ol),
.md :deep(ul + p),
.md :deep(ol + p) {
  margin-top: 0.5em;
}
.md :deep(ul) {
  list-style: disc;
  padding-left: 1.25em;
}
.md :deep(ol) {
  list-style: decimal;
  padding-left: 1.25em;
}
.md :deep(strong) {
  font-weight: 600;
  color: var(--foreground);
}
.md :deep(code) {
  border-radius: 0.25rem;
  background: var(--muted);
  padding: 0 0.3em;
  font-family: var(--font-mono);
  font-size: 0.9em;
}
.md :deep(a) {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
