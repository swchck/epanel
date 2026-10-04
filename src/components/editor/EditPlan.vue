<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Camera, Check, ImagePlus, Magnet, MousePointer2, Pentagon, Plug, Spline, Trash2, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { POINT_COLORS, POINT_ICONS } from '@/components/common/kinds'
import FloorPlan from '@/components/plan/FloorPlan.vue'
import { ASSET_PREFIX } from '@/domain/bundle'
import { pointInPolygon, snap as snapTo } from '@/domain/geometry'
import { APPLIANCE_PROFILES, CABLE_TYPES, MOUNT_DEFAULT, POINT_KINDS, ROUTE_KINDS, type Point2, type PointKind, type RouteKind } from '@/domain/schema'
import { uniqueId } from '@/editor/ops'
import { compressImage, newId, planImageFrom } from '@/lib/media'
import { useDraft } from '@/composables/useDraft'
import { useText } from '@/composables/useText'
import { openBinaryFiles } from '@/platform'
import FormRow from './FormRow.vue'
import LocalizedInput from './LocalizedInput.vue'
import NumberInput from './NumberInput.vue'

type Mode = 'select' | 'room' | 'point' | 'route' | 'photo'
type Sel = { kind: 'point' | 'room' | 'route' | 'photo'; id: string } | null

const { d, assets, data } = useDraft()
const { t, tx } = useText()
const mode = ref<Mode>('select')
const sel = ref<Sel>(null)
const snapOn = ref(true)
const pending = ref<Point2[]>([])
const cursor = ref<Point2 | null>(null)
const newKind = ref<PointKind>('socket')
const newDevice = ref<string>('__')
const newRouteKind = ref<RouteKind>('power')
const busy = ref(false)
const plan = ref<InstanceType<typeof FloorPlan> | null>(null)

const MODES: { id: Mode; icon: typeof Plug }[] = [
  { id: 'select', icon: MousePointer2 },
  { id: 'room', icon: Pentagon },
  { id: 'point', icon: Plug },
  { id: 'route', icon: Spline },
  { id: 'photo', icon: Camera },
]

function sn(v: number) {
  return snapOn.value ? snapTo(v, d.value.plan.grid / 5) : Math.round(v)
}

const point = computed(() => (sel.value?.kind === 'point' ? d.value.points.find((p) => p.id === sel.value!.id) : undefined))
const room = computed(() => (sel.value?.kind === 'room' ? d.value.rooms.find((p) => p.id === sel.value!.id) : undefined))
const route = computed(() => (sel.value?.kind === 'route' ? d.value.routes.find((p) => p.id === sel.value!.id) : undefined))
const photo = computed(() => (sel.value?.kind === 'photo' ? d.value.photos.find((p) => p.id === sel.value!.id) : undefined))
const feeders = computed(() => d.value.devices.filter((x) => ['mcb', 'rcbo', 'din-socket', 'switch', 'contactor', 'actuator'].includes(x.type)))

function roomAt(x: number, y: number) {
  return d.value.rooms.find((r) => r.polygon.length >= 3 && pointInPolygon(x, y, r.polygon))?.id
}

function setMode(m: Mode) {
  pending.value = []
  mode.value = m
  if (m !== 'select') sel.value = null
}

async function onCanvas(x: number, y: number) {
  const px = sn(x)
  const py = sn(y)
  if (mode.value === 'select') {
    sel.value = null
  } else if (mode.value === 'room' || mode.value === 'route') {
    const first = pending.value[0]
    // clicking the first vertex again closes the polygon
    if (mode.value === 'room' && first && pending.value.length >= 3 && Math.hypot(first[0] - px, first[1] - py) < d.value.plan.grid / 3) return finish()
    pending.value.push([px, py])
  } else if (mode.value === 'point') {
    const id = uniqueId(
      d.value.points.map((p) => p.id),
      `${newKind.value.slice(0, 3)}-`,
    )
    d.value.points.push({ id, kind: newKind.value, x: px, y: py, room: roomAt(px, py), device: newDevice.value === '__' ? undefined : newDevice.value, count: 1, controls: [] })
    sel.value = { kind: 'point', id }
  } else if (mode.value === 'photo') {
    const [file] = await openBinaryFiles('image/*')
    if (!file) return
    busy.value = true
    try {
      const img = await compressImage(file.blob)
      const assetId = newId('photo')
      assets.value[assetId] = img.url
      const id = uniqueId(
        d.value.photos.map((p) => p.id),
        'ph-',
      )
      d.value.photos.push({ id, src: ASSET_PREFIX + assetId, x: px, y: py, room: roomAt(px, py), date: new Date().toISOString().slice(0, 10) })
      sel.value = { kind: 'photo', id }
      mode.value = 'select'
    } finally {
      busy.value = false
    }
  }
}

