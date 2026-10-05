<script setup lang="ts">
import { computed, ref } from 'vue'
import { CircleCheck } from '@lucide/vue'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import CheckItem from '@/components/common/CheckItem.vue'
import DeviceChip from '@/components/common/DeviceChip.vue'
import { aggregateLoad, deviceLoad } from '@/domain/load'
import type { CheckLevel } from '@/domain/checks'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'

const data = useData()
const { t, tx } = useText()
const showInfo = ref(false)

const counts = computed(() => {
  const c: Record<CheckLevel, number> = { error: 0, warn: 0, info: 0 }
  for (const r of data.checks) c[r.level] += 1
  return c
})

const visible = computed(() => data.checks.filter((c) => showInfo.value || c.level !== 'info'))

const total = computed(() => (data.graph ? aggregateLoad(data.graph, data.graph.roots) : { nameplateW: 0, demandW: 0 }))
const maxKw = computed(() => data.data?.supply.maxPowerKw)
const totalPct = computed(() => (maxKw.value ? (total.value.demandW / 1000 / maxKw.value) * 100 : 0))

const circuits = computed(() => {
  const g = data.graph
  const d = data.data
  if (!g || !d) return []
  return d.devices
    .filter((x) => (x.type === 'mcb' || x.type === 'rcbo') && x.rating && g.pointsOf(x.id, false).length)
    .map((x) => ({ d: x, load: deviceLoad(g, x, d.supply.voltage) }))
    .filter((x) => x.load.nameplateW > 0)
    .sort((a, b) => (b.load.utilization ?? 0) - (a.load.utilization ?? 0))
})

function tone(u: number) {
  return u > 1 ? 'bg-danger' : u > 0.8 ? 'bg-warn' : 'bg-ok'
}

const RULES = ['cable', 'load', 'selectivity', 'rcd', 'wet', 'class', 'input', 'routes'] as const
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 pt-5 lg:px-8 lg:pt-8">
    <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">{{ t('checks.title') }}</h1>
    <p class="mt-1 text-muted-foreground">{{ t('checks.subtitle') }}</p>

    <div data-tour="checks-counts" class="mt-6 grid gap-3 sm:grid-cols-3">
      <div class="rounded-2xl border bg-card p-4">
        <div class="font-mono text-3xl font-semibold text-danger tabular">{{ counts.error }}</div>
        <div class="text-sm text-muted-foreground">{{ t('checks.level.error') }}</div>
      </div>
      <div class="rounded-2xl border bg-card p-4">
        <div class="font-mono text-3xl font-semibold text-warn tabular">{{ counts.warn }}</div>
        <div class="text-sm text-muted-foreground">{{ t('checks.level.warn') }}</div>
      </div>
      <div class="rounded-2xl border bg-card p-4">
        <div class="font-mono text-3xl font-semibold text-info tabular">{{ counts.info }}</div>
        <div class="text-sm text-muted-foreground">{{ t('checks.level.info') }}</div>
      </div>
    </div>

    <section data-tour="checks-load" class="mt-6 rounded-2xl border bg-card p-5">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-semibold">{{ t('checks.totalLoad') }}</h2>
        <span class="font-mono text-sm tabular">
          <span class="text-2xl font-semibold">{{ (total.demandW / 1000).toFixed(1) }}</span>
          <span class="text-muted-foreground"> / {{ maxKw ?? '—' }} {{ t('units.kw') }}</span>
        </span>
      </div>
      <div v-if="maxKw" class="mt-3 h-3 overflow-hidden rounded-full bg-muted">
        <div class="h-full rounded-full transition-[width] duration-700" :class="tone(totalPct / 100)" :style="{ width: `${Math.min(100, totalPct)}%` }" />
      </div>
      <p class="mt-2 text-xs text-muted-foreground">{{ t('checks.totalHint', { nameplate: (total.nameplateW / 1000).toFixed(1) }) }}</p>
    </section>

    <section data-tour="checks-list" class="mt-6">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-semibold">{{ t('checks.issues') }}</h2>
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          <input v-model="showInfo" type="checkbox" class="accent-primary" /> {{ t('checks.showInfo') }}
        </label>
      </div>
      <div v-if="visible.length" class="space-y-2">
        <CheckItem v-for="(c, i) in visible" :key="i" :check="c" />
      </div>
      <div v-else class="flex items-center gap-3 rounded-2xl border border-ok/40 bg-ok/10 p-4 text-sm">
        <CircleCheck class="size-5 text-ok" /> {{ t('checks.allGood') }}
      </div>
    </section>

    <section v-if="circuits.length" class="mt-8">
      <h2 class="mb-3 font-semibold">{{ t('checks.circuits') }}</h2>
      <div class="divide-y rounded-2xl border bg-card">
        <RouterLink v-for="c in circuits" :key="c.d.id" :to="`/d/${c.d.id}`" class="flex items-center gap-3 px-4 py-3 transition hover:bg-accent/50">
          <DeviceChip :device="c.d" size="sm" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm">{{ tx(c.d.label) }}</div>
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full" :class="tone(c.load.utilization ?? 0)" :style="{ width: `${Math.min(100, (c.load.utilization ?? 0) * 100)}%` }" />
            </div>
          </div>
          <div class="w-24 text-right font-mono text-xs tabular">
            {{ c.load.currentA.toFixed(1) }} / {{ c.d.rating }} A
          </div>
        </RouterLink>
      </div>
    </section>

    <section class="mt-8 mb-6">
      <h2 class="mb-2 font-semibold">{{ t('checks.rulesTitle') }}</h2>
      <Accordion type="multiple" class="rounded-2xl border bg-card px-4">
        <AccordionItem v-for="r in RULES" :key="r" :value="r">
          <AccordionTrigger>{{ t(`checks.rules.${r}.title`) }}</AccordionTrigger>
          <AccordionContent class="text-muted-foreground">{{ t(`checks.rules.${r}.body`) }}</AccordionContent>
        </AccordionItem>
      </Accordion>
      <p class="mt-3 text-xs text-muted-foreground">{{ t('checks.disclaimer') }}</p>
    </section>
  </div>
</template>
