import type { PanelData, PlanPoint, Point2, Route } from './model'
import { routeHeight, routeMount } from './model'

// centimetres above the finished floor when a point has no heightMm; negative counts down from the ceiling
const DEFAULT_HEIGHT: Record<PlanPoint['kind'], number> = {
  socket: 30,
  switch: 90,
  light: -3,
  appliance: 50,
  heating: 2,
  ac: 240,
  junction: 200,
  network: 180,
  data: 30,
  panel: 130,
  sensor: 15,
  other: 50,
}

// a route end this close to a point (plan units) feeds it, and the cable drops vertically to it
export const DROP_SNAP = 45
// a run or a drop this close to a wall line counts as being in that wall
const WALL_NEAR = 30
// height differences below this are a connection at the same level, not a drop
const DROP_MIN = 20

export function ceilingOf(data: PanelData, roomId?: string): number {
  return data.rooms.find((r) => r.id === roomId)?.ceilingCm ?? data.plan.wallHeight
}

export function pointHeight(data: PanelData, p: PlanPoint): number {
  if (p.heightMm !== undefined) return p.heightMm / 10
  const h = DEFAULT_HEIGHT[p.kind]
  return h < 0 ? ceilingOf(data, p.room) + h : h
}

export function pointAt(points: PlanPoint[], x: number, y: number): PlanPoint | undefined {
  let best: PlanPoint | undefined
  let bestDist = DROP_SNAP
  for (const p of points) {
    const dist = Math.hypot(p.x - x, p.y - y)
    if (dist <= bestDist) [best, bestDist] = [p, dist]
  }
  return best
}

type Segment = [Point2, Point2]

function walls(data: PanelData): Segment[] {
  return data.rooms.filter((r) => r.polygon.length >= 3).flatMap((r) => r.polygon.map((a, i): Segment => [a, r.polygon[(i + 1) % r.polygon.length]!]))
}

function distanceToSegment(x: number, y: number, [a, b]: Segment): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2)) : 0
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy))
}

function nearWall(ws: Segment[], x: number, y: number): boolean {
  return ws.some((w) => distanceToSegment(x, y, w) <= WALL_NEAR)
}

export type RouteIssueCode = 'route-diagonal' | 'route-off-wall' | 'route-drop-midair'
export interface RouteIssue {
  code: RouteIssueCode
  route: Route
  point?: PlanPoint
}

// concealed wiring runs parallel to the walls, a wall run stays in a wall, and the vertical part
// of a floor or ceiling run goes down a wall to its outlet, never through open air
export function routeIssues(data: PanelData): RouteIssue[] {
  const ws = walls(data)
  const out: RouteIssue[] = []
  for (const r of data.routes) {
    const segments = r.points.slice(1).map((b, i): Segment => [r.points[i]!, b])
    if (segments.some(([a, b]) => Math.abs(b[0] - a[0]) > 2 && Math.abs(b[1] - a[1]) > 2)) out.push({ code: 'route-diagonal', route: r })
    if (!ws.length) continue

    if (routeMount(r) === 'wall') {
      const off = segments.some(([a, b]) => {
        const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20))
        for (let i = 0; i <= steps; i++) if (!nearWall(ws, a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps)) return true
        return false
      })
      if (off) out.push({ code: 'route-off-wall', route: r })
    }

    const level = routeHeight(r, data.plan.wallHeight)
    for (const [x, y] of [r.points[0]!, r.points.at(-1)!]) {
      const p = pointAt(data.points, x, y)
      if (p && Math.abs(pointHeight(data, p) - level) > DROP_MIN && !nearWall(ws, p.x, p.y)) out.push({ code: 'route-drop-midair', route: r, point: p })
    }
  }
  return out
}
