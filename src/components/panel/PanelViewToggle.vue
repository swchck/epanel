<script setup lang="ts">
import { LayoutGrid, List } from '@lucide/vue'
import { useText } from '@/composables/useText'
import { useUi } from '@/stores/ui'

const ui = useUi()
const { t } = useText()
const VIEWS = [
  { id: 'visual', icon: LayoutGrid },
  { id: 'list', icon: List },
] as const
</script>

<template>
  <div class="flex w-max items-center gap-1 rounded-xl border bg-card p-1" role="radiogroup" :aria-label="t('panel.view.label')">
    <button
      v-for="v in VIEWS"
      :key="v.id"
      role="radio"
      :aria-checked="ui.panelView === v.id"
      class="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-sm transition"
      :class="ui.panelView === v.id ? 'bg-accent text-foreground ring-1 ring-foreground/15' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'"
      @click="ui.panelView = v.id"
    >
      <component :is="v.icon" class="size-4" /> {{ t(`panel.view.${v.id}`) }}
    </button>
  </div>
</template>
