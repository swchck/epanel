<script setup lang="ts">
import { computed, ref, toRef, watch, watchEffect } from 'vue'
import { Camera, Maximize, Minus, Plus } from '@lucide/vue'
import { resolveAsset } from '@/domain/model'
import { areaM2, polygonCentroid } from '@/domain/geometry'
import type { PanelData, Route } from '@/domain/model'
import { CABLE_COLORS, POINT_COLORS, POINT_ICONS } from '@/components/common/kinds'
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
    // rooms let clicks fall through to the canvas (editor placement modes)
    passRooms?: boolean
    clickableRoutes?: boolean
    selectedRoute?: string | null
    selectedOpening?: string | null
  }>(),
  { interactive: true, mini: false, showRoutes: undefined, allLayers: false, cursor: undefined, passRooms: false, clickableRoutes: false, selectedRoute: null },
)
const emit = defineEmits<{
  point: [id: string]
  room: [id: string]
  photo: [id: string]
  route: [id: string]
  opening: [id: string]
  canvas: [x: number, y: number, e: PointerEvent | MouseEvent]
  move: [x: number, y: number]
  leave: []
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
const visibleRoutes = computed(() =>
  d.value.routes.filter((r) => {
    if (r.kind === 'power') return routesVisible.value
    if (r.kind === 'bus') return layer('bus') || routesVisible.value
    return layer('lowvoltage') || routesVisible.value
  }),
)
const pts = (r: Route) => r.points.map((p) => p.join(',')).join(' ')

function routeStroke(r: Route) {
  if (r.kind === 'bus') return '#16a34a'
  if (r.kind === 'low') return CABLE_COLORS[r.cables[0]?.type ?? 'other']
  return routeColor(r.device)
}
const bg = computed(() => resolveAsset(d.value.plan.background, assets.value))
const hasHighlight = computed(() => (props.highlightPoints?.size ?? 0) > 0)
const rooms = computed(() => d.value.rooms.filter((r) => r.polygon.length >= 3))

const roomLabels = computed(() =>
  rooms.value.map((r) => {
    // corner placement: fixtures usually sit in the middle of a room, labels there collide with them
    const xs = r.polygon.map((p) => p[0])
    const ys = r.polygon.map((p) => p[1])
    const c = props.mini ? polygonCentroid(r.polygon) : ([Math.min(...xs) + 16, Math.min(...ys) + 34] as const)
    return { room: r, c, area: areaM2(r.polygon) }
  }),
)

// wall lengths, labelled just inside each room so shared walls read from both sides
const dimensions = computed(() =>
  rooms.value
    .flatMap((r) => {
      const c = polygonCentroid(r.polygon)
      return r.polygon.map((a, i) => {
        const b = r.polygon[(i + 1) % r.polygon.length]!
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        const mx = (a[0] + b[0]) / 2
        const my = (a[1] + b[1]) / 2
        let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
        if (ang > 90) ang -= 180
        if (ang < -90) ang += 180
        const nx = c[0] - mx
        const ny = c[1] - my
        const nl = Math.hypot(nx, ny) || 1
        return { key: `${r.id}-${i}`, x: mx + (nx / nl) * 16, y: my + (ny / nl) * 16, ang, len }
      })
    })
    .filter((x) => x.len >= 60),
)

const markerR = computed(() => (props.mini ? 15 : 13))

// pan and zoom touch the DOM directly: going through the template would re-render every layer per frame
watchEffect(
  () => {
    const el = svg.value
    if (!el) return
    el.setAttribute('viewBox', pz.viewBox.value)
    el.style.setProperty('--mk', String(1 / Math.sqrt(Math.max(1, pz.scale.value))))
  },
  { flush: 'post' },
)

const roomPolygons = computed(() => rooms.value.map((r) => ({ room: r, points: r.polygon.map((p) => p.join(',')).join(' ') })))
const photos = computed(() => d.value.photos.filter((p) => p.x !== undefined && p.y !== undefined))

const points = computed(() =>
  d.value.points
    .filter((p) => layer(p.kind))
    .map((p) => {
      const dead = props.deadPoints?.has(p.id) ?? false
      const lit = props.highlightPoints?.has(p.id) ?? false
      const focus = props.focusPoint === p.id
      const dim = (hasHighlight.value && !lit && !focus) || (!!props.highlightRoom && p.room !== props.highlightRoom)
      return { p, dead, lit, focus, dim }
    }),
)

const litDevices = computed(() => {
  const out = new Set<string>()
  if (!hasHighlight.value) return out
  for (const p of d.value.points) if (p.device && props.highlightPoints!.has(p.id)) out.add(p.device)
  return out
})

function routeColor(device?: string) {
  const dev = device ? store.graph?.byId.get(device) : undefined
  return dev ? TYPE_ACCENT[dev.type] : '#888'
}

function routeLit(device?: string) {
  return !!device && litDevices.value.has(device)
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
      class="block h-full w-full touch-none select-none"
      :class="[interactive ? (pz.dragging.value ? 'cursor-grabbing' : 'cursor-grab') : '', cursor]"
      preserveAspectRatio="xMidYMid meet"
      v-on="interactive ? pz.handlers : {}"
      @click.self="onCanvasClick"
      @pointermove="onMove"
      @pointerleave="emit('leave')"
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

      <g>
        <polygon
          v-for="{ room: r, points: poly } in roomPolygons"
          :key="r.id"
          :points="poly"
          :fill="r.color ?? (r.wet ? 'var(--plan-wet)' : 'var(--plan-floor)')"
          :fill-opacity="bg && layer('background') ? 0.55 : 1"
          stroke="var(--plan-wall)"
          stroke-width="7"
          stroke-linejoin="round"
          class="transition-[fill-opacity,opacity] duration-300"
          :class="{ 'opacity-40': highlightRoom && highlightRoom !== r.id }"
          :pointer-events="passRooms ? 'none' : undefined"
          @click="!pz.wasDrag() && emit('room', r.id)"
        />
      </g>
      <g>
        <g
          v-for="o in d.plan.openings"
          :key="o.id"
          :transform="`translate(${o.x}, ${o.y}) rotate(${o.angle})`"
          class="opening"
          :class="{ 'is-selected': selectedOpening === o.id }"
          :pointer-events="passRooms ? 'none' : undefined"
          @click.stop="!pz.wasDrag() && emit('opening', o.id)"
        >
          <!-- floor-coloured patch cuts the gap out of the wall stroke underneath -->
          <rect :x="-o.width / 2" y="-5" :width="o.width" height="10" fill="var(--plan-floor)" />
          <template v-if="o.kind === 'door'">
            <line :x1="-o.width / 2" y1="0" :x2="-o.width / 2" :y2="o.flip ? o.width : -o.width" class="opening-line" />
            <path :d="`M ${-o.width / 2} ${o.flip ? o.width : -o.width} A ${o.width} ${o.width} 0 0 ${o.flip ? 0 : 1} ${o.width / 2} 0`" class="opening-swing" />
          </template>
          <template v-else>
            <line :x1="-o.width / 2" y1="-3.5" :x2="o.width / 2" y2="-3.5" class="opening-line" />
            <line :x1="-o.width / 2" y1="3.5" :x2="o.width / 2" y2="3.5" class="opening-line" />
            <line :x1="-o.width / 2" y1="-5" :x2="-o.width / 2" y2="5" class="opening-line" />
            <line :x1="o.width / 2" y1="-5" :x2="o.width / 2" y2="5" class="opening-line" />
          </template>
        </g>
      </g>
      <g pointer-events="none">
        <g v-for="l in roomLabels" :key="l.room.id" :transform="`translate(${l.c[0]}, ${l.c[1]})`">
          <text :text-anchor="mini ? 'middle' : 'start'" class="room-name" :class="{ 'room-name-mini': mini }">{{ tx(l.room.name) }}</text>
          <text v-if="!mini" y="20" text-anchor="start" class="room-area">{{ l.area.toFixed(1) }} {{ t('units.m2') }} · h {{ ((l.room.ceilingCm ?? d.plan.wallHeight) / 100).toFixed(2) }} {{ t('units.m') }}</text>
        </g>
      </g>

      <g v-if="layer('dimensions') && !mini" pointer-events="none">
        <text
          v-for="m in dimensions"
          :key="m.key"
          :transform="`translate(${m.x}, ${m.y}) rotate(${m.ang})`"
          text-anchor="middle"
          dominant-baseline="middle"
          class="dim"
        >
          {{ (m.len / 100).toFixed(2) }}
        </text>
      </g>

      <g>
        <g
          v-for="r in visibleRoutes"
          :key="r.id"
          :class="{ 'cursor-pointer': clickableRoutes, 'opacity-25': selectedRoute && selectedRoute !== r.id }"
          class="transition-opacity"
          @click.stop="clickableRoutes && !pz.wasDrag() && emit('route', r.id)"
        >
          <polyline v-if="routesVisible" :points="pts(r)" fill="none" stroke="url(#nodrill)" :stroke-width="r.safeWidth * 2" stroke-linecap="round" stroke-linejoin="round" pointer-events="none" />
          <!-- fat invisible hit area so thin lines are tappable on a phone -->
          <polyline v-if="clickableRoutes" :points="pts(r)" fill="none" stroke="transparent" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" />
          <template v-if="r.kind === 'conduit'">
            <polyline :points="pts(r)" fill="none" stroke="var(--muted-foreground)" :stroke-width="selectedRoute === r.id ? 13 : 10" stroke-opacity="0.45" stroke-linecap="round" stroke-linejoin="round" />
            <polyline :points="pts(r)" fill="none" stroke="var(--background)" stroke-width="4" stroke-dasharray="2 6" stroke-linecap="round" stroke-linejoin="round" />
            <circle v-for="(e, i) in [r.points[0]!, r.points.at(-1)!]" :key="i" :cx="e[0]" :cy="e[1]" r="7" fill="var(--background)" stroke="var(--muted-foreground)" stroke-width="3" />
          </template>
          <polyline
            v-else
            :points="pts(r)"
            fill="none"
            :stroke="routeStroke(r)"
:stroke-dasharray="r.mount === 'ceiling' ? '1 7' : r.kind === 'power' ? undefined : r.kind === 'low' ? '3 6' : '10 7'"
            :stroke-width="routeLit(r.device) || selectedRoute === r.id ? 5 : 3"
            stroke-linecap="round"
            stroke-linejoin="round"
            :class="{ 'flow-line': routeLit(r.device) || selectedRoute === r.id }"
          />
        </g>
      </g>

      <g v-if="layer('photos') && !mini">
        <g
          v-for="ph in photos"
          :key="ph.id"
          :transform="`translate(${ph.x}, ${ph.y})`"
          class="cursor-pointer"
          @click.stop="!pz.wasDrag() && emit('photo', ph.id)"
        >
          <g class="marker">
            <rect :x="-markerR" :y="-markerR" :width="markerR * 2" :height="markerR * 2" :rx="markerR * 0.35" fill="var(--foreground)" opacity="0.85" />
            <Camera :x="-markerR * 0.62" :y="-markerR * 0.62" :width="markerR * 1.24" :height="markerR * 1.24" color="var(--background)" :stroke-width="2.2" />
          </g>
        </g>
      </g>

      <g>
        <g
          v-for="{ p, dead, lit, focus, dim } in points"
          :key="p.id"
          :transform="`translate(${p.x}, ${p.y})`"
          class="point cursor-pointer"
          :class="{ 'is-dim': dim, 'is-dead': dead }"
          role="button"
          :aria-label="tx(p.label, t(`point.kind.${p.kind}`))"
          @click.stop="onPointClick(p.id)"
        >
          <g class="marker">
            <circle v-if="lit || focus" :r="markerR * 1.6" :fill="POINT_COLORS[p.kind]" class="pulse" />
            <circle :r="focus ? markerR * 1.3 : markerR" :fill="dead ? '#6b7280' : POINT_COLORS[p.kind]" stroke="var(--background)" :stroke-width="markerR * 0.22" />
            <circle v-if="p.concealed" :r="(focus ? markerR * 1.3 : markerR) + markerR * 0.35" fill="none" :stroke="POINT_COLORS[p.kind]" :stroke-width="markerR * 0.14" :stroke-dasharray="`${markerR * 0.3} ${markerR * 0.25}`" />
            <component
              :is="POINT_ICONS[p.kind]"
              :x="-markerR * 0.58"
              :y="-markerR * 0.58"
              :width="markerR * 1.16"
              :height="markerR * 1.16"
              color="white"
              :stroke-width="2.4"
            />
            <line v-if="dead" :x1="-markerR" :y1="markerR" :x2="markerR" :y2="-markerR" stroke="var(--danger)" :stroke-width="markerR * 0.25" stroke-linecap="round" />
            <text v-if="layer('labels') && !mini && p.device" :y="markerR + 13" text-anchor="middle" class="pid">{{ p.device }}</text>
          </g>
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
.dim {
  font-family: var(--font-mono);
  font-size: 12px;
  fill: var(--muted-foreground);
  paint-order: stroke;
  stroke: var(--plan-floor);
  stroke-width: 3px;
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
.marker {
  transform: scale(var(--mk, 1));
}
.point.is-dim {
  opacity: 0.22;
}
.pulse {
  transform-box: fill-box;
  transform-origin: center;
  animation: pulse-ring 1.6s ease-out infinite;
}
.opening {
  cursor: pointer;
}
.opening-line {
  stroke: var(--plan-wall);
  stroke-width: 2.5px;
  fill: none;
}
.opening-swing {
  stroke: var(--plan-wall);
  stroke-width: 1.5px;
  stroke-dasharray: 4 4;
  fill: none;
}
.opening.is-selected .opening-line,
.opening.is-selected .opening-swing {
  stroke: var(--primary);
}
</style>
