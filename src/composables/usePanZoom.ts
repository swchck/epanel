import { computed, ref, watch, type Ref } from 'vue'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

// viewBox-based pan/zoom: keeps strokes crisp and needs no CSS transforms on the SVG
export function usePanZoom(svg: Ref<SVGSVGElement | null>, base: Ref<Box>, opts: { enabled?: Ref<boolean>; minScale?: number; maxScale?: number } = {}) {
  const box = ref<Box>({ ...base.value })
  const minScale = opts.minScale ?? 0.8
  const maxScale = opts.maxScale ?? 8
  watch(base, (b) => (box.value = { ...b }), { deep: true })

  const scale = computed(() => base.value.w / box.value.w)
  const viewBox = computed(() => `${box.value.x} ${box.value.y} ${box.value.w} ${box.value.h}`)

  function toPlan(clientX: number, clientY: number): [number, number] {
    const el = svg.value
    if (!el) return [0, 0]
    const pt = el.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const m = el.getScreenCTM()
    if (!m) return [0, 0]
    const p = pt.matrixTransform(m.inverse())
    return [p.x, p.y]
  }

  function zoomAt(factor: number, cx: number, cy: number) {
    const b = box.value
    const next = Math.min(maxScale, Math.max(minScale, scale.value * factor))
    const w = base.value.w / next
    const h = base.value.h / next
    box.value = { x: cx - ((cx - b.x) * w) / b.w, y: cy - ((cy - b.y) * h) / b.h, w, h }
  }

  function reset() {
    box.value = { ...base.value }
  }

  function zoomBy(factor: number) {
    const b = box.value
    zoomAt(factor, b.x + b.w / 2, b.y + b.h / 2)
  }

  function focus(x: number, y: number, s = 2.2) {
    const w = base.value.w / s
    const h = base.value.h / s
    box.value = { x: x - w / 2, y: y - h / 2, w, h }
  }

  const pointers = new Map<number, { x: number; y: number }>()
  let pinchDist = 0
  let moved = 0
  const dragging = ref(false)

  function onWheel(e: WheelEvent) {
    if (opts.enabled && !opts.enabled.value) return
    e.preventDefault()
    const [x, y] = toPlan(e.clientX, e.clientY)
    zoomAt(Math.exp(-e.deltaY * 0.0015), x, y)
  }

  function onPointerDown(e: PointerEvent) {
    if (opts.enabled && !opts.enabled.value) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved = 0
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y)
    }
  }

  function onPointerMove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId)
    if (!prev || !svg.value) return
    const cur = { x: e.clientX, y: e.clientY }
    if (pointers.size === 1) {
      const rect = svg.value.getBoundingClientRect()
      const k = box.value.w / rect.width
      const dx = (cur.x - prev.x) * k
      const dy = (cur.y - prev.y) * k
      moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y)
      if (moved > 4) {
        dragging.value = true
        svg.value.setPointerCapture?.(e.pointerId)
        box.value = { ...box.value, x: box.value.x - dx, y: box.value.y - dy }
      }
    } else if (pointers.size === 2) {
      pointers.set(e.pointerId, cur)
      const [a, b] = [...pointers.values()]
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      if (pinchDist > 0) {
        const [cx, cy] = toPlan((a!.x + b!.x) / 2, (a!.y + b!.y) / 2)
        zoomAt(d / pinchDist, cx, cy)
      }
      pinchDist = d
      moved += 10
      dragging.value = true
      return
    }
    pointers.set(e.pointerId, cur)
  }

  function onPointerUp(e: PointerEvent) {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchDist = 0
    // let the click that ends a drag be swallowed by wasDrag()
    setTimeout(() => (dragging.value = false), 0)
  }

  function wasDrag() {
    return moved > 4
  }

  const handlers = {
    wheel: onWheel,
    pointerdown: onPointerDown,
    pointermove: onPointerMove,
    pointerup: onPointerUp,
    pointercancel: onPointerUp,
    pointerleave: onPointerUp,
  }

  return { box, viewBox, scale, reset, zoomBy, focus, toPlan, handlers, dragging, wasDrag }
}
