<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { Camera, Maximize, Minus, Plus } from '@lucide/vue'
import { resolveAsset } from '@/domain/bundle'
import { areaM2, polygonCentroid } from '@/domain/geometry'
import type { PanelData, PlanPoint } from '@/domain/schema'
import { POINT_COLORS, POINT_ICONS } from '@/components/common/kinds'
import { TYPE_ACCENT } from '@/components/panel/geometry'
import { usePanZoom } from '@/composables/usePanZoom'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'
import { useUi } from '@/stores/ui'

const props = withDefaults(
  defineProps<{
    data?: PanelData
    highlightPoints?: Set<string>
    highlightRoom?: string | null
    focusPoint?: string | null
    deadPoints?: Set<string>
    interactive?: boolean
    mini?: boolean
    showRoutes?: boolean
    // render every layer regardless of ui toggles (editor, print)
    allLayers?: boolean
    cursor?: string
  }>(),
  { interactive: true, mini: false, showRoutes: undefined, allLayers: false, cursor: undefined },
)
const emit = defineEmits<{
  point: [id: string]
  room: [id: string]
  photo: [id: string]
  canvas: [x: number, y: number, e: PointerEvent | MouseEvent]
  move: [x: number, y: number]
}>()

const store = useData()
const ui = useUi()
const { tx, t } = useText()
const d = computed(() => props.data ?? store.data!)
const assets = computed(() => store.assets)

const svg = ref<SVGSVGElement | null>(null)
const base = computed(() => ({ x: 0, y: 0, w: d.value.plan.width, h: d.value.plan.height }))
const pz = usePanZoom(svg, base, { enabled: toRef(() => props.interactive) })

const layer = (k: keyof typeof ui.planLayers) => props.allLayers || ui.planLayers[k]
const routesVisible = computed(() => props.showRoutes ?? layer('routes'))
const bg = computed(() => resolveAsset(d.value.plan.background, assets.value))
const hasHighlight = computed(() => (props.highlightPoints?.size ?? 0) > 0)

const roomLabels = computed(() =>
  d.value.rooms
    .filter((r) => r.polygon.length >= 3)
    .map((r) => ({ room: r, c: polygonCentroid(r.polygon), area: areaM2(r.polygon) })),
)

const markerR = computed(() => (props.mini ? 15 : 13) / Math.sqrt(Math.max(1, pz.scale.value)))

function pointState(p: PlanPoint) {
  const dead = props.deadPoints?.has(p.id) ?? false
  const lit = props.highlightPoints?.has(p.id) ?? false
  const focus = props.focusPoint === p.id
  const dim = (hasHighlight.value && !lit && !focus) || (!!props.highlightRoom && p.room !== props.highlightRoom)
  return { dead, lit, focus, dim }
}

function routeColor(device?: string) {
  const dev = device ? store.graph?.byId.get(device) : undefined
  return dev ? TYPE_ACCENT[dev.type] : '#888'
}

function routeLit(device?: string) {
  if (!hasHighlight.value || !device) return false
  return d.value.points.some((p) => p.device === device && props.highlightPoints!.has(p.id))
}

function onPointClick(id: string) {
  if (pz.wasDrag()) return
  emit('point', id)
}

function onCanvasClick(e: MouseEvent) {
  if (pz.wasDrag()) return
  const [x, y] = pz.toPlan(e.clientX, e.clientY)
  emit('canvas', x, y, e)
}

function onMove(e: PointerEvent) {
  const [x, y] = pz.toPlan(e.clientX, e.clientY)
  emit('move', x, y)
}

watch(
  () => props.focusPoint,
  (id) => {
    if (!id || props.mini) return
    const p = d.value.points.find((x) => x.id === id)
    if (p) pz.focus(p.x, p.y, 2)
  },
)

defineExpose({ pz })
</script>

