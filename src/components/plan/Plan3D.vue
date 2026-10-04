<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RotateCcw } from '@lucide/vue'
import { routeHeight, type PanelData, type PlanPoint, type Route } from '@/domain/model'
import { CABLE_COLORS, POINT_COLORS } from '@/components/common/kinds'
import { TYPE_ACCENT } from '@/components/panel/geometry'
import { isDark } from '@/composables/useTheme'
import { useText } from '@/composables/useText'
import { pointAt, pointHeight as pointHeightOf } from '@/domain/routing'
import { useData } from '@/stores/data'

const props = defineProps<{
  highlightPoints?: Set<string>
  deadPoints?: Set<string>
  focusPoint?: string | null
  selectedRoute?: string | null
  showRoutes?: boolean
}>()
const emit = defineEmits<{ point: [id: string]; route: [id: string]; canvas: [] }>()

const store = useData()
const { tx, t, locale } = useText()
const d = computed(() => store.data as PanelData)
const host = ref<HTMLDivElement | null>(null)
const tip = ref<{ x: number; y: number; text: string } | null>(null)

// centimetres everywhere, Y is up; plan x → X, plan y → Z
const pointHeight = (p: PlanPoint) => pointHeightOf(d.value, p)

let renderer: THREE.WebGLRenderer | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let resize: ResizeObserver | undefined
const scene = new THREE.Scene()
const world = shallowRef(new THREE.Group())
scene.add(world.value)
const pointMeshes = new Map<string, THREE.Mesh>()
const routeMeshes = new Map<string, THREE.Mesh>()

const pointGeometry = new THREE.SphereGeometry(7, 20, 14)

function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry !== pointGeometry) m.geometry?.dispose()
    const mats = ([] as THREE.Material[]).concat((m.material as THREE.Material | THREE.Material[] | undefined) ?? [])
    for (const mat of mats) {
      ;(mat as THREE.SpriteMaterial).map?.dispose()
      mat.dispose()
    }
  })
}

// one frame per change instead of a 60 fps loop: an idle 3D tab should cost nothing
let frame = 0
let lastTime = 0
let pulse = 0
function invalidate() {
  if (!frame) frame = requestAnimationFrame(render)
}

function render(time: number) {
  frame = 0
  if (!renderer || !camera || !controls) return
  pulse += lastTime ? (time - lastTime) / 1000 : 0
  lastTime = time
  let animating = controls.update()
  for (const mesh of pointMeshes.values()) {
    if (!mesh.userData.lit) continue
    ;(mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(pulse * 4) * 0.35
    animating = true
  }
  renderer.render(scene, camera)
  if (animating) invalidate()
  else lastTime = 0
}

// centimetres from the floor: a standard 2.1 m door, a window with a 0.85 m sill and 1.4 m of glass
const DOOR_SPAN = [0, 210] as const
const WINDOW_SPAN = [85, 225] as const

function build() {
  disposeGroup(world.value)
  scene.remove(world.value)
  pointMeshes.clear()
  routeMeshes.clear()
  const g = new THREE.Group()
  const dark = isDark.value
  const wallColor = dark ? 0xcfd6e4 : 0x3b4252
  const floorColor = dark ? 0x2c323d : 0xf4f1ea
  const wetColor = dark ? 0x1d3448 : 0xdcecf7
  const wallMaterial = new THREE.MeshStandardMaterial({ color: wallColor, transparent: true, opacity: 0.12, depthWrite: false })
  const edgeMaterial = new THREE.LineBasicMaterial({ color: wallColor, transparent: true, opacity: 0.45 })

  for (const room of d.value.rooms) {
    if (room.polygon.length < 3) continue
    const h = room.ceilingCm ?? d.value.plan.wallHeight
    const shape = new THREE.Shape(room.polygon.map(([x, y]) => new THREE.Vector2(x, y)))
    const floor = new THREE.Mesh(
      new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: room.wet ? wetColor : floorColor, side: THREE.DoubleSide, roughness: 0.95 }),
    )
    g.add(floor)
    const xs = room.polygon.map((p) => p[0])
    const ys = room.polygon.map((p) => p[1])
    const tag = label(tx(room.name), dark)
    tag.position.set((Math.min(...xs) + Math.max(...xs)) / 2, h + 25, (Math.min(...ys) + Math.max(...ys)) / 2)
    g.add(tag)
    room.polygon.forEach((a, i) => {
      const b = room.polygon[(i + 1) % room.polygon.length]!
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, h, 6), wallMaterial)
      wall.position.set((a[0] + b[0]) / 2, h / 2, (a[1] + b[1]) / 2)
      wall.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0])
      g.add(wall)
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(wall.geometry), edgeMaterial)
      edges.position.copy(wall.position)
      edges.rotation.copy(wall.rotation)
      g.add(edges)
    })
  }

  for (const o of d.value.plan.openings) {
    const [bottom, top] = o.kind === 'door' ? DOOR_SPAN : WINDOW_SPAN
    const h = top - bottom
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(o.width, h, 10)),
      new THREE.LineBasicMaterial({ color: o.kind === 'door' ? 0xb07a4a : 0x60a5fa }),
    )
    frame.position.set(o.x, bottom + h / 2, o.y)
    frame.rotation.y = (-o.angle * Math.PI) / 180
    g.add(frame)
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(o.width, h),
      new THREE.MeshStandardMaterial({ color: o.kind === 'door' ? 0xb07a4a : 0x93c5fd, transparent: true, opacity: o.kind === 'door' ? 0.35 : 0.25, side: THREE.DoubleSide, depthWrite: false }),
    )
    fill.position.copy(frame.position)
    fill.rotation.copy(frame.rotation)
    g.add(fill)
  }

  for (const p of d.value.points) {
    const mesh = new THREE.Mesh(
      pointGeometry,
      new THREE.MeshStandardMaterial({ color: POINT_COLORS[p.kind], emissive: POINT_COLORS[p.kind], emissiveIntensity: 0.25, transparent: true }),
    )
    mesh.userData.kind = p.kind
    mesh.position.set(p.x, pointHeight(p), p.y)
    mesh.userData.pointId = p.id
    pointMeshes.set(p.id, mesh)
    g.add(mesh)
  }

  if (props.showRoutes !== false) {
    for (const r of d.value.routes) {
      const path = routePath(r)
      if (path.length < 2) continue
      const curve = new THREE.CurvePath<THREE.Vector3>()
      for (let i = 1; i < path.length; i++) curve.add(new THREE.LineCurve3(path[i - 1]!, path[i]!))
      const radius = r.kind === 'conduit' ? 4.5 : r.kind === 'low' ? 1.6 : 2.2
      const color = r.kind === 'conduit' ? 0x9ca3af : r.kind === 'bus' ? 0x16a34a : r.kind === 'low' ? CABLE_COLORS[r.cables[0]?.type ?? 'other'] : routeColor(r.device)
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(8, path.length * 12), radius, 8, false),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, transparent: true, opacity: r.kind === 'conduit' ? 0.55 : 1 }),
      )
      mesh.userData.routeId = r.id
      mesh.userData.conduit = r.kind === 'conduit'
      routeMeshes.set(r.id, mesh)
      g.add(mesh)
    }
  }

  world.value = g
  scene.add(g)
  applyState()
}

