<script setup lang="ts">
import { computed } from 'vue'
import { Cable as CableIcon, Spline } from '@lucide/vue'
import { MOUNT_DEFAULT, routeHeight, type Route } from '@/domain/schema'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'
import DeviceChip from './DeviceChip.vue'
import { CABLE_COLORS } from './kinds'

const props = defineProps<{ route: Route }>()
const data = useData()
const { t, tx } = useText()
const device = computed(() => (props.route.device ? data.graph?.byId.get(props.route.device) : undefined))
const lengthM = computed(() => {
  let s = 0
  const p = props.route.points
  for (let i = 1; i < p.length; i++) s += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1])
  return s / 100
})
const mountText = computed(() => {
  const mount = props.route.mount ?? (props.route.elevation !== undefined ? 'wall' : MOUNT_DEFAULT[props.route.kind])
  return mount === 'wall' ? t('route.mount.wallAt', { cm: routeHeight(props.route, 0) }) : t(`route.mount.${mount}`)
})
const total = computed(() => props.route.cables.reduce((n, c) => n + c.count, 0))
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start gap-3">
      <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
        <component :is="route.kind === 'conduit' ? Spline : CableIcon" class="size-5" />
      </div>
      <div class="min-w-0">
        <div class="font-semibold">{{ t(`editor.plan.routeKinds.${route.kind}`) }}<template v-if="route.diameterMm"> ⌀{{ route.diameterMm }} {{ t('units.mm') }}</template></div>
        <div class="text-sm text-muted-foreground">
          ≈ {{ lengthM.toFixed(1) }} {{ t('units.m') }} · {{ mountText }}
        </div>
      </div>
    </div>

    <div v-if="route.from || route.to" class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border p-3 text-sm">
      <span class="text-muted-foreground">{{ t('editor.plan.from') }}</span><span>{{ tx(route.from, '—') }}</span>
      <span class="text-muted-foreground">{{ t('editor.plan.to') }}</span><span>{{ tx(route.to, '—') }}</span>
    </div>

    <div v-if="device" class="flex items-center gap-2 text-sm">
      <RouterLink :to="`/d/${device.id}`"><DeviceChip :device="device" size="sm" /></RouterLink>
      <span class="truncate">{{ tx(device.label) }}</span>
    </div>

    <div v-if="route.kind === 'low' || route.kind === 'conduit'">
      <div class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{{ t('route.inside', { n: total }) }}</div>
      <ul v-if="route.cables.length" class="space-y-1.5">
        <li v-for="(c, i) in route.cables" :key="i" class="flex items-center gap-2.5 text-sm">
          <span class="h-1.5 w-5 rounded-full" :style="{ background: CABLE_COLORS[c.type] }" />
          <span class="flex-1">{{ t(`cable.${c.type}`) }}<template v-if="c.count > 1"> × {{ c.count }}</template></span>
          <span v-if="c.label" class="font-mono text-xs text-muted-foreground">{{ c.label }}</span>
        </li>
      </ul>
      <p v-else class="text-sm text-muted-foreground">{{ t('route.empty') }}</p>
      <p v-if="route.kind === 'conduit'" class="mt-3 rounded-lg px-3 py-2 text-sm" :class="route.pullString ? 'bg-ok/12' : 'bg-muted'">
        {{ route.pullString ? t('route.pullYes') : t('route.pullNo') }}
      </p>
    </div>

    <p v-if="route.note" class="text-sm">{{ tx(route.note) }}</p>
    <p class="text-xs text-muted-foreground">{{ t('route.nodrill', { cm: route.safeWidth }) }}</p>
  </div>
</template>
