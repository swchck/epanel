<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { FilterX, MapPin, Power, RotateCcw, ScanSearch, X, ZoomIn, ZoomOut } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import DeviceDetails from '@/components/panel/DeviceDetails.vue'
import PanelEnclosure from '@/components/panel/PanelEnclosure.vue'
import { TYPE_ACCENT } from '@/components/panel/geometry'
import { pointPowered } from '@/domain/graph'
import type { DeviceType } from '@/domain/schema'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'
import { useUi } from '@/stores/ui'

const props = defineProps<{ id?: string }>()
const data = useData()
const ui = useUi()
const route = useRoute()
const router = useRouter()
const { t, tx } = useText()
const wide = useMediaQuery('(min-width: 1280px)')
const zoomed = ref(false)

watch(
  () => props.id,
  (id) => {
    if (id && data.graph?.byId.has(id)) ui.select(id)
  },
  { immediate: true },
)

function onSelect(id: string) {
  ui.select(ui.selectedDevice === id ? null : id)
}

watch(
  () => ui.selectedDevice,
  (id) => {
    const target = id ? `/d/${id}` : '/'
    if (route.path !== target && (route.name === 'panel' || route.name === 'device')) router.replace(target)
  },
)

const drawerOpen = computed({
  get: () => !wide.value && !!ui.selectedDevice,
  set: (v) => {
    if (!v) ui.select(null)
  },
})

const presentTypes = computed(() => {
  const s = new Set(data.data?.devices.map((d) => d.type))
  return (['mcb', 'rcd', 'rcbo', 'voltage-relay', 'spd', 'meter', 'din-socket', 'switch', 'contactor', 'bus', 'terminal', 'other'] as DeviceType[]).filter((x) => s.has(x))
})
const tags = computed(() => [...new Set(data.data?.devices.flatMap((d) => d.tags))].sort())

const stats = computed(() => {
  const d = data.data
  if (!d) return []
  const groups = d.devices.filter((x) => (x.type === 'mcb' || x.type === 'rcbo') && (data.graph?.pointsOf(x.id, false).length ?? 0) > 0).length
  const rcds = d.devices.filter((x) => x.type === 'rcd' || x.type === 'rcbo').length
  const modules = data.layout.reduce((s, r) => s + r.modules, 0)
  const used = data.layout.reduce((s, r) => s + r.items.filter((i) => i.kind === 'device').reduce((a, i) => a + i.width, 0), 0)
  return [
    { k: t('panel.stat.groups'), v: groups },
    { k: t('panel.stat.rcds'), v: rcds },
    { k: t('panel.stat.points'), v: d.points.length },
    { k: t('panel.stat.modules'), v: `${used}/${modules}` },
  ]
})

const deadPoints = computed(() => {
  if (!data.graph || !data.data) return 0
  return data.data.points.filter((p) => !pointPowered(data.graph!, p, ui.off)).length
})

const errors = computed(() => data.checks.filter((c) => c.level === 'error').length)
const warns = computed(() => data.checks.filter((c) => c.level === 'warn').length)

function toggleType(tp: DeviceType) {
  const i = ui.filterTypes.indexOf(tp)
  if (i >= 0) ui.filterTypes.splice(i, 1)
  else ui.filterTypes.push(tp)
}

watch(
  () => ui.simulate,
  (on) => {
    if (!on) ui.resetSimulation()
  },
)
</script>

