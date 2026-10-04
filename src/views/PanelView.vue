<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { FilterX, MapPin, Power, RotateCcw, ScanSearch, TriangleAlert, X, ZoomIn, ZoomOut } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import ContactList from '@/components/common/ContactList.vue'
import DeviceDetails from '@/components/panel/DeviceDetails.vue'
import PanelEnclosure from '@/components/panel/PanelEnclosure.vue'
import { TYPE_ACCENT } from '@/components/panel/geometry'
import { pointPowered } from '@/domain/graph'
import type { DeviceType } from '@/domain/model'
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
    <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">{{ tx(data.data?.meta.title) }}</h1>
        <p v-if="data.data?.meta.location" class="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin class="size-4" /> {{ tx(data.data.meta.location) }}
        </p>
      </div>
      <dl class="flex overflow-hidden rounded-xl border bg-card">
        <div v-for="s in stats" :key="s.k" class="flex flex-col-reverse border-r px-4 py-2 last:border-r-0">
          <dt class="text-xs whitespace-nowrap text-muted-foreground">{{ s.k }}</dt>
          <dd class="text-lg leading-tight font-semibold tabular">{{ s.v }}</dd>
        </div>
        <RouterLink v-if="errors || warns" to="/checks" class="group flex flex-col-reverse px-4 py-2 transition hover:bg-accent">
          <dt class="text-xs whitespace-nowrap text-muted-foreground group-hover:text-foreground">{{ errors ? t('panel.stat.errors') : t('panel.stat.warnings') }}</dt>
          <dd class="flex items-center gap-1.5 text-lg leading-tight font-semibold tabular" :class="errors ? 'text-danger' : 'text-warn'">
            <span class="size-2 rounded-full" :class="errors ? 'bg-danger' : 'bg-warn'" />{{ errors || warns }}
          </dd>
        </RouterLink>
      </dl>
    </div>

    <div class="no-print mb-4 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <div class="mr-auto flex flex-wrap gap-0.5 rounded-xl border bg-card p-1" role="group" :aria-label="t('panel.types')">
          <button
            v-for="tp in presentTypes"
            :key="tp"
            class="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-sm transition"
            :class="ui.filterTypes.includes(tp) ? 'bg-accent text-foreground ring-1 ring-foreground/15' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'"
            :aria-pressed="ui.filterTypes.includes(tp)"
            @click="toggleType(tp)"
          >
            <span class="size-2 rounded-full" :style="{ background: TYPE_ACCENT[tp] }" />
            {{ t(`device.typeShort.${tp}`) }}
          </button>
        </div>
        <label class="flex h-9 items-center gap-2 rounded-xl border bg-card px-3 text-sm" :class="{ 'border-live/60 bg-live/10': ui.simulate }">
          <Power class="size-4" :class="ui.simulate ? 'text-live' : 'text-muted-foreground'" />
          {{ t('panel.simulate') }}
          <Switch v-model="ui.simulate" />
        </label>
        <Button variant="outline" size="icon" class="hidden size-9 rounded-xl md:inline-flex" :aria-label="t('panel.zoom')" @click="zoomed = !zoomed">
          <component :is="zoomed ? ZoomOut : ZoomIn" />
        </Button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Select :model-value="ui.filterRoom ?? '__all'" @update:model-value="(v) => (ui.filterRoom = v === '__all' ? null : (v as string))">
          <SelectTrigger class="min-w-40 bg-card" :aria-label="t('panel.allRooms')"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{{ t('panel.allRooms') }}</SelectItem>
            <SelectItem v-for="r in data.data?.rooms" :key="r.id" :value="r.id">{{ tx(r.name) }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-if="tags.length" :model-value="ui.filterTag ?? '__all'" @update:model-value="(v) => (ui.filterTag = v === '__all' ? null : (v as string))">
          <SelectTrigger class="min-w-32 bg-card" :aria-label="t('panel.allTags')"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{{ t('panel.allTags') }}</SelectItem>
            <SelectItem v-for="tag in tags" :key="tag" :value="tag">#{{ tag }}</SelectItem>
          </SelectContent>
        </Select>
        <button
          class="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition"
          :class="ui.filterIssues ? 'border-warn/60 bg-warn/15 text-foreground' : 'bg-card text-muted-foreground hover:text-foreground'"
          :aria-pressed="ui.filterIssues"
          @click="ui.filterIssues = !ui.filterIssues"
        >
          <TriangleAlert class="size-4" :class="ui.filterIssues ? 'text-warn' : ''" />
          {{ t('panel.onlyIssues') }}
        </button>
        <Button v-if="ui.filtersActive" variant="ghost" size="sm" class="h-8" @click="ui.clearFilters()"><FilterX /> {{ t('panel.clearFilters') }}</Button>
      </div>
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
        <div class="overflow-x-auto rounded-2xl">
          <div :class="zoomed ? 'w-[1100px]' : 'mx-auto max-w-[900px]'">
            <PanelEnclosure @select="onSelect" />
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span class="flex items-center gap-1.5"><span class="inline-block h-2 w-3 rounded-sm bg-[#d93a2b]" /> {{ t('panel.legend.on') }}</span>
          <span class="flex items-center gap-1.5"><span class="inline-block h-2 w-3 rounded-sm bg-[#2f9e44]" /> {{ t('panel.legend.off') }}</span>
          <span class="flex items-center gap-1.5"><span class="inline-block size-2 rounded-full bg-live" /> {{ t('panel.legend.live') }}</span>
          <span class="flex items-center gap-1.5"><span class="inline-block size-3 rounded-full bg-warn text-center text-[8px] leading-3 font-bold text-white">!</span> {{ t('panel.legend.issue') }}</span>
          <span>{{ t('panel.legend.tap') }}</span>
        </div>
        <section v-if="!wide && data.data?.meta.contacts.length" class="no-print mt-6">
          <h2 class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{{ t('emergency.contacts') }}</h2>
          <ContactList compact />
        </section>
      </div>

      <aside v-if="wide" class="no-print">
        <div class="sticky top-[calc(var(--titlebar)+1.5rem)] max-h-[calc(100dvh-3rem-var(--titlebar))] overflow-y-auto rounded-2xl border bg-card p-5">
          <template v-if="ui.selectedDevice">
            <button class="float-right -mt-1 -mr-1 rounded-md p-1 text-muted-foreground hover:bg-accent" :aria-label="t('common.close')" @click="ui.select(null)">
              <X class="size-4" />
            </button>
            <DeviceDetails :id="ui.selectedDevice" :key="ui.selectedDevice" />
          </template>
          <template v-else>
            <div class="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
              <ScanSearch class="size-8 opacity-50" />
              <p class="max-w-56">{{ t('panel.pickHint') }}</p>
            </div>
            <section v-if="data.data?.meta.contacts.length" class="border-t pt-4">
              <h2 class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{{ t('emergency.contacts') }}</h2>
              <ContactList compact />
            </section>
          </template>
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
