<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, Flame, House, Phone, PlugZap, ShieldAlert, Zap, ZapOff } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import DeviceChip from '@/components/common/DeviceChip.vue'
import { POINT_ICONS } from '@/components/common/kinds'
import PanelEnclosure from '@/components/panel/PanelEnclosure.vue'
import { locate } from '@/domain/layout'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'

type Scenario = 'partial' | 'all' | 'rcd' | 'smell' | 'flicker'
type Guide = 'mcb' | 'rcd' | 'relay' | 'all' | 'other'

const data = useData()
const { t, tx, tm, rt } = useText()
const scenario = ref<Scenario | null>(null)
const tripped = ref<string | null>(null)

const SCENARIOS: { id: Scenario; icon: typeof Zap; tone: string }[] = [
  { id: 'partial', icon: ZapOff, tone: 'text-warn' },
  { id: 'rcd', icon: ShieldAlert, tone: 'text-info' },
  { id: 'all', icon: House, tone: 'text-foreground' },
  { id: 'flicker', icon: PlugZap, tone: 'text-primary' },
  { id: 'smell', icon: Flame, tone: 'text-danger' },
]

const device = computed(() => (tripped.value ? data.graph?.byId.get(tripped.value) : undefined))
const place = computed(() => (tripped.value ? locate(data.layout, tripped.value) : undefined))
const children = computed(() => (tripped.value ? (data.graph?.children.get(tripped.value) ?? []) : []))
const points = computed(() => (tripped.value ? (data.graph?.pointsOf(tripped.value, true) ?? []) : []))
const heavy = computed(() => [...points.value].filter((p) => (p.powerW ?? 0) >= 1000).sort((a, b) => (b.powerW ?? 0) - (a.powerW ?? 0)))

const guide = computed<Guide | null>(() => {
  if (scenario.value === 'all') return 'all'
  if (scenario.value === 'flicker') return 'relay'
  const d = device.value
  if (!d) return null
  if (d.type === 'rcd' || d.type === 'rcbo') return 'rcd'
  if (d.type === 'voltage-relay') return 'relay'
  if (d.type === 'mcb' || d.type === 'switch') return 'mcb'
  return 'other'
})

const steps = computed(() => (guide.value ? (tm(`emergency.guide.${guide.value}.steps`) as unknown[]).map((s) => rt(s as never)) : []))
const contacts = computed(() => data.data?.meta.contacts ?? [])
const relay = computed(() => data.data?.devices.find((d) => d.type === 'voltage-relay'))
const main = computed(() => (data.data?.supply.input ? data.graph?.byId.get(data.data.supply.input) : undefined))

function choose(s: Scenario) {
  scenario.value = s
  tripped.value = null
}

function reset() {
  if (tripped.value && scenario.value !== 'all') tripped.value = null
  else scenario.value = null
}

