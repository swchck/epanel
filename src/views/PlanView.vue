<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { Layers, Power, RotateCcw, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import DeviceChip from '@/components/common/DeviceChip.vue'
import PhotoLightbox from '@/components/common/PhotoLightbox.vue'
import RouteCard from '@/components/common/RouteCard.vue'
import SwitchOffCard from '@/components/common/SwitchOffCard.vue'
import { POINT_COLORS, POINT_ICONS } from '@/components/common/kinds'
import FloorPlan from '@/components/plan/FloorPlan.vue'
import { pointPowered } from '@/domain/graph'
import { areaM2 } from '@/domain/geometry'
import { devicesForRoom } from '@/domain/lookup'
import { POINT_KINDS } from '@/domain/schema'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'
import { useUi } from '@/stores/ui'

const data = useData()
const ui = useUi()
const route = useRoute()
const router = useRouter()
const { t, tx } = useText()
const wide = useMediaQuery('(min-width: 1024px)')
const Plan3D = defineAsyncComponent(() => import('@/components/plan/Plan3D.vue'))
const view = ref<'2d' | '3d'>(localStorage.getItem('panel.planView') === '3d' ? '3d' : '2d')
watch(view, (v) => {
  try {
    localStorage.setItem('panel.planView', v)
  } catch {
    // storage blocked
  }
})

const pointId = ref<string | null>(null)
const roomId = ref<string | null>(null)
const deviceId = ref<string | null>(null)
const photoId = ref<string | null>(null)
const routeId = ref<string | null>(null)

watch(
  () => route.query,
  (q) => {
    pointId.value = typeof q.point === 'string' ? q.point : null
    roomId.value = typeof q.room === 'string' ? q.room : null
    deviceId.value = typeof q.device === 'string' ? q.device : null
    routeId.value = typeof q.route === 'string' ? q.route : null
  },
  { immediate: true },
)

function setQuery(q: Record<string, string | undefined>) {
  router.replace({ path: '/plan', query: Object.fromEntries(Object.entries(q).filter(([, v]) => v)) })
}

const point = computed(() => data.data?.points.find((p) => p.id === pointId.value))
const room = computed(() => data.data?.rooms.find((r) => r.id === roomId.value))
const device = computed(() => (deviceId.value ? data.graph?.byId.get(deviceId.value) : undefined))
const cableRun = computed(() => data.data?.routes.find((r) => r.id === routeId.value))

const highlight = computed(() => {
  if (device.value && data.graph) return new Set(data.graph.pointsOf(device.value.id).map((p) => p.id))
  if (point.value?.device && data.graph) return new Set(data.graph.pointsOf(point.value.device, false).map((p) => p.id))
  return undefined
})

const dead = computed(() => {
  if (!ui.simulate || !data.graph || !data.data) return undefined
  return new Set(data.data.points.filter((p) => !pointPowered(data.graph!, p, ui.off)).map((p) => p.id))
})

const roomDevices = computed(() => (room.value && data.graph && data.data ? devicesForRoom(data.graph, data.data, room.value.id) : []))

function onPoint(id: string) {
  const p = data.data?.points.find((x) => x.id === id)
  if (ui.simulate && p?.device) {
    ui.toggleOff(p.device)
    return
  }
  setQuery({ point: id })
}

function onRoom(id: string) {
  if (pointId.value || deviceId.value) return setQuery({})
  setQuery(roomId.value === id ? {} : { room: id })
}

const hasSelection = computed(() => !!(point.value || room.value || device.value || cableRun.value))
const drawerOpen = computed({
  get: () => !wide.value && hasSelection.value,
  set: (v) => {
    if (!v) setQuery({})
  },
})

const kindsPresent = computed(() => POINT_KINDS.filter((k) => data.data?.points.some((p) => p.kind === k)))
</script>

<template>
  <div class="flex h-[calc(100dvh-7.5rem)] flex-col px-4 pt-4 lg:h-dvh lg:px-8 lg:pt-6 lg:pb-6">
    <div class="no-print mb-3 flex flex-wrap items-center gap-2">
      <h1 class="mr-auto text-xl font-semibold tracking-tight lg:text-2xl">{{ t('nav.plan') }}</h1>
      <div class="flex overflow-hidden rounded-full border bg-card text-xs font-medium">
        <button v-for="v in ['2d', '3d'] as const" :key="v" class="px-3 py-1 uppercase transition" :class="view === v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'" @click="view = v">{{ v }}</button>
      </div>
      <label class="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs" :class="{ 'border-live bg-live/15': ui.simulate }">
        <Power class="size-3.5" :class="ui.simulate ? 'text-live' : ''" />
        {{ t('panel.simulate') }}
        <Switch v-model="ui.simulate" class="scale-90" />
      </label>
      <Button v-if="ui.simulate && ui.off.size" size="sm" variant="ghost" class="rounded-full" @click="ui.resetSimulation()"><RotateCcw /> {{ t('panel.simReset') }}</Button>
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="outline" size="sm" class="rounded-full"><Layers /> {{ t('plan.layers') }}</Button>
        </PopoverTrigger>
        <PopoverContent align="end" class="w-64 space-y-1 p-2">
          <label v-for="k in kindsPresent" :key="k" class="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
            <component :is="POINT_ICONS[k]" class="size-4" :style="{ color: POINT_COLORS[k] }" />
            <span class="flex-1">{{ t(`point.kinds.${k}`) }}</span>
            <Switch v-model="ui.planLayers[k]" class="scale-90" />
          </label>
          <div class="my-1 border-t" />
          <label v-for="k in ['routes', 'lowvoltage', 'bus', 'dimensions', 'photos', 'labels', 'background'] as const" :key="k" class="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
            <span class="flex-1">{{ t(`plan.layer.${k}`) }}</span>
            <Switch v-model="ui.planLayers[k]" class="scale-90" />
          </label>
        </PopoverContent>
      </Popover>
    </div>

    <div v-if="ui.simulate" class="no-print mb-3 rounded-xl border border-live/40 bg-live/10 px-3 py-2 text-sm">
      {{ ui.off.size ? t('plan.simStatus', { n: dead?.size ?? 0 }) : t('plan.simHint') }}
      <span v-if="ui.off.size" class="ml-1 inline-flex flex-wrap gap-1 align-middle">
        <button v-for="id in ui.off" :key="id" @click="ui.toggleOff(id)"><DeviceChip :device="data.graph!.byId.get(id)!" size="sm" /></button>
      </span>
    </div>

    <div class="flex min-h-0 flex-1 gap-5">
      <div class="relative min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card">
        <Plan3D
          v-if="view === '3d'"
          :highlight-points="highlight"
          :dead-points="dead"
          :focus-point="pointId"
          :selected-route="routeId"
          :show-routes="ui.planLayers.routes || ui.planLayers.lowvoltage || ui.planLayers.bus || !!device"
          @point="onPoint"
          @route="(id) => setQuery({ route: id })"
          @canvas="setQuery({})"
        />
        <FloorPlan
          v-else
          :highlight-points="highlight"
          :highlight-room="roomId"
          :focus-point="pointId"
          :dead-points="dead"
          :show-routes="ui.planLayers.routes || !!device"
          @point="onPoint"
          @room="onRoom"
          clickable-routes
          :selected-route="routeId"
          @photo="(id) => (photoId = id)"
          @route="(id) => setQuery({ route: id })"
          @canvas="setQuery({})"
        />
        <div v-if="!hasSelection && !ui.simulate" class="pointer-events-none absolute top-3 left-3 rounded-lg bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
          {{ t('plan.hint') }}
        </div>
      </div>

      <aside v-if="wide" class="no-print w-96 shrink-0 overflow-y-auto rounded-2xl border bg-card p-5">
        <template v-if="hasSelection">
          <button class="float-right -mt-1 -mr-1 rounded-md p-1 text-muted-foreground hover:bg-accent" :aria-label="t('common.close')" @click="setQuery({})">
            <X class="size-4" />
          </button>
          <SwitchOffCard v-if="point" :key="point.id" :point="point" />
          <RouteCard v-else-if="cableRun" :key="cableRun.id" :route="cableRun" />
          <div v-else-if="device" class="space-y-3">
            <DeviceChip :device="device" size="lg" />
            <div class="font-semibold">{{ tx(device.label) }}</div>
            <p class="text-sm text-muted-foreground">{{ t('plan.deviceHighlight', { n: highlight?.size ?? 0 }) }}</p>
            <Button variant="outline" as-child class="w-full"><RouterLink :to="`/d/${device.id}`">{{ t('find.openInPanel') }}</RouterLink></Button>
          </div>
          <div v-else-if="room" class="space-y-4">
            <div>
              <div class="text-lg font-semibold">{{ tx(room.name) }}</div>
              <div class="text-sm text-muted-foreground">
                {{ areaM2(room.polygon).toFixed(1) }} {{ t('units.m2') }}<template v-if="room.wet"> · {{ t('plan.wet') }}</template>
              </div>
            </div>
            <div>
              <div class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{{ t('plan.roomDevices') }}</div>
              <RouterLink v-for="d in roomDevices" :key="d.id" :to="`/d/${d.id}`" class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-accent">
                <DeviceChip :device="d" size="sm" />
                <span class="truncate">{{ tx(d.label) }}</span>
              </RouterLink>
            </div>
          </div>
        </template>
        <div v-else class="space-y-4">
          <p class="text-sm text-muted-foreground">{{ t('plan.sideHint') }}</p>
          <div class="space-y-1.5">
            <div v-for="k in kindsPresent" :key="k" class="flex items-center gap-2.5 text-sm">
              <span class="grid size-6 place-items-center rounded-full" :style="{ background: POINT_COLORS[k] }"><component :is="POINT_ICONS[k]" class="size-3.5 text-white" /></span>
              {{ t(`point.kinds.${k}`) }}
              <span class="ml-auto font-mono text-xs text-muted-foreground">{{ data.data?.points.filter((p) => p.kind === k).length }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2.5 text-sm">
            <span class="inline-block h-3 w-6 rounded-sm bg-[repeating-linear-gradient(45deg,var(--danger)_0_3px,transparent_3px_7px)] opacity-70" />
            {{ t('plan.layer.routes') }}
          </div>
        </div>
      </aside>
    </div>

    <Drawer v-model:open="drawerOpen">
      <DrawerContent class="max-h-[85dvh]">
        <DrawerTitle class="sr-only">{{ t('nav.plan') }}</DrawerTitle>
        <DrawerDescription class="sr-only">{{ t('plan.hint') }}</DrawerDescription>
        <div class="overflow-y-auto px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SwitchOffCard v-if="point" :key="point.id" :point="point" />
          <RouteCard v-else-if="cableRun" :key="cableRun.id" :route="cableRun" />
          <div v-else-if="device" class="space-y-3">
            <DeviceChip :device="device" size="lg" />
            <div class="font-semibold">{{ tx(device.label) }}</div>
            <Button variant="outline" as-child class="w-full"><RouterLink :to="`/d/${device.id}`">{{ t('find.openInPanel') }}</RouterLink></Button>
          </div>
          <div v-else-if="room" class="space-y-3">
            <div class="text-lg font-semibold">{{ tx(room.name) }}</div>
            <RouterLink v-for="d in roomDevices" :key="d.id" :to="`/d/${d.id}`" class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-accent">
              <DeviceChip :device="d" size="sm" />
              <span class="truncate">{{ tx(d.label) }}</span>
            </RouterLink>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
    <PhotoLightbox v-model:id="photoId" />
  </div>
</template>
