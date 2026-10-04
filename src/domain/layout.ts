import type { Device, PanelData } from './model'
import { defaultWidth } from './model'

export interface PlacedItem {
  kind: 'device' | 'blank'
  device?: Device
  rowIndex: number
  // 1-based position among devices in the row, the way an electrician counts "row 2, fifth from the left"
  position: number
  // 0-based offset in DIN modules from the left end of the rail
  start: number
  width: number
  overflow: boolean
}

export interface RowLayout {
  id: string
  modules: number
  used: number
  items: PlacedItem[]
}

export function layoutPanel(data: Pick<PanelData, 'rows' | 'devices'>): RowLayout[] {
  const byId = new Map(data.devices.map((d) => [d.id, d]))
  return data.rows.map((row, rowIndex) => {
    let start = 0
    let position = 0
    const items: PlacedItem[] = []
    for (const it of row.items) {
      if (typeof it === 'string') {
        const device = byId.get(it)
        if (!device) continue
        const width = defaultWidth(device)
        position += 1
        items.push({ kind: 'device', device, rowIndex, position, start, width, overflow: start + width > row.modules })
        start += width
      } else {
        items.push({ kind: 'blank', rowIndex, position: 0, start, width: it.blank, overflow: start + it.blank > row.modules })
        start += it.blank
      }
    }
    return { id: row.id, modules: row.modules, used: start, items }
  })
}

export function locate(layout: RowLayout[], deviceId: string): PlacedItem | undefined {
  for (const row of layout) for (const it of row.items) if (it.device?.id === deviceId) return it
  return undefined
}
