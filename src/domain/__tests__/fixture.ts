import { readFileSync } from 'node:fs'
import * as yaml from 'js-yaml'
import { parsePanel, type PanelData, type PanelInput } from '../schema'

export function demo(): PanelData {
  const doc = yaml.load(readFileSync('data/demo.yaml', 'utf8')) as { data: unknown }
  return parsePanel(doc.data)
}

export function tiny(overrides: Partial<PanelInput> = {}): PanelData {
  return parsePanel({
    meta: { title: 't' },
    supply: { phases: 1, voltage: 230, maxPowerKw: 5 },
    rows: [{ id: 'r1', modules: 12, items: ['Q0', 'D1', 'A1', 'A2', { blank: 2 }] }],
    devices: [
      { id: 'Q0', type: 'mcb', rating: 25, poles: 2 },
      { id: 'D1', type: 'rcd', rating: 25, leakage: 30, rcdClass: 'A', poles: 2, upstream: 'Q0' },
      { id: 'A1', type: 'mcb', rating: 16, upstream: 'D1', circuit: { crossSection: 2.5 } },
      { id: 'A2', type: 'mcb', rating: 10, upstream: 'D1', circuit: { crossSection: 1.5 } },
    ],
    rooms: [{ id: 'bath', name: 'Bath', wet: true }],
    points: [
      { id: 'p1', kind: 'socket', device: 'A1', x: 0, y: 0, powerW: 2000 },
      { id: 'p2', kind: 'light', device: 'A2', x: 0, y: 0, powerW: 50, count: 4 },
    ],
    ...overrides,
  })
}