function finish() {
  if (mode.value === 'room' && pending.value.length >= 3) {
    const id = uniqueId(
      d.value.rooms.map((r) => r.id),
      'room-',
    )
    d.value.rooms.push({ id, name: t('editor.plan.roomN', { n: d.value.rooms.length + 1 }), wet: false, polygon: pending.value })
    sel.value = { kind: 'room', id }
  } else if (mode.value === 'route' && pending.value.length >= 2) {
    const id = uniqueId(
      d.value.routes.map((r) => r.id),
      'rt-',
    )
    d.value.routes.push({
      id,
      points: pending.value,
      device: newRouteKind.value === 'power' || newRouteKind.value === 'bus' ? (newDevice.value === '__' ? undefined : newDevice.value) : undefined,
      safeWidth: 15,
      kind: newRouteKind.value,
      cables: newRouteKind.value === 'low' ? [{ type: 'ethernet', count: 1 }] : [],
    })
    sel.value = { kind: 'route', id }
  }
  pending.value = []
  mode.value = 'select'
}

function onPoint(id: string) {
  if (mode.value === 'select' || mode.value === 'point') sel.value = { kind: 'point', id }
}

function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.closest('input,textarea')) return
  if (e.key === 'Escape') {
    pending.value = []
    if (mode.value !== 'select') mode.value = 'select'
    else sel.value = null
  } else if (e.key === 'Enter' && pending.value.length) finish()
  else if ((e.key === 'Delete' || e.key === 'Backspace') && sel.value) removeSelected()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function removeSelected() {
  const s = sel.value
  if (!s) return
  if (s.kind === 'point') d.value.points = d.value.points.filter((p) => p.id !== s.id)
  if (s.kind === 'room') {
    d.value.rooms = d.value.rooms.filter((p) => p.id !== s.id)
    for (const p of d.value.points) if (p.room === s.id) p.room = undefined
  }
  if (s.kind === 'route') d.value.routes = d.value.routes.filter((p) => p.id !== s.id)
  if (s.kind === 'photo') d.value.photos = d.value.photos.filter((p) => p.id !== s.id)
  sel.value = null
}

// drag handles live in the FloorPlan slot and share its pan/zoom transform
let dragTarget: { set: (x: number, y: number) => void } | null = null
function startDrag(e: PointerEvent, set: (x: number, y: number) => void) {
  e.stopPropagation()
  e.preventDefault()
  dragTarget = { set }
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', endDrag, { once: true })
}
function onDrag(e: PointerEvent) {
  const pz = plan.value?.pz
  if (!dragTarget || !pz) return
  const [x, y] = pz.toPlan(e.clientX, e.clientY)
  dragTarget.set(sn(x), sn(y))
}
function endDrag() {
  window.removeEventListener('pointermove', onDrag)
  if (point.value) point.value.room = roomAt(point.value.x, point.value.y)
  dragTarget = null
}

const handleR = computed(() => 9 / Math.sqrt(Math.max(1, plan.value?.pz.scale.value ?? 1)))

async function uploadBackground() {
  const [file] = await openBinaryFiles('image/*,application/pdf')
  if (!file) return
  busy.value = true
  try {
    const img = await planImageFrom(file.blob)
    const assetId = newId('plan')
    assets.value[assetId] = img.url
    d.value.plan.background = ASSET_PREFIX + assetId
    // keep the plan width in centimetres and follow the image's aspect ratio
    d.value.plan.height = Math.round((d.value.plan.width * img.height) / img.width)
    toast.success(t('editor.plan.bgLoaded'))
  } catch (e) {
    toast.error(t('editor.plan.bgFailed'), { description: (e as Error).message })
  } finally {
    busy.value = false
  }
}

async function replacePhoto() {
  if (!photo.value) return
  const [file] = await openBinaryFiles('image/*')
  if (!file) return
  const img = await compressImage(file.blob)
  const assetId = newId('photo')
  assets.value[assetId] = img.url
  photo.value.src = ASSET_PREFIX + assetId
}

