import type { Device, PanelData, PlanPoint } from './schema'
import { RCD_TYPES } from './schema'

export interface PowerGraph {
  byId: Map<string, Device>
  children: Map<string, Device[]>
  roots: Device[]
  cycles: string[]
  ancestors(id: string): Device[]
  descendants(id: string): Device[]
  pointsOf(id: string, deep?: boolean): PlanPoint[]
  isPowered(id: string, off: ReadonlySet<string>): boolean
  rcdChain(id: string): Device[]
  depth(id: string): number
}

export function buildGraph(data: Pick<PanelData, 'devices' | 'points'>): PowerGraph {
  const byId = new Map(data.devices.map((d) => [d.id, d]))
  const children = new Map<string, Device[]>()
  const roots: Device[] = []
  for (const d of data.devices) {
    if (d.upstream && byId.has(d.upstream)) {
      const list = children.get(d.upstream) ?? []
      list.push(d)
      children.set(d.upstream, list)
    } else {
      roots.push(d)
    }
  }

  const cycles: string[] = []
  for (const d of data.devices) {
    const seen = new Set<string>([d.id])
    let cur = d.upstream ? byId.get(d.upstream) : undefined
    while (cur) {
      if (seen.has(cur.id)) {
        cycles.push(d.id)
        break
      }
      seen.add(cur.id)
      cur = cur.upstream ? byId.get(cur.upstream) : undefined
    }
  }
  const cyclic = new Set(cycles)

  const pointsByDevice = new Map<string, PlanPoint[]>()
  for (const p of data.points) {
    if (!p.device) continue
    const list = pointsByDevice.get(p.device) ?? []
    list.push(p)
    pointsByDevice.set(p.device, list)
  }

  function ancestors(id: string): Device[] {
    const out: Device[] = []
    if (cyclic.has(id)) return out
    let cur = byId.get(id)
    while (cur?.upstream) {
      const up = byId.get(cur.upstream)
      if (!up) break
      out.push(up)
      cur = up
    }
    return out
  }

  function descendants(id: string): Device[] {
    const out: Device[] = []
    const seen = new Set<string>([id])
    const stack = [...(children.get(id) ?? [])]
    while (stack.length) {
      const d = stack.pop()!
      if (seen.has(d.id)) continue
      seen.add(d.id)
      out.push(d)
      stack.push(...(children.get(d.id) ?? []))
    }
    return out
  }

  function pointsOf(id: string, deep = true): PlanPoint[] {
    const own = pointsByDevice.get(id) ?? []
    if (!deep) return own
    return [own, ...descendants(id).map((d) => pointsByDevice.get(d.id) ?? [])].flat()
  }

  function isPowered(id: string, off: ReadonlySet<string>): boolean {
    if (off.has(id)) return false
    return ancestors(id).every((a) => !off.has(a.id))
  }

  function rcdChain(id: string): Device[] {
    const self = byId.get(id)
    return [self, ...ancestors(id)].filter((d): d is Device => !!d && RCD_TYPES.includes(d.type))
  }

  function depth(id: string): number {
    return ancestors(id).length
  }

  return { byId, children, roots, cycles, ancestors, descendants, pointsOf, isPowered, rcdChain, depth }
}

export function pointPowered(g: PowerGraph, p: PlanPoint, off: ReadonlySet<string>): boolean {
  if (!p.device) return true
  return g.isPowered(p.device, off)
}
