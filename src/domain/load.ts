import type { PowerGraph } from './graph'
import type { ApplianceProfile, Device, PlanPoint, PointKind } from './schema'

// demand factors: the share of nameplate power that realistically runs at the same time
const KIND_FACTOR: Record<PointKind, number> = {
  socket: 0.3,
  light: 1,
  switch: 0,
  appliance: 0.8,
  heating: 1,
  ac: 1,
  junction: 0,
  network: 1,
  data: 0,
  panel: 1,
  sensor: 1,
  other: 0.5,
}

const PROFILE_FACTOR: Record<ApplianceProfile, number> = {
  generic: 0.8,
  washer: 0.7,
  dishwasher: 0.7,
  oven: 0.7,
  cooktop: 0.65,
  fridge: 0.5,
  boiler: 1,
  'inverter-ac': 1,
  'floor-heating': 1,
  ev: 1,
}

export function demandFactor(p: PlanPoint): number {
  if (p.profile) return PROFILE_FACTOR[p.profile]
  return KIND_FACTOR[p.kind]
}

export interface Load {
  nameplateW: number
  demandW: number
  // amperes at the device's own pole count
  currentA: number
  // fraction of the device rating; undefined when the device has no rating
  utilization?: number
}

export function pointsLoad(points: PlanPoint[]): { nameplateW: number; demandW: number } {
  let nameplateW = 0
  let demandW = 0
  for (const p of points) {
    const w = (p.powerW ?? 0) * p.count
    nameplateW += w
    demandW += w * demandFactor(p)
  }
  return { nameplateW, demandW }
}

// coincidence factor across independent final circuits; floors at 0.4, the usual apartment-level ratio
export function coincidence(circuits: number): number {
  if (circuits <= 1) return 1
  return Math.max(0.4, 1 / Math.sqrt(circuits))
}

export function aggregateLoad(g: PowerGraph, roots: Device[]): { nameplateW: number; demandW: number } {
  const circuits = [...new Set(roots.flatMap((r) => [r, ...g.descendants(r.id)]))]
  let nameplateW = 0
  let sum = 0
  let n = 0
  for (const c of circuits) {
    const own = pointsLoad(g.pointsOf(c.id, false))
    if (own.nameplateW === 0) continue
    n += 1
    nameplateW += own.nameplateW
    sum += own.demandW
  }
  return { nameplateW, demandW: sum * coincidence(n) }
}

export function deviceLoad(g: PowerGraph, d: Device, voltage: number): Load {
  const { nameplateW, demandW } = aggregateLoad(g, [d])
  const phases = d.poles >= 3 ? 3 : 1
  const currentA = demandW / (voltage * phases)
  return {
    nameplateW,
    demandW,
    currentA,
    utilization: d.rating ? currentA / d.rating : undefined,
  }
}