function needsPick(s: Scenario | null) {
  return s === 'partial' || s === 'rcd'
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 pt-5 lg:px-8 lg:pt-8">
    <h1 class="flex items-center gap-2.5 text-2xl font-semibold tracking-tight lg:text-3xl"><Zap class="size-7 text-danger" /> {{ t('emergency.title') }}</h1>
    <p class="mt-1 text-muted-foreground">{{ t('emergency.subtitle') }}</p>

    <button v-if="scenario" class="mt-5 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" @click="reset">
      <ChevronLeft class="size-4" /> {{ t('common.back') }}
    </button>

    <!-- step 1: what happened -->
    <div v-if="!scenario" class="mt-6 grid gap-2.5">
      <button
        v-for="s in SCENARIOS"
        :key="s.id"
        class="flex items-center gap-4 rounded-2xl border bg-card p-4 text-left transition hover:border-foreground/30 hover:shadow-sm"
        :class="s.id === 'smell' ? 'border-danger/40 bg-danger/6' : ''"
        @click="choose(s.id)"
      >
        <component :is="s.icon" class="size-7 shrink-0" :class="s.tone" />
        <div>
          <div class="font-medium">{{ t(`emergency.scenario.${s.id}.title`) }}</div>
          <div class="text-sm text-muted-foreground">{{ t(`emergency.scenario.${s.id}.hint`) }}</div>
        </div>
      </button>
    </div>

    <!-- danger -->
    <div v-else-if="scenario === 'smell'" class="mt-4 space-y-4 rounded-2xl border-2 border-danger bg-danger/10 p-5">
      <div class="flex items-center gap-3 text-lg font-semibold text-danger"><Flame class="size-6" /> {{ t('emergency.danger.title') }}</div>
      <ol class="list-decimal space-y-2 pl-5">
        <li>{{ t('emergency.danger.s1') }} <DeviceChip v-if="main" :device="main" size="sm" /></li>
        <li>{{ t('emergency.danger.s2') }}</li>
        <li>{{ t('emergency.danger.s3') }}</li>
        <li>{{ t('emergency.danger.s4') }}</li>
      </ol>
      <Button as="a" href="tel:112" class="h-12 w-full bg-danger text-base text-white hover:bg-danger/90"><Phone /> 112</Button>
    </div>

    <!-- step 2: point at the tripped device -->
    <div v-else-if="needsPick(scenario) && !tripped" class="mt-4">
      <p class="mb-3 font-medium">{{ t(scenario === 'rcd' ? 'emergency.pickRcd' : 'emergency.pick') }}</p>
      <div class="overflow-hidden rounded-2xl">
        <PanelEnclosure @select="(id) => (tripped = id)" />
      </div>
      <p class="mt-3 text-sm text-muted-foreground">{{ t('emergency.pickHint') }}</p>
    </div>

    <!-- step 3: guidance -->
    <div v-else class="mt-4 space-y-5">
      <div v-if="device" class="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
        <DeviceChip :device="device" size="lg" />
        <div class="min-w-0 flex-1">
          <div class="font-medium">{{ tx(device.label) }}</div>
          <div v-if="place" class="text-sm text-muted-foreground">{{ t('device.place', { row: place.rowIndex + 1, pos: place.position }) }}</div>
        </div>
      </div>

      <div v-if="guide" class="rounded-2xl border bg-card p-5">
        <h2 class="mb-1 text-lg font-semibold">{{ t(`emergency.guide.${guide}.title`) }}</h2>
        <p class="mb-4 text-sm text-muted-foreground">{{ t(`emergency.guide.${guide}.why`) }}</p>
        <ol class="space-y-3">
          <li v-for="(s, i) in steps" :key="i" class="flex gap-3">
            <span class="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-mono text-sm font-semibold text-primary-foreground">{{ i + 1 }}</span>
            <span class="pt-0.5">{{ s }}</span>
          </li>
        </ol>
      </div>

      <div v-if="guide === 'rcd' && children.length" class="rounded-2xl border bg-card p-5">
        <h3 class="mb-2 font-medium">{{ t('emergency.rcdLines') }}</h3>
        <div class="flex flex-wrap gap-2">
          <RouterLink v-for="c in children" :key="c.id" :to="`/d/${c.id}`" class="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-accent">
            <DeviceChip :device="c" size="sm" /> {{ tx(c.label) }}
          </RouterLink>
        </div>
      </div>

      <div v-if="heavy.length" class="rounded-2xl border bg-card p-5">
        <h3 class="mb-2 font-medium">{{ t(guide === 'rcd' ? 'emergency.suspectsLeak' : 'emergency.suspects') }}</h3>
        <ul class="space-y-1.5">
          <li v-for="p in heavy" :key="p.id" class="flex items-center gap-2.5 text-sm">
            <component :is="POINT_ICONS[p.kind]" class="size-4 text-muted-foreground" />
            <span class="flex-1">{{ tx(p.label, t(`point.kind.${p.kind}`)) }}</span>
            <span class="font-mono text-xs text-muted-foreground">{{ ((p.powerW ?? 0) / 1000).toFixed(1) }} kW</span>
          </li>
        </ul>
      </div>

      <div v-if="guide === 'relay' && relay" class="rounded-2xl border bg-card p-4 text-sm">
        <RouterLink :to="`/d/${relay.id}`" class="flex items-center gap-2"><DeviceChip :device="relay" size="sm" /> {{ tx(relay.label) }}</RouterLink>
        <p v-for="(n, i) in relay.notes" :key="i" class="mt-2 text-muted-foreground">{{ n.text }}</p>
      </div>

      <div class="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm">{{ t('emergency.never') }}</div>
    </div>

    <!-- contacts -->
    <section v-if="contacts.length" class="mt-8">
      <h2 class="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{{ t('emergency.contacts') }}</h2>
      <div class="grid gap-2 sm:grid-cols-2">
        <a
          v-for="c in contacts"
          :key="c.name"
          :href="c.phone ? `tel:${c.phone.replace(/[^\d+]/g, '')}` : undefined"
          class="flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/50"
        >
          <div class="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15"><Phone class="size-4.5 text-primary" /></div>
          <div class="min-w-0">
            <div class="truncate font-medium">{{ c.name }}</div>
            <div class="text-sm text-muted-foreground">{{ t(`contact.role.${c.role}`) }}<template v-if="c.phone"> · {{ c.phone }}</template></div>
            <div v-if="c.note" class="text-xs text-muted-foreground">{{ tx(c.note) }}</div>
          </div>
        </a>
      </div>
    </section>
  </div>
</template>