<template>
  <div class="relative h-full w-full">
    <svg
      ref="svg"
      :viewBox="pz.viewBox.value"
      class="block h-full w-full touch-none select-none"
      :class="[interactive ? (pz.dragging.value ? 'cursor-grabbing' : 'cursor-grab') : '', cursor]"
      preserveAspectRatio="xMidYMid meet"
      v-on="interactive ? pz.handlers : {}"
      @click.self="onCanvasClick"
      @pointermove="onMove"
    >
      <defs>
        <pattern id="plan-grid" :width="d.plan.grid" :height="d.plan.grid" patternUnits="userSpaceOnUse">
          <path :d="`M ${d.plan.grid} 0 L 0 0 0 ${d.plan.grid}`" fill="none" stroke="var(--plan-grid)" stroke-width="1" />
        </pattern>
        <pattern id="nodrill" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill="var(--danger)" fill-opacity="0.12" />
          <line x1="0" y1="0" x2="0" y2="10" stroke="var(--danger)" stroke-opacity="0.45" stroke-width="3" />
        </pattern>
      </defs>

      <rect :width="d.plan.width" :height="d.plan.height" fill="url(#plan-grid)" pointer-events="none" />
      <image
        v-if="bg && layer('background')"
        :href="bg"
        x="0"
        y="0"
        :width="d.plan.width"
        :height="d.plan.height"
        preserveAspectRatio="xMidYMid meet"
        :opacity="d.plan.backgroundOpacity"
        pointer-events="none"
      />

      <!-- rooms -->
      <g>
        <polygon
          v-for="r in d.rooms.filter((x) => x.polygon.length >= 3)"
          :key="r.id"
          :points="r.polygon.map((p) => p.join(',')).join(' ')"
          :fill="r.color ?? (r.wet ? 'var(--plan-wet)' : 'var(--plan-floor)')"
          :fill-opacity="bg && layer('background') ? 0.55 : 1"
          stroke="var(--plan-wall)"
          stroke-width="7"
          stroke-linejoin="round"
          class="transition-[fill-opacity,opacity] duration-300"
          :class="{ 'opacity-40': highlightRoom && highlightRoom !== r.id }"
          @click="!pz.wasDrag() && emit('room', r.id)"
        />
      </g>
      <g pointer-events="none">
        <g v-for="l in roomLabels" :key="l.room.id" :transform="`translate(${l.c[0]}, ${l.c[1]})`">
          <text text-anchor="middle" class="room-name" :class="{ 'room-name-mini': mini }">{{ tx(l.room.name) }}</text>
          <text v-if="!mini" y="20" text-anchor="middle" class="room-area">{{ l.area.toFixed(1) }} {{ t('units.m2') }}</text>
        </g>
      </g>

      <!-- cable routes and no-drill strips -->
      <g v-if="routesVisible" pointer-events="none">
        <g v-for="r in d.routes" :key="r.id">
          <polyline :points="r.points.map((p) => p.join(',')).join(' ')" fill="none" stroke="url(#nodrill)" :stroke-width="r.safeWidth * 2" stroke-linecap="round" stroke-linejoin="round" />
          <polyline
            :points="r.points.map((p) => p.join(',')).join(' ')"
            fill="none"
            :stroke="routeColor(r.device)"
            :stroke-width="routeLit(r.device) ? 5 : 3"
            stroke-linecap="round"
            stroke-linejoin="round"
            :class="{ 'flow-line': routeLit(r.device) }"
          />
        </g>
      </g>

      <!-- photo markers -->
      <g v-if="layer('photos') && !mini">
        <g
          v-for="ph in d.photos.filter((p) => p.x !== undefined && p.y !== undefined)"
          :key="ph.id"
          :transform="`translate(${ph.x}, ${ph.y})`"
          class="cursor-pointer"
          @click.stop="!pz.wasDrag() && emit('photo', ph.id)"
        >
          <rect :x="-markerR" :y="-markerR" :width="markerR * 2" :height="markerR * 2" :rx="markerR * 0.35" fill="var(--foreground)" opacity="0.85" />
          <Camera :x="-markerR * 0.62" :y="-markerR * 0.62" :width="markerR * 1.24" :height="markerR * 1.24" color="var(--background)" :stroke-width="2.2" />
        </g>
      </g>

      <!-- points -->
      <g>
        <g
          v-for="p in d.points.filter((x) => layer(x.kind))"
          :key="p.id"
          :transform="`translate(${p.x}, ${p.y})`"
          class="point cursor-pointer"
          :class="{ 'is-dim': pointState(p).dim, 'is-dead': pointState(p).dead }"
          role="button"
          :aria-label="tx(p.label, t(`point.kind.${p.kind}`))"
          @click.stop="onPointClick(p.id)"
        >
          <circle v-if="pointState(p).lit || pointState(p).focus" :r="markerR * 1.6" :fill="POINT_COLORS[p.kind]" class="pulse" />
          <circle
            :r="pointState(p).focus ? markerR * 1.3 : markerR"
            :fill="pointState(p).dead ? '#6b7280' : POINT_COLORS[p.kind]"
            stroke="var(--background)"
            :stroke-width="markerR * 0.22"
          />
          <component
            :is="POINT_ICONS[p.kind]"
            :x="-markerR * 0.58"
            :y="-markerR * 0.58"
            :width="markerR * 1.16"
            :height="markerR * 1.16"
            color="white"
            :stroke-width="2.4"
          />
          <line v-if="pointState(p).dead" :x1="-markerR" :y1="markerR" :x2="markerR" :y2="-markerR" stroke="var(--danger)" :stroke-width="markerR * 0.25" stroke-linecap="round" />
          <text v-if="layer('labels') && !mini && p.device" :y="markerR + 13" text-anchor="middle" class="pid">{{ p.device }}</text>
        </g>
      </g>
      <slot :pz="pz" />
    </svg>

    <div v-if="interactive && !mini" class="no-print absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-lg border bg-card/90 shadow-sm backdrop-blur">
      <button class="p-2 hover:bg-accent" :aria-label="$t('plan.zoomIn')" @click="pz.zoomBy(1.4)"><Plus class="size-4" /></button>
      <button class="border-y p-2 hover:bg-accent" :aria-label="$t('plan.zoomOut')" @click="pz.zoomBy(1 / 1.4)"><Minus class="size-4" /></button>
      <button class="p-2 hover:bg-accent" :aria-label="$t('plan.fit')" @click="pz.reset()"><Maximize class="size-4" /></button>
    </div>
  </div>
</template>

<style scoped>
.room-name {
  font-family: var(--font-sans);
  font-size: 22px;
  font-weight: 600;
  fill: var(--foreground);
  opacity: 0.75;
}
.room-name-mini {
  font-size: 30px;
}
.room-area {
  font-family: var(--font-mono);
  font-size: 15px;
  fill: var(--muted-foreground);
}
.pid {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  fill: var(--foreground);
  paint-order: stroke;
  stroke: var(--background);
  stroke-width: 3px;
}
.point {
  transition: opacity 0.25s ease;
}
.point.is-dim {
  opacity: 0.22;
}
.pulse {
  transform-box: fill-box;
  transform-origin: center;
  animation: pulse-ring 1.6s ease-out infinite;
}
</style>
