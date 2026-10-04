import Fuse from 'fuse.js'
import type { PowerGraph } from './graph'
import type { PlacedItem, RowLayout } from './layout'
import { locate } from './layout'
import type { Device, PanelData, PlanPoint, Room } from './schema'
import { LOCALES, tr } from './schema'

export type SearchHit =
  | { kind: 'device'; id: string; device: Device }
  | { kind: 'room'; id: string; room: Room }
  | { kind: 'point'; id: string; point: PlanPoint }

interface Entry {
  hit: SearchHit
  text: string
}

function allTranslations(t: Parameters<typeof tr>[0]): string {
  if (!t) return ''
  if (typeof t === 'string') return t
  return LOCALES.map((l) => t[l] ?? '').join(' ')
}

export function buildSearch(data: PanelData) {
  const roomName = new Map(data.rooms.map((r) => [r.id, allTranslations(r.name)]))
  const entries: Entry[] = [
    ...data.devices.map((d) => ({
      hit: { kind: 'device' as const, id: d.id, device: d },
      text: [d.id, allTranslations(d.label), allTranslations(d.circuit?.purpose), d.brand, d.model, d.tags.join(' '), d.type]
        .filter(Boolean)
        .join(' '),
    })),
    ...data.rooms.map((r) => ({ hit: { kind: 'room' as const, id: r.id, room: r }, text: allTranslations(r.name) })),
    ...data.points.map((p) => ({
      hit: { kind: 'point' as const, id: p.id, point: p },
      text: [allTranslations(p.label), p.kind, p.profile, roomName.get(p.room ?? '')].filter(Boolean).join(' '),
    })),
  ]
  const fuse = new Fuse(entries, { keys: ['text'], threshold: 0.38, ignoreLocation: true })
  return (q: string, limit = 20): SearchHit[] => {
    const query = q.trim()
    if (!query) return []
    return fuse.search(query, { limit }).map((r) => r.item.hit)
  }
}

export interface SwitchOffAnswer {
  // the closest device whose only job here is cutting this point; flipping it disturbs the fewest other points
  device: Device
  place?: PlacedItem
  // devices further up the chain that also cut this point, nearest first
  alternatives: Device[]
}

export function whatToSwitchOff(g: PowerGraph, layout: RowLayout[], point: PlanPoint): SwitchOffAnswer | undefined {
  if (!point.device) return undefined
  const device = g.byId.get(point.device)
  if (!device) return undefined
  return { device, place: locate(layout, device.id), alternatives: g.ancestors(device.id) }
}

export function devicesForRoom(g: PowerGraph, data: PanelData, roomId: string): Device[] {
  const ids = new Set(data.points.filter((p) => p.room === roomId && p.device).map((p) => p.device!))
  return [...ids].map((id) => g.byId.get(id)).filter((d): d is Device => !!d)
}
