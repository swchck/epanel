<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarCheck, Images, Info, Map as MapIcon, PanelsTopLeft, Send } from '@lucide/vue'
import EditGeneral from '@/components/editor/EditGeneral.vue'
import EditMaintenance from '@/components/editor/EditMaintenance.vue'
import EditMedia from '@/components/editor/EditMedia.vue'
import EditPanel from '@/components/editor/EditPanel.vue'
import EditPlan from '@/components/editor/EditPlan.vue'
import EditPublish from '@/components/editor/EditPublish.vue'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'
import { useUi } from '@/stores/ui'

const props = defineProps<{ tab?: string }>()
const data = useData()
const ui = useUi()
const router = useRouter()
const { t } = useText()

const TABS = [
  { id: 'general', icon: Info, comp: EditGeneral },
  { id: 'panel', icon: PanelsTopLeft, comp: EditPanel },
  { id: 'plan', icon: MapIcon, comp: EditPlan },
  { id: 'media', icon: Images, comp: EditMedia },
  { id: 'maintenance', icon: CalendarCheck, comp: EditMaintenance },
  { id: 'publish', icon: Send, comp: EditPublish },
] as const

const active = computed(() => TABS.find((x) => x.id === props.tab) ?? TABS[1])

// publishing, saving or discarding ends the draft; the editor keeps going on a fresh one
watch(
  () => data.draft,
  (d) => d || data.startDraft(),
  { immediate: true },
)
ui.simulate = false
ui.clearFilters()

onBeforeUnmount(() => {
  if (data.draft && !data.hasDraft) data.discardDraft()
})
</script>

<template>
  <div class="mx-auto max-w-[1500px] px-4 pt-5 lg:px-8 lg:pt-8">
    <div class="mb-5 flex flex-wrap items-end gap-3">
      <div class="mr-auto">
        <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">{{ t('editor.title') }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('editor.subtitle') }}</p>
      </div>
      <span v-if="data.hasDraft" class="rounded-full bg-warn/15 px-3 py-1 text-xs font-medium text-warn">{{ t('editor.draftBadge') }}</span>
    </div>

    <nav class="no-print mb-6 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1">
      <button
        v-for="item in TABS"
        :key="item.id"
        class="flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition"
        :class="active.id === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
        @click="router.replace(`/edit/${item.id}`)"
      >
        <component :is="item.icon" class="size-4" />
        {{ t(`editor.tab.${item.id}`) }}
      </button>
    </nav>

    <component :is="active.comp" v-if="data.draft" :key="active.id" />
  </div>
</template>