function routeColor(device?: string) {
  const dev = device ? store.graph?.byId.get(device) : undefined
  return dev ? TYPE_ACCENT[dev.type]! : '#888888'
}

function routePath(r: Route): THREE.Vector3[] {
  const elev = routeHeight(r, d.value.plan.wallHeight)
  const out = r.points.map(([x, y]) => new THREE.Vector3(x, elev, y))
  const [sx, sy] = r.points[0]!
  const [ex, ey] = r.points.at(-1)!
  const start = pointAt(d.value.points, sx, sy)
  const end = pointAt(d.value.points, ex, ey)
  // vertical runs inside the wall: down from the ceiling or up from the screed to the outlet
  if (start) out.unshift(new THREE.Vector3(sx, pointHeight(start), sy))
  if (end) out.push(new THREE.Vector3(ex, pointHeight(end), ey))
  return out
}

function applyState() {
  const anyLit = (props.highlightPoints?.size ?? 0) > 0
  for (const [id, mesh] of pointMeshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial
    const lit = props.highlightPoints?.has(id) || props.focusPoint === id
    const dead = props.deadPoints?.has(id)
    mat.color.set(dead ? '#6b7280' : POINT_COLORS[mesh.userData.kind as PlanPoint['kind']])
    mat.emissiveIntensity = 0.25
    mat.opacity = anyLit && !lit ? 0.2 : 1
    mesh.scale.setScalar(lit ? 1.7 : 1)
    mesh.userData.lit = lit
  }
  for (const [id, mesh] of routeMeshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial
    const sel = props.selectedRoute === id
    mat.emissiveIntensity = sel ? 0.9 : 0.2
    const base = mesh.userData.conduit ? 0.55 : 1
    mat.opacity = props.selectedRoute && !sel ? base * 0.25 : base
  }
  invalidate()
}

function center() {
  const b = new THREE.Box3().setFromObject(world.value)
  const c = b.getCenter(new THREE.Vector3())
  const size = b.getSize(new THREE.Vector3())
  return { c, r: Math.max(size.x, size.z, 300) }
}

function resetView() {
  if (!camera || !controls) return
  const { c, r } = center()
  const fov = (camera.fov * Math.PI) / 180
  // fit the longest side horizontally even on a narrow portrait phone screen
  const dist = (r / 2 / Math.tan(fov / 2)) * (1.25 / Math.min(1, camera.aspect))
  const dir = new THREE.Vector3(-0.12, 0.72, 0.68).normalize()
  camera.position.copy(c).addScaledVector(dir, dist)
  controls.target.copy(c)
  controls.update()
  invalidate()
}

