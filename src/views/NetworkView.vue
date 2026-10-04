<script setup lang="ts">
import { computed, ref } from 'vue'
import { EthernetPort, Map as MapIcon } from '@lucide/vue'
import { CABLE_COLORS } from '@/components/common/kinds'
import { CABLE_TYPES, type CableType, type Route } from '@/domain/model'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'

const data = useData()
const { t, tx } = useText()
const filter = ref<CableType | null>(null)

const runs = computed(() => (data.data?.routes ?? []).filter((r) => r.kind === 'low' || r.kind === 'conduit'))
const present = computed(() => CABLE_TYPES.filter((c) => runs.value.some((r) => r.cables.some((x) => x.type === c))))
const visible = computed(() => runs.value.filter((r) => !filter.value || r.cables.some((c) => c.type === filter.value)))
const conduits = computed(() => runs.value.filter((r) => r.kind === 'conduit'))

const totals = computed(() =>
  present.value.map((type) => ({
    type,
    n: runs.value.reduce((s, r) => s + r.cables.filter((c) => c.type === type).reduce((a, c) => a + c.count, 0), 0),
  })),
)

function length(r: Route) {
  let s = 0
  for (let i = 1; i < r.points.length; i++) s += Math.hypot(r.points[i]![0] - r.points[i - 1]![0], r.points[i]![1] - r.points[i - 1]![1])
  return (s / 100).toFixed(1)
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 pt-5 lg:px-8 lg:pt-8">
    <h1 class="flex items-center gap-2.5 text-2xl font-semibold tracking-tight lg:text-3xl"><EthernetPort class="size-7 text-sky-600" /> {{ t('network.title') }}</h1>
    <p class="mt-1 text-muted-foreground">{{ t('network.subtitle') }}</p>

    <p v-if="!runs.length" class="mt-8 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{{ t('network.empty') }}</p>

    <template v-else>
      <div class="mt-6 flex flex-wrap gap-2">
        <button class="rounded-full border px-3 py-1 text-xs" :class="!filter ? 'bg-foreground text-background' : 'bg-card'" @click="filter = null">{{ t('network.all') }}</button>
        <button
          v-for="c in totals"
          :key="c.type"
          class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
          :class="filter === c.type ? 'bg-foreground text-background' : 'bg-card'"
          @click="filter = filter === c.type ? null : c.type"
        >
          <span class="h-1.5 w-3.5 rounded-full" :style="{ background: CABLE_COLORS[c.type] }" />
          {{ t(`cable.${c.type}`) }} · {{ c.n }}
        </button>
      </div>

      <div class="mt-4 divide-y rounded-2xl border bg-card">
        <RouterLink v-for="r in visible" :key="r.id" :to="{ path: '/plan', query: { route: r.id } }" class="grid gap-2 px-4 py-3.5 transition hover:bg-accent/50 sm:grid-cols-[1fr_auto]">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-x-2 text-sm font-medium">
              <span>{{ tx(r.from, '—') }}</span>
              <span class="text-muted-foreground">→</span>
              <span>{{ tx(r.to, '—') }}</span>
            </div>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <span v-if="r.kind === 'conduit'" class="rounded bg-muted px-1.5 py-0.5 text-[11px]">{{ t('editor.plan.routeKinds.conduit') }}<template v-if="r.diameterMm"> ⌀{{ r.diameterMm }}</template></span>
              <span v-for="(c, i) in r.cables" :key="i" class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]">
                <span class="h-1.5 w-3 rounded-full" :style="{ background: CABLE_COLORS[c.type] }" />
                {{ t(`cable.${c.type}`) }}<template v-if="c.count > 1"> ×{{ c.count }}</template><template v-if="c.label"> · {{ c.label }}</template>
              </span>
              <span v-if="r.kind === 'conduit' && r.pullString" class="rounded bg-ok/12 px-1.5 py-0.5 text-[11px] text-ok">{{ t('network.pull') }}</span>
            </div>
          </div>
          <div class="flex items-center gap-3 text-xs text-muted-foreground">
            <span class="font-mono">≈ {{ length(r) }} {{ t('units.m') }}</span>
            <MapIcon class="size-4" />
          </div>
        </RouterLink>
      </div>

      <p v-if="conduits.length" class="mt-4 text-sm text-muted-foreground">{{ t('network.conduitHint', { n: conduits.filter((c) => c.pullString).length, total: conduits.length }) }}</p>
    </template>
  </div>
</template>
