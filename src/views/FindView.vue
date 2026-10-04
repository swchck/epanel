<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, DoorOpen, House, Search } from '@lucide/vue'
import DeviceChip from '@/components/common/DeviceChip.vue'
import SwitchOffCard from '@/components/common/SwitchOffCard.vue'
import { POINT_ICONS } from '@/components/common/kinds'
import { locate } from '@/domain/layout'
import { POINT_KINDS, type PlanPoint } from '@/domain/schema'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'

const data = useData()
const { t, tx } = useText()
const q = ref('')
const roomId = ref<string | null>(null)
const pointId = ref<string | null>(null)

const rooms = computed(() =>
  (data.data?.rooms ?? []).map((r) => ({ room: r, count: data.data!.points.filter((p) => p.room === r.id && p.device).length })),
)
const room = computed(() => data.data?.rooms.find((r) => r.id === roomId.value))
const point = computed(() => data.data?.points.find((p) => p.id === pointId.value))

const roomPoints = computed(() => {
  const pts = (data.data?.points ?? []).filter((p) => p.room === roomId.value && p.device)
  return POINT_KINDS.map((k) => ({ kind: k, pts: pts.filter((p) => p.kind === k) })).filter((g) => g.pts.length)
})

const results = computed<PlanPoint[]>(() => {
  if (!q.value.trim()) return []
  const hits = data.search(q.value, 30)
  const out: PlanPoint[] = []
  for (const h of hits) {
    if (h.kind === 'point' && h.point.device) out.push(h.point)
    if (h.kind === 'room') out.push(...data.data!.points.filter((p) => p.room === h.id && p.device).slice(0, 4))
  }
  return [...new Map(out.map((p) => [p.id, p])).values()].slice(0, 12)
})

const main = computed(() => {
  const id = data.data?.supply.input ?? data.graph?.roots.find((r) => r.type === 'mcb' || r.type === 'switch')?.id
  return id ? data.graph?.byId.get(id) : undefined
})
const mainPlace = computed(() => (main.value ? locate(data.layout, main.value.id) : undefined))

function roomName(id?: string) {
  return tx(data.data?.rooms.find((r) => r.id === id)?.name)
}

function back() {
  if (pointId.value) pointId.value = null
  else roomId.value = null
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 pt-5 lg:px-8 lg:pt-8">
    <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">{{ t('find.title') }}</h1>
    <p class="mt-1 text-muted-foreground">{{ t('find.subtitle') }}</p>

    <div class="relative mt-5">
      <Search class="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
      <input
        v-model="q"
        class="h-13 w-full rounded-2xl border bg-card pr-4 pl-12 text-base shadow-sm outline-none focus:border-primary"
        :placeholder="t('find.placeholder')"
        @input="pointId = null"
      />
    </div>

    <!-- free-text results -->
    <div v-if="q.trim() && !pointId" class="mt-4 space-y-1.5">
      <button
        v-for="p in results"
        :key="p.id"
        class="flex w-full items-center gap-3 rounded-xl border bg-card px-3.5 py-3 text-left transition hover:border-primary/50"
        @click="pointId = p.id"
      >
        <component :is="POINT_ICONS[p.kind]" class="size-5 text-muted-foreground" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium">{{ tx(p.label, t(`point.kind.${p.kind}`)) }}</div>
          <div class="text-xs text-muted-foreground">{{ roomName(p.room) }}</div>
        </div>
        <DeviceChip v-if="p.device" :device="data.graph!.byId.get(p.device)!" size="sm" />
      </button>
      <p v-if="!results.length" class="py-8 text-center text-sm text-muted-foreground">{{ t('search.empty') }}</p>
    </div>

    <div v-else class="mt-6">
      <button v-if="roomId || pointId" class="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" @click="back">
        <ChevronLeft class="size-4" /> {{ t('common.back') }}
      </button>

      <div v-if="point" class="rounded-2xl border bg-card p-5">
        <SwitchOffCard :key="point.id" :point="point" />
      </div>

      <template v-else-if="room">
        <h2 class="mb-3 text-lg font-semibold">{{ tx(room.name) }}</h2>
        <div v-for="g in roomPoints" :key="g.kind" class="mb-4">
          <div class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{{ t(`point.kinds.${g.kind}`) }}</div>
          <div class="grid gap-2 sm:grid-cols-2">
            <button
              v-for="p in g.pts"
              :key="p.id"
              class="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 text-left transition hover:border-primary/50"
              @click="pointId = p.id"
            >
              <component :is="POINT_ICONS[p.kind]" class="size-5 shrink-0 text-muted-foreground" />
              <span class="min-w-0 flex-1 text-sm">{{ tx(p.label, t(`point.kind.${p.kind}`)) }}</span>
              <span class="font-mono text-xs font-semibold">{{ p.device }}</span>
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{{ t('find.pickRoom') }}</div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            v-for="r in rooms"
            :key="r.room.id"
            class="flex flex-col items-start gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
            @click="roomId = r.room.id"
          >
            <DoorOpen class="size-5 text-primary" />
            <div>
              <div class="font-medium">{{ tx(r.room.name) }}</div>
              <div class="text-xs text-muted-foreground">{{ t('find.pointsCount', { n: r.count }) }}</div>
            </div>
          </button>
        </div>

        <RouterLink
          v-if="main"
          :to="`/d/${main.id}`"
          class="mt-6 flex items-center gap-4 rounded-2xl border border-danger/30 bg-danger/8 p-4 transition hover:border-danger/60"
        >
          <House class="size-6 text-danger" />
          <div class="flex-1">
            <div class="font-medium">{{ t('find.everything') }}</div>
            <div class="text-sm text-muted-foreground">
              {{ t('find.everythingHint') }}<template v-if="mainPlace"> · {{ t('device.place', { row: mainPlace.rowIndex + 1, pos: mainPlace.position }) }}</template>
            </div>
          </div>
          <DeviceChip :device="main" size="lg" />
        </RouterLink>
      </template>
    </div>
  </div>
</template>