function label(text: string, dark: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = '600 44px "IBM Plex Sans Variable", system-ui, sans-serif'
  ctx.font = font
  canvas.width = Math.ceil(ctx.measureText(text).width) + 32
  canvas.height = 64
  ctx.font = font
  ctx.fillStyle = dark ? 'rgba(240,240,235,0.9)' : 'rgba(30,32,38,0.85)'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 16, 34)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sprite.scale.set(canvas.width * 0.6, canvas.height * 0.6, 1)
  sprite.renderOrder = 10
  return sprite
}

const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2()
let downAt: { x: number; y: number } | null = null

function pick(e: PointerEvent): THREE.Intersection | undefined {
  if (!renderer || !camera) return undefined
  const rect = renderer.domElement.getBoundingClientRect()
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(ndc, camera)
  return raycaster.intersectObjects([...pointMeshes.values(), ...routeMeshes.values()], false)[0]
}

function onDown(e: PointerEvent) {
  downAt = { x: e.clientX, y: e.clientY }
}

function onUp(e: PointerEvent) {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return
  const hit = pick(e)
  if (hit?.object.userData.pointId) emit('point', hit.object.userData.pointId)
  else if (hit?.object.userData.routeId) emit('route', hit.object.userData.routeId)
  else emit('canvas')
}

// hover picking at most once per frame; touch has no hover and its moves are orbit drags
let moveEvent: PointerEvent | null = null
function onMove(e: PointerEvent) {
  if (e.pointerType === 'touch' || e.buttons) return
  if (!moveEvent) requestAnimationFrame(hover)
  moveEvent = e
}

function hover() {
  const e = moveEvent
  moveEvent = null
  if (!e || !host.value) return
  const hit = pick(e)
  const rect = host.value!.getBoundingClientRect()
  const pid = hit?.object.userData.pointId as string | undefined
  if (pid) {
    const p = d.value.points.find((x) => x.id === pid)!
    tip.value = { x: e.clientX - rect.left, y: e.clientY - rect.top, text: `${tx(p.label, t(`point.kind.${p.kind}`))} · ${Math.round(pointHeight(p))} ${t('units.cm')}` }
  } else tip.value = null
  renderer!.domElement.style.cursor = hit ? 'pointer' : 'grab'
}

onMounted(() => {
  const el = host.value!
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, devicePixelRatio))
  el.appendChild(renderer.domElement)
  camera = new THREE.PerspectiveCamera(45, 1, 5, 20000)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI * 0.49
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6))
  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(400, 1200, 600)
  scene.add(sun)
  build()

  const fit = () => {
    const w = el.clientWidth
    const h = el.clientHeight
    renderer!.setSize(w, h, false)
    renderer!.domElement.style.width = '100%'
    renderer!.domElement.style.height = '100%'
    camera!.aspect = w / Math.max(1, h)
    camera!.updateProjectionMatrix()
    invalidate()
  }
  resize = new ResizeObserver(fit)
  resize.observe(el)
  // the portrait correction in resetView needs the real aspect ratio
  fit()
  resetView()
  controls.addEventListener('change', invalidate)

  renderer.domElement.addEventListener('pointerdown', onDown)
  renderer.domElement.addEventListener('pointerup', onUp)
  renderer.domElement.addEventListener('pointermove', onMove)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  frame = 0
  resize?.disconnect()
  controls?.dispose()
  disposeGroup(scene)
  pointGeometry.dispose()
  renderer?.domElement.removeEventListener('pointerdown', onDown)
  renderer?.domElement.removeEventListener('pointerup', onUp)
  renderer?.domElement.removeEventListener('pointermove', onMove)
  // dispose() alone leaves the context to GC; browsers cap live WebGL contexts at ~16
  renderer?.forceContextLoss()
  renderer?.dispose()
  renderer?.domElement.remove()
})

watch(() => [d.value.rooms, d.value.points, d.value.routes, d.value.plan.wallHeight, d.value.plan.openings, props.showRoutes, isDark.value, locale.value], build, { deep: true })
watch(() => [props.highlightPoints, props.deadPoints, props.focusPoint, props.selectedRoute], applyState)
</script>

<template>
  <div ref="host" class="relative h-full w-full touch-none select-none">
    <div
      v-if="tip"
      class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background shadow"
      :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
    >
      {{ tip.text }}
    </div>
    <button
      class="absolute right-3 bottom-3 rounded-lg border bg-card/90 p-2 shadow-sm backdrop-blur hover:bg-accent"
      :aria-label="$t('plan.fit')"
      @click="resetView"
    >
      <RotateCcw class="size-4" />
    </button>
  </div>
</template>
