<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Power, RotateCcw } from '@lucide/vue'
import FloorPlan from '@/components/plan/FloorPlan.vue'
import PanelEnclosure from '@/components/panel/PanelEnclosure.vue'
import { pointPowered } from '@/domain/graph'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'
import { useUi } from '@/stores/ui'

const data = useData()
const ui = useUi()
const { t, tx } = useText()
const ready = computed(() => data.status === 'ready')
const hint = ref(true)

onMounted(async () => {
  await data.init({ demo: true, prefix: 'app/' })
  ui.simulate = true
  ui.planLayers.labels = false
  // start with something switched off so the demo explains itself without a click
  ui.toggleOff('QD1')
})

const dead = computed(() => {
  if (!data.graph || !data.data) return new Set<string>()
  return new Set(data.data.points.filter((p) => !pointPowered(data.graph!, p, ui.off)).map((p) => p.id))
})
const offLabels = computed(() => [...ui.off].map((id) => data.graph?.byId.get(id)).filter(Boolean))
</script>

<template>
  <div class="mt-12 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
    <div class="relative rounded-3xl border bg-card/60 p-3 shadow-xl shadow-black/5 sm:p-4">
      <div v-if="ready">
        <PanelEnclosure />
      </div>
      <div v-else class="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
      <div
        v-if="hint && ready"
        class="absolute top-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background shadow-lg"
        @click="hint = false"
      >
        <Power class="size-3.5" /> {{ t('landing.hero.tap') }}
      </div>
    </div>
    <div class="flex flex-col gap-4">
      <div class="relative min-h-72 flex-1 overflow-hidden rounded-3xl border bg-card">
        <FloorPlan v-if="ready" :interactive="false" :dead-points="dead" :show-routes="false" />
      </div>
      <div class="rounded-2xl border bg-card p-4 text-sm">
        <div class="flex items-center gap-2 font-medium">
          <span class="relative flex size-2.5"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" /><span class="relative inline-flex size-2.5 rounded-full bg-live" /></span>
          {{ t('landing.hero.live', { n: dead.size }) }}
        </div>
        <div v-if="offLabels.length" class="mt-2 flex flex-wrap gap-1.5">
          <button v-for="d in offLabels" :key="d!.id" class="rounded-md border px-2 py-0.5 text-xs hover:bg-accent" @click="ui.toggleOff(d!.id)">
            <b class="font-mono">{{ d!.id }}</b> · {{ tx(d!.label) }}
          </button>
        </div>
        <button v-if="ui.off.size" class="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" @click="ui.resetSimulation()">
          <RotateCcw class="size-3.5" /> {{ t('panel.simReset') }}
        </button>
      </div>
    </div>
  </div>
</template>