<template>
  <div class="mx-auto max-w-[1500px] px-4 pt-5 lg:px-8 lg:pt-8">
    <!-- heading -->
    <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">{{ tx(data.data?.meta.title) }}</h1>
        <p v-if="data.data?.meta.location" class="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin class="size-4" /> {{ tx(data.data.meta.location) }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <div v-for="s in stats" :key="s.k" class="rounded-xl border bg-card px-3 py-1.5">
          <div class="font-mono text-base font-semibold tabular">{{ s.v }}</div>
          <div class="text-[11px] text-muted-foreground">{{ s.k }}</div>
        </div>
        <RouterLink
          v-if="errors || warns"
          to="/checks"
          class="rounded-xl border px-3 py-1.5 transition hover:border-foreground/30"
          :class="errors ? 'border-danger/40 bg-danger/10' : 'border-warn/40 bg-warn/10'"
        >
          <div class="font-mono text-base font-semibold tabular">{{ errors || warns }}</div>
          <div class="text-[11px] text-muted-foreground">{{ errors ? t('panel.stat.errors') : t('panel.stat.warnings') }}</div>
        </RouterLink>
      </div>
    </div>

    <!-- toolbar -->
    <div class="no-print mb-4 flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="tp in presentTypes"
          :key="tp"
          class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition"
          :class="ui.filterTypes.includes(tp) ? 'border-foreground/40 bg-foreground text-background' : 'bg-card hover:border-foreground/30'"
          @click="toggleType(tp)"
        >
          <span class="size-2 rounded-full" :style="{ background: TYPE_ACCENT[tp] }" />
          {{ t(`device.typeShort.${tp}`) }}
        </button>
      </div>
      <Select :model-value="ui.filterRoom ?? '__all'" @update:model-value="(v) => (ui.filterRoom = v === '__all' ? null : (v as string))">
        <SelectTrigger class="h-7 w-auto min-w-36 rounded-full text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">{{ t('panel.allRooms') }}</SelectItem>
          <SelectItem v-for="r in data.data?.rooms" :key="r.id" :value="r.id">{{ tx(r.name) }}</SelectItem>
        </SelectContent>
      </Select>
      <Select v-if="tags.length" :model-value="ui.filterTag ?? '__all'" @update:model-value="(v) => (ui.filterTag = v === '__all' ? null : (v as string))">
        <SelectTrigger class="h-7 w-auto min-w-28 rounded-full text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">{{ t('panel.allTags') }}</SelectItem>
          <SelectItem v-for="tag in tags" :key="tag" :value="tag">#{{ tag }}</SelectItem>
        </SelectContent>
      </Select>
      <button
        class="rounded-full border px-2.5 py-1 text-xs transition"
        :class="ui.filterIssues ? 'border-warn bg-warn/20' : 'bg-card hover:border-foreground/30'"
        @click="ui.filterIssues = !ui.filterIssues"
      >
        {{ t('panel.onlyIssues') }}
      </button>
      <Button v-if="ui.filtersActive" variant="ghost" size="sm" class="h-7 rounded-full text-xs" @click="ui.clearFilters()"><FilterX /> {{ t('panel.clearFilters') }}</Button>
      <div class="flex-1" />
      <label class="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs" :class="{ 'border-live bg-live/15': ui.simulate }">
        <Power class="size-3.5" :class="ui.simulate ? 'text-live' : ''" />
        {{ t('panel.simulate') }}
        <Switch v-model="ui.simulate" class="scale-90" />
      </label>
      <Button variant="outline" size="icon-sm" class="hidden rounded-full md:inline-flex" :aria-label="t('panel.zoom')" @click="zoomed = !zoomed">
        <component :is="zoomed ? ZoomOut : ZoomIn" />
      </Button>
    </div>

    <Transition name="fade">
      <div v-if="ui.simulate" class="no-print mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-live/40 bg-live/10 px-4 py-2.5 text-sm">
        <Power class="size-4 text-live" />
        <span class="flex-1">{{ ui.off.size ? t('panel.simStatus', { devices: ui.off.size, points: deadPoints }) : t('panel.simHint') }}</span>
        <Button v-if="ui.off.size" size="sm" variant="outline" @click="router.push('/plan')"><ScanSearch /> {{ t('panel.simShowPlan') }}</Button>
        <Button v-if="ui.off.size" size="sm" variant="ghost" @click="ui.resetSimulation()"><RotateCcw /> {{ t('panel.simReset') }}</Button>
      </div>
    </Transition>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div class="min-w-0">
        <div class="overflow-x-auto rounded-2xl" :class="zoomed ? '' : ''">
          <div :class="zoomed ? 'w-[1100px]' : 'mx-auto max-w-[900px]'">
            <PanelEnclosure @select="onSelect" />
          </div>
        </div>
        <!-- legend -->
        <div class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span class="flex items-center gap-1.5"><span class="inline-block h-2 w-3 rounded-sm bg-[#d93a2b]" /> {{ t('panel.legend.on') }}</span>
          <span class="flex items-center gap-1.5"><span class="inline-block h-2 w-3 rounded-sm bg-[#2f9e44]" /> {{ t('panel.legend.off') }}</span>
          <span class="flex items-center gap-1.5"><span class="inline-block size-2 rounded-full bg-live" /> {{ t('panel.legend.live') }}</span>
          <span class="flex items-center gap-1.5"><span class="inline-block size-3 rounded-full bg-warn text-center text-[8px] leading-3 font-bold text-white">!</span> {{ t('panel.legend.issue') }}</span>
          <span>{{ t('panel.legend.tap') }}</span>
        </div>
      </div>

      <!-- side details on wide screens -->
      <aside v-if="wide" class="no-print">
        <div class="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border bg-card p-5">
          <template v-if="ui.selectedDevice">
            <button class="float-right -mt-1 -mr-1 rounded-md p-1 text-muted-foreground hover:bg-accent" :aria-label="t('common.close')" @click="ui.select(null)">
              <X class="size-4" />
            </button>
            <DeviceDetails :id="ui.selectedDevice" :key="ui.selectedDevice" />
          </template>
          <div v-else class="flex flex-col items-center gap-3 py-14 text-center text-sm text-muted-foreground">
            <ScanSearch class="size-8 opacity-50" />
            <p class="max-w-56">{{ t('panel.pickHint') }}</p>
          </div>
        </div>
      </aside>
    </div>

    <Drawer v-model:open="drawerOpen">
      <DrawerContent class="max-h-[88dvh]">
        <DrawerTitle class="sr-only">{{ ui.selectedDevice }}</DrawerTitle>
        <DrawerDescription class="sr-only">{{ t('panel.details') }}</DrawerDescription>
        <div class="overflow-y-auto px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <DeviceDetails v-if="ui.selectedDevice" :id="ui.selectedDevice" :key="ui.selectedDevice" />
        </div>
      </DrawerContent>
    </Drawer>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
