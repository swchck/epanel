import type { Point2, Room } from '@/domain/model'

type Segment = [Point2, Point2]

function edges(rooms: Room[]): Segment[] {
  return rooms.filter((r) => r.polygon.length >= 2).flatMap((r) => r.polygon.map((a, i): Segment => [a, r.polygon[(i + 1) % r.polygon.length]!]))
}

function project([x, y]: Point2, [a, b]: Segment): Point2 {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2)) : 0
  return [a[0] + t * dx, a[1] + t * dy]
}

const dist = (a: Point2, b: Point2) => Math.hypot(a[0] - b[0], a[1] - b[1])
const round = (p: Point2): Point2 => [Math.round(p[0]), Math.round(p[1])]

/**
 * Pulls a cursor position onto existing geometry: a room corner or an extra anchor (an outlet)
 * first, then the nearest wall line. Returns null when nothing is within `tolerance` plan units.
 */
export function snapToGeometry(p: Point2, rooms: Room[], tolerance: number, anchors: Point2[] = []): Point2 | null {
  let best: Point2 | null = null
  let bestDist = tolerance
  for (const v of [...rooms.flatMap((r) => r.polygon), ...anchors]) {
    const dv = dist(p, v)
    if (dv <= bestDist) [best, bestDist] = [v, dv]
  }
  if (best) return round(best)
  for (const e of edges(rooms)) {
    const q = project(p, e)
    const dq = dist(p, q)
    if (dq <= bestDist) [best, bestDist] = [q, dq]
  }
  return best ? round(best) : null
}

/**
 * Puts an outlet on the nearest wall, `inset` plan units into the room it was dropped in,
 * the way sockets and switches are actually mounted. Leaves points farther than `reach` alone.
 */
export function placeOnWall(p: Point2, rooms: Room[], reach: number, inset = 10): Point2 {
  let best: { foot: Point2; edge: Segment; d: number } | null = null
  for (const e of edges(rooms)) {
    const foot = project(p, e)
    const d = dist(p, foot)
    if (d <= reach && (!best || d < best.d)) best = { foot, edge: e, d }
  }
  if (!best) return p
  const [a, b] = best.edge
  const len = dist(a, b) || 1
  let n: Point2 = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
  if ((p[0] - best.foot[0]) * n[0] + (p[1] - best.foot[1]) * n[1] < 0) n = [-n[0], -n[1]]
  return round([best.foot[0] + n[0] * inset, best.foot[1] + n[1] * inset])
}

/** Locks a new vertex to the horizontal or vertical through the previous one, whichever is closer. */
export function orthogonal(prev: Point2, p: Point2): Point2 {
  return Math.abs(p[0] - prev[0]) >= Math.abs(p[1] - prev[1]) ? [p[0], prev[1]] : [prev[0], p[1]]
}

/**
 * Reads a length typed while drawing: "3.5" or "3,5" metres for a segment, "3.5x4" for a rectangle.
 * Returns centimetres, or null while the input is incomplete.
 */
export function parseTypedLength(text: string): { a: number; b?: number } | null {
  const [a, b, rest] = text.replace(/,/g, '.').split(/[x×*\s]+/i)
  if (rest !== undefined) return null
  const num = (s: string | undefined) => (s && /^\d*\.?\d+$/.test(s) ? Math.round(Number(s) * 100) : NaN)
  const ca = num(a)
  if (!(ca > 0)) return null
  if (b === undefined || b === '') return { a: ca }
  const cb = num(b)
  return cb > 0 ? { a: ca, b: cb } : null
}

/**
 * Finds the wall closest to p within reach and returns the point on it and its direction in degrees.
 */
export function wallAt(p: Point2, rooms: Room[], reach: number): { at: Point2; angle: number } | null {
  let best: { foot: Point2; edge: Segment; d: number } | null = null
  for (const e of edges(rooms)) {
    const foot = project(p, e)
    const d = dist(p, foot)
    if (d <= reach && (!best || d < best.d)) best = { foot, edge: e, d }
  }
  if (!best) return null
  const [a, b] = best.edge
  return { at: round(best.foot), angle: Math.round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI) }
}