const opacity = computed({
  get: () => [d.value.plan.backgroundOpacity],
  set: (v: number[]) => (d.value.plan.backgroundOpacity = v[0] ?? 0.6),
})

const hint = computed(() => t(`editor.plan.hint.${mode.value}`))
</script>

<template>
  <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
    <div class="min-w-0 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex overflow-hidden rounded-lg border">
          <button
            v-for="m in MODES"
            :key="m.id"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm transition"
            :class="mode === m.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'"
            @click="setMode(m.id)"
          >
            <component :is="m.icon" class="size-4" />
            <span class="hidden sm:inline">{{ t(`editor.plan.mode.${m.id}`) }}</span>
          </button>
        </div>
        <template v-if="mode === 'point'">
          <Select v-model="newKind">
            <SelectTrigger class="h-8 w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="k in POINT_KINDS" :key="k" :value="k">{{ t(`point.kind.${k}`) }}</SelectItem>
            </SelectContent>
          </Select>
        </template>
        <Select v-if="mode === 'route'" v-model="newRouteKind">
          <SelectTrigger class="h-8 w-auto"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="k in ROUTE_KINDS" :key="k" :value="k">{{ t(`editor.plan.routeKinds.${k}`) }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-if="mode === 'point' || (mode === 'route' && (newRouteKind === 'power' || newRouteKind === 'bus'))" v-model="newDevice">
          <SelectTrigger class="h-8 w-auto"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__">{{ t('editor.plan.noDevice') }}</SelectItem>
            <SelectItem v-for="f in feeders" :key="f.id" :value="f.id">{{ f.id }} · {{ tx(f.label) }}</SelectItem>
          </SelectContent>
        </Select>
        <template v-if="pending.length">
          <Button size="sm" @click="finish"><Check /> {{ t('editor.plan.finish') }}</Button>
          <Button size="sm" variant="ghost" @click="pending = []"><X /> {{ t('common.cancel') }}</Button>
        </template>
        <div class="flex-1" />
        <label class="flex items-center gap-1.5 text-xs"><Magnet class="size-3.5" /><Switch v-model="snapOn" class="scale-90" /></label>
        <Button size="sm" variant="outline" :disabled="busy" @click="uploadBackground"><ImagePlus /> {{ t('editor.plan.background') }}</Button>
      </div>
      <p class="text-xs text-muted-foreground">{{ hint }}</p>

      <div class="relative aspect-[3/2] overflow-hidden rounded-2xl border bg-card">
        <FloorPlan
          ref="plan"
          all-layers
          show-routes
          :pass-rooms="mode !== 'select'"
          :focus-point="point?.id"
          :highlight-room="room?.id ?? null"
          :cursor="mode === 'select' ? undefined : '!cursor-crosshair'"
          @canvas="onCanvas"
          @point="onPoint"
          @room="(id) => mode === 'select' && (sel = { kind: 'room', id })"
          @photo="(id) => (sel = { kind: 'photo', id })"
          @move="(x, y) => (cursor = [sn(x), sn(y)])"
        >
          <!-- in-progress shape -->
          <g v-if="pending.length" pointer-events="none">
            <polyline
              :points="[...pending, ...(cursor ? [cursor] : [])].map((p) => p.join(',')).join(' ')"
              fill="none"
              stroke="var(--primary)"
              stroke-width="4"
              stroke-dasharray="10 6"
            />
            <circle v-for="(p, i) in pending" :key="i" :cx="p[0]" :cy="p[1]" :r="handleR" fill="var(--primary)" />
            <text v-if="cursor && pending.length" :x="cursor[0] + 14" :y="cursor[1] - 14" class="seg-len">{{ (Math.hypot(cursor[0] - pending.at(-1)![0], cursor[1] - pending.at(-1)![1]) / 100).toFixed(2) }} {{ t('units.m') }}</text>
          </g>
          <!-- handles -->
          <template v-if="mode === 'select'">
            <circle
              v-if="point"
              :cx="point.x"
              :cy="point.y"
              :r="handleR * 2.2"
              fill="transparent"
              stroke="var(--primary)"
              stroke-width="3"
              class="cursor-move"
              @pointerdown="(e) => startDrag(e, (x, y) => ((point!.x = x), (point!.y = y)))"
            />
            <template v-if="room">
              <circle
                v-for="(v, i) in room.polygon"
                :key="i"
                :cx="v[0]"
                :cy="v[1]"
                :r="handleR"
                fill="var(--background)"
                stroke="var(--primary)"
                stroke-width="3"
                class="cursor-move"
                @pointerdown="(e) => startDrag(e, (x, y) => (room!.polygon[i] = [x, y]))"
              />
            </template>
            <template v-if="route">
              <circle
                v-for="(v, i) in route.points"
                :key="i"
                :cx="v[0]"
                :cy="v[1]"
                :r="handleR"
                fill="var(--background)"
                stroke="var(--danger)"
                stroke-width="3"
                class="cursor-move"
                @pointerdown="(e) => startDrag(e, (x, y) => (route!.points[i] = [x, y]))"
              />
            </template>
            <circle
              v-if="photo && photo.x !== undefined"
              :cx="photo.x"
              :cy="photo.y"
              :r="handleR * 2.2"
              fill="transparent"
              stroke="var(--primary)"
              stroke-width="3"
              class="cursor-move"
              @pointerdown="(e) => startDrag(e, (x, y) => ((photo!.x = x), (photo!.y = y)))"
            />
          </template>
        </FloorPlan>
      </div>

      <div class="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-5">
        <FormRow :label="t('editor.plan.wallHeight')"><NumberInput v-model="d.plan.wallHeight" :suffix="t('units.cm')" /></FormRow>
        <FormRow :label="t('editor.plan.width')"><NumberInput v-model="d.plan.width" :suffix="t('units.cm')" /></FormRow>
        <FormRow :label="t('editor.plan.height')"><NumberInput v-model="d.plan.height" :suffix="t('units.cm')" /></FormRow>
        <FormRow :label="t('editor.plan.grid')"><NumberInput v-model="d.plan.grid" :suffix="t('units.cm')" /></FormRow>
        <FormRow v-if="d.plan.background" :label="t('editor.plan.opacity')">
          <div class="flex items-center gap-2 pt-2">
            <Slider v-model="opacity" :min="0" :max="1" :step="0.05" class="flex-1" />
            <Button variant="ghost" size="icon-sm" :aria-label="t('common.delete')" @click="d.plan.background = undefined"><Trash2 /></Button>
          </div>
        </FormRow>
      </div>
    </div>

    <aside class="space-y-4">
      <div v-if="point" class="space-y-3 rounded-2xl border bg-card p-4">
        <div class="flex items-center gap-2">
          <component :is="POINT_ICONS[point.kind]" class="size-5" :style="{ color: POINT_COLORS[point.kind] }" />
          <span class="mr-auto font-mono text-xs text-muted-foreground">{{ point.id }}</span>
          <Button variant="destructive" size="icon-sm" :aria-label="t('common.delete')" @click="removeSelected"><Trash2 /></Button>
        </div>
        <FormRow :label="t('editor.plan.kind')">
          <Select v-model="point.kind">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem v-for="k in POINT_KINDS" :key="k" :value="k">{{ t(`point.kind.${k}`) }}</SelectItem></SelectContent>
          </Select>
        </FormRow>
        <FormRow :label="t('editor.plan.label')"><LocalizedInput v-model="point.label" /></FormRow>
        <FormRow :label="t('editor.plan.device')">
          <Select :model-value="point.device ?? '__'" @update:model-value="(v) => (point!.device = v === '__' ? undefined : (v as string))">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__">{{ t('editor.plan.noDevice') }}</SelectItem>
              <SelectItem v-for="f in feeders" :key="f.id" :value="f.id">{{ f.id }} · {{ tx(f.label) }}</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
        <FormRow :label="t('editor.plan.room')">
          <Select :model-value="point.room ?? '__'" @update:model-value="(v) => (point!.room = v === '__' ? undefined : (v as string))">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__">—</SelectItem>
              <SelectItem v-for="r in d.rooms" :key="r.id" :value="r.id">{{ tx(r.name) }}</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
        <div class="grid grid-cols-3 gap-2">
          <FormRow :label="t('editor.plan.power')"><NumberInput v-model="point.powerW" suffix="W" /></FormRow>
          <FormRow :label="t('editor.plan.count')"><NumberInput :model-value="point.count" @update:model-value="(v) => (point!.count = Math.max(1, Math.round(v ?? 1)))" /></FormRow>
          <FormRow :label="t('editor.plan.heightMm')"><NumberInput v-model="point.heightMm" :suffix="t('units.mm')" /></FormRow>
        </div>
        <FormRow v-if="point.kind === 'panel' || point.kind === 'sensor'" :label="t('editor.plan.controls')" :hint="t('editor.plan.controlsHint')">
          <Input
            :model-value="point.controls.join(', ')"
            class="font-mono text-xs"
            placeholder="1/1/1, 3/1/1"
            @update:model-value="(v) => (point!.controls = String(v).split(',').map((s) => s.trim()).filter(Boolean))"
          />
        </FormRow>
        <FormRow :label="t('editor.plan.profile')" :hint="t('editor.plan.profileHint')">
          <Select :model-value="point.profile ?? '__'" @update:model-value="(v) => (point!.profile = v === '__' ? undefined : (v as never))">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__">—</SelectItem>
              <SelectItem v-for="p in APPLIANCE_PROFILES" :key="p" :value="p">{{ t(`point.profile.${p}`) }}</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
      </div>

      <div v-else-if="room" class="space-y-3 rounded-2xl border bg-card p-4">
        <div class="flex items-center gap-2">
          <Pentagon class="size-5 text-primary" />
          <span class="mr-auto font-mono text-xs text-muted-foreground">{{ room.id }}</span>
          <Button variant="destructive" size="icon-sm" :aria-label="t('common.delete')" @click="removeSelected"><Trash2 /></Button>
        </div>
        <FormRow :label="t('editor.plan.roomName')"><LocalizedInput v-model="room.name" /></FormRow>
        <label class="flex items-center gap-2 text-sm"><Switch v-model="room.wet" /> {{ t('editor.plan.wet') }}</label>
        <FormRow :label="t('editor.plan.ceiling')" :hint="t('editor.plan.ceilingHint', { cm: d.plan.wallHeight })"><NumberInput v-model="room.ceilingCm" :suffix="t('units.cm')" :placeholder="String(d.plan.wallHeight)" /></FormRow>
        <p class="text-xs text-muted-foreground">{{ t('editor.plan.roomHint') }}</p>
      </div>

      <div v-else-if="route" class="space-y-3 rounded-2xl border bg-card p-4">
        <div class="flex items-center gap-2">
          <Spline class="size-5 text-danger" />
          <span class="mr-auto font-mono text-xs text-muted-foreground">{{ route.id }}</span>
          <Button variant="destructive" size="icon-sm" :aria-label="t('common.delete')" @click="removeSelected"><Trash2 /></Button>
        </div>
        <FormRow :label="t('editor.plan.routeKind')">
          <Select v-model="route.kind">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="k in ROUTE_KINDS" :key="k" :value="k">{{ t(`editor.plan.routeKinds.${k}`) }}</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
        <template v-if="route.kind === 'low' || route.kind === 'conduit'">
          <div class="grid grid-cols-2 gap-2">
            <FormRow :label="t('editor.plan.from')"><LocalizedInput v-model="route.from" /></FormRow>
            <FormRow :label="t('editor.plan.to')"><LocalizedInput v-model="route.to" /></FormRow>
          </div>
          <div class="space-y-1.5">
            <div class="text-xs font-medium text-muted-foreground">{{ t('editor.plan.cables') }}</div>
            <div v-for="(c, ci) in route.cables" :key="ci" class="grid grid-cols-[1fr_3.5rem_1fr_auto] gap-1.5">
              <Select v-model="c.type">
                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem v-for="ct in CABLE_TYPES" :key="ct" :value="ct">{{ t(`cable.${ct}`) }}</SelectItem></SelectContent>
              </Select>
              <NumberInput :model-value="c.count" @update:model-value="(v) => (c.count = Math.max(1, Math.round(v ?? 1)))" />
              <Input :model-value="c.label ?? ''" :placeholder="t('editor.plan.cableLabel')" @update:model-value="(v) => (c.label = String(v) || undefined)" />
              <Button variant="ghost" size="icon" :aria-label="t('common.delete')" @click="route.cables.splice(ci, 1)"><Trash2 /></Button>
            </div>
            <Button variant="outline" size="sm" @click="route.cables.push({ type: 'ethernet', count: 1 })">{{ t('editor.plan.addCable') }}</Button>
          </div>
          <div v-if="route.kind === 'conduit'" class="grid grid-cols-2 items-end gap-2">
            <FormRow :label="t('editor.plan.diameter')"><NumberInput v-model="route.diameterMm" :suffix="t('units.mm')" /></FormRow>
            <label class="flex h-9 items-center gap-2 text-sm"><Switch :model-value="!!route.pullString" @update:model-value="(v) => (route!.pullString = v || undefined)" /> {{ t('editor.plan.pullString') }}</label>
          </div>
        </template>
        <FormRow v-if="route.kind === 'power' || route.kind === 'bus'" :label="t('editor.plan.device')">
          <Select :model-value="route.device ?? '__'" @update:model-value="(v) => (route!.device = v === '__' ? undefined : (v as string))">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__">{{ t('editor.plan.noDevice') }}</SelectItem>
              <SelectItem v-for="f in d.devices" :key="f.id" :value="f.id">{{ f.id }} · {{ tx(f.label) }}</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
        <FormRow :label="t('editor.plan.routeNote')"><LocalizedInput v-model="route.note" multiline /></FormRow>
        <div class="grid grid-cols-2 gap-2">
          <FormRow :label="t('editor.plan.mount')">
            <Select :model-value="route.mount ?? (route.elevation !== undefined ? 'wall' : MOUNT_DEFAULT[route.kind])" @update:model-value="(v) => (route!.mount = v as 'floor' | 'wall' | 'ceiling')">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in ['floor', 'wall', 'ceiling']" :key="m" :value="m">{{ t(`route.mount.${m}`) }}</SelectItem>
              </SelectContent>
            </Select>
          </FormRow>
          <FormRow :label="t('editor.plan.safeWidth')"><NumberInput v-model="route.safeWidth" :suffix="t('units.cm')" /></FormRow>
        </div>
        <FormRow v-if="(route.mount ?? (route.elevation !== undefined ? 'wall' : MOUNT_DEFAULT[route.kind])) === 'wall'" :label="t('editor.plan.elevation')" :hint="t('editor.plan.elevationHint')">
          <NumberInput v-model="route.elevation" :suffix="t('units.cm')" placeholder="30" />
        </FormRow>
      </div>

      <div v-else-if="photo" class="space-y-3 rounded-2xl border bg-card p-4">
        <img :src="photo.src.startsWith(ASSET_PREFIX) ? assets[photo.src.slice(ASSET_PREFIX.length)] : photo.src" class="aspect-[4/3] w-full rounded-lg object-cover" alt="" />
        <FormRow :label="t('editor.plan.caption')"><LocalizedInput v-model="photo.caption" /></FormRow>
        <div class="grid grid-cols-2 gap-2">
          <FormRow :label="t('maintenance.date')"><Input v-model="photo.date" type="date" /></FormRow>
          <FormRow :label="t('editor.plan.room')">
            <Select :model-value="photo.room ?? '__'" @update:model-value="(v) => (photo!.room = v === '__' ? undefined : (v as string))">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__">—</SelectItem>
                <SelectItem v-for="r in d.rooms" :key="r.id" :value="r.id">{{ tx(r.name) }}</SelectItem>
              </SelectContent>
            </Select>
          </FormRow>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="replacePhoto"><ImagePlus /> {{ t('editor.plan.replace') }}</Button>
          <Button variant="destructive" size="sm" @click="removeSelected"><Trash2 /> {{ t('common.delete') }}</Button>
        </div>
      </div>

      <div v-else class="space-y-3 rounded-2xl border bg-card p-4 text-sm">
        <div class="font-medium">{{ t('editor.plan.summary') }}</div>
        <div class="grid grid-cols-2 gap-2 text-muted-foreground">
          <span>{{ t('editor.plan.rooms') }}: <b class="text-foreground">{{ d.rooms.length }}</b></span>
          <span>{{ t('panel.stat.points') }}: <b class="text-foreground">{{ d.points.length }}</b></span>
          <span>{{ t('editor.plan.routes') }}: <b class="text-foreground">{{ d.routes.length }}</b></span>
          <span>{{ t('nav.photos') }}: <b class="text-foreground">{{ d.photos.length }}</b></span>
        </div>
        <div class="border-t pt-3">
          <div class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('editor.plan.rooms') }}</div>
          <button v-for="r in d.rooms" :key="r.id" class="block w-full rounded-md px-2 py-1 text-left hover:bg-accent" @click="sel = { kind: 'room', id: r.id }">
            {{ tx(r.name) }}
          </button>
        </div>
        <p v-if="data.issues.length" class="text-xs text-danger">{{ data.issues.length }} {{ t('editor.refIssues') }}</p>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.seg-len {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  fill: var(--primary);
  paint-order: stroke;
  stroke: var(--background);
  stroke-width: 4px;
}
</style>
