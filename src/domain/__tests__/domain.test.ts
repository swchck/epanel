import { describe, expect, it } from 'vitest'
import { makeBundle, parseText, pruneAssets, resolveAsset, toYaml } from '../bundle'
import { maxRatingFor, runChecks } from '../checks'
import { decryptJson, encryptJson, WrongPasswordError } from '../crypto'
import { buildGraph } from '../graph'
import { layoutPanel, locate } from '../layout'
import { coincidence, deviceLoad, pointsLoad } from '../load'
import { buildSearch, whatToSwitchOff } from '../lookup'
import { taskStatuses } from '../maintenance'
import { defaultWidth, referenceIssues, tr } from '../schema'
import { demo, tiny } from './fixture'

describe('schema', () => {
  it('parses the demo apartment without dangling references', () => {
    const d = demo()
    expect(d.devices.length).toBeGreaterThan(20)
    expect(referenceIssues(d)).toEqual([])
  })

  it('reports dangling references and duplicates', () => {
    const d = tiny({
      devices: [
        { id: 'Q0', type: 'mcb' },
        { id: 'Q0', type: 'mcb', upstream: 'NOPE' },
      ],
    })
    const msgs = referenceIssues(d).map((i) => i.message)
    expect(msgs).toContain('duplicate id Q0')
    expect(msgs).toContain('unknown device NOPE')
  })

  it('translates with fallbacks', () => {
    expect(tr({ ru: 'Кухня', en: 'Kitchen' }, 'sr')).toBe('Kitchen')
    expect(tr({ ru: 'Кухня' }, 'es')).toBe('Кухня')
    expect(tr('plain', 'ru')).toBe('plain')
    expect(tr(undefined, 'ru', 'x')).toBe('x')
  })

  it('derives DIN widths', () => {
    expect(defaultWidth({ type: 'mcb', poles: 1 })).toBe(1)
    expect(defaultWidth({ type: 'rcd', poles: 2 })).toBe(2)
    expect(defaultWidth({ type: 'meter', poles: 2 })).toBe(4)
    expect(defaultWidth({ type: 'mcb', poles: 1, width: 1.5 })).toBe(1.5)
  })
})

describe('graph', () => {
  const d = tiny()
  const g = buildGraph(d)

  it('walks up and down the supply tree', () => {
    expect(g.ancestors('A1').map((x) => x.id)).toEqual(['D1', 'Q0'])
    expect(g.descendants('Q0').map((x) => x.id).sort()).toEqual(['A1', 'A2', 'D1'])
    expect(g.roots.map((x) => x.id)).toEqual(['Q0'])
  })

  it('de-energises everything downstream of a switched-off device', () => {
    const off = new Set(['D1'])
    expect(g.isPowered('Q0', off)).toBe(true)
    expect(g.isPowered('A1', off)).toBe(false)
    expect(g.pointsOf('D1').map((p) => p.id).sort()).toEqual(['p1', 'p2'])
  })

  it('finds the RCD chain', () => {
    expect(g.rcdChain('A1').map((x) => x.id)).toEqual(['D1'])
  })

  it('detects supply cycles instead of looping forever', () => {
    const c = buildGraph({
      devices: tiny({
        devices: [
          { id: 'X', type: 'mcb', upstream: 'Y' },
          { id: 'Y', type: 'mcb', upstream: 'X' },
        ],
      }).devices,
      points: [],
    })
    expect(c.cycles.sort()).toEqual(['X', 'Y'])
    expect(c.ancestors('X')).toEqual([])
  })
})

describe('load', () => {
  it('applies demand factors per kind and multiplies by count', () => {
    const d = tiny()
    expect(pointsLoad(d.points)).toEqual({ nameplateW: 2200, demandW: 2000 * 0.3 + 200 })
  })

  it('aggregates circuits with a coincidence factor', () => {
    expect(coincidence(1)).toBe(1)
    expect(coincidence(4)).toBe(0.5)
    expect(coincidence(100)).toBe(0.4)
    const d = tiny()
    const g = buildGraph(d)
    const q0 = deviceLoad(g, g.byId.get('Q0')!, 230)
    expect(q0.demandW).toBeCloseTo((600 + 200) / Math.SQRT2)
    expect(q0.utilization).toBeCloseTo(q0.currentA / 25)
  })
})

describe('checks', () => {
  const codes = (d: ReturnType<typeof tiny>) => runChecks(d, buildGraph(d)).map((r) => `${r.level}:${r.code}:${r.point ?? r.device}`)

  it('maps cable sections to breaker limits', () => {
    expect(maxRatingFor(1.5)?.nominal).toBe(10)
    expect(maxRatingFor(2.5)?.nominal).toBe(16)
    expect(maxRatingFor(0.5)).toBeUndefined()
  })

  it('accepts a sane panel', () => {
    expect(codes(tiny()).filter((c) => !c.startsWith('info'))).toEqual([])
  })

  it('flags an oversized breaker on a thin cable', () => {
    const d = tiny()
    d.devices[3]!.rating = 25
    expect(codes(d)).toContain('error:cable-overload:A2')
  })

  it('flags selectivity problems', () => {
    const d = tiny()
    d.devices[2]!.rating = 32
    d.devices[2]!.circuit = { crossSection: 6 }
    expect(codes(d)).toContain('error:selectivity-over:A1')
  })

  it('flags a wet-zone point without RCD protection', () => {
    const d = tiny()
    d.devices[3]!.upstream = 'Q0'
    d.points[1]!.room = 'bath'
    expect(codes(d)).toContain('error:wet-no-rcd:p2')
  })

  it('flags non-selective RCD cascades', () => {
    const d = tiny()
    d.devices.push({ ...d.devices[1]!, id: 'D2', upstream: 'D1' })
    expect(codes(d)).toContain('warn:rcd-cascade:D2')
  })

  it('flags AC-class RCDs in front of inverter appliances', () => {
    const d = tiny()
    d.devices[1]!.rcdClass = 'AC'
    d.points[0]!.profile = 'washer'
    expect(codes(d)).toContain('warn:rcd-class:p1')
  })

  it('finds the deliberate issues in the demo', () => {
    const d = demo()
    const r = codes(d)
    expect(r).toContain('warn:cable-marginal:QF8')
    expect(r).toContain('warn:rcd-class:l-ac')
    expect(r.filter((c) => c.startsWith('error'))).toEqual([])
  })
})

describe('layout', () => {
  it('positions devices by DIN module and flags overflow', () => {
    const d = tiny()
    const rows = layoutPanel(d)
    expect(rows[0]!.used).toBe(8)
    const a1 = locate(rows, 'A1')!
    expect(a1).toMatchObject({ position: 3, start: 4, width: 1, overflow: false })
    d.rows[0]!.modules = 6
    expect(locate(layoutPanel(d), 'A2')!.overflow).toBe(false)
    expect(layoutPanel(d)[0]!.items.at(-1)!.overflow).toBe(true)
  })
})

describe('lookup', () => {
  const d = demo()
  const g = buildGraph(d)
  const search = buildSearch(d)

  it('finds devices, rooms and points in any language', () => {
    expect(search('QF7')[0]).toMatchObject({ kind: 'device', id: 'QF7' })
    expect(search('Kitchen').some((h) => h.kind === 'room' && h.id === 'kitchen')).toBe(true)
    expect(search('бойлер').length + search('водонагреватель').length).toBeGreaterThan(0)
  })

  it('answers which breaker to switch off for a point', () => {
    const point = d.points.find((p) => p.id === 'bt-wm')!
    const a = whatToSwitchOff(g, layoutPanel(d), point)!
    expect(a.device.id).toBe('QFD2')
    expect(a.place).toMatchObject({ rowIndex: 2 })
    expect(a.alternatives.map((x) => x.id)).toContain('QF0')
  })
})

describe('maintenance', () => {
  it('computes due dates and states', () => {
    const tasks = [
      { id: 'a', title: 'a', intervalDays: 30, devices: [] },
      { id: 'b', title: 'b', intervalDays: 365, devices: [] },
      { id: 'c', title: 'c', intervalDays: 30, devices: [] },
    ]
    const log = [
      { task: 'a', date: '2026-08-01' },
      { task: 'a', date: '2026-09-01' },
      { task: 'b', date: '2026-01-01' },
    ]
    const s = taskStatuses(tasks, log, new Date('2026-10-04T12:00:00Z'))
    expect(s[0]).toMatchObject({ due: '2026-10-01', overdueDays: 3, state: 'overdue' })
    expect(s[1]).toMatchObject({ due: '2027-01-01', state: 'ok' })
    expect(s[2]!.state).toBe('never')
  })
})

describe('bundle and crypto', () => {
  it('round-trips through encryption', async () => {
    const b = makeBundle(tiny(), { x: 'data:text/plain;base64,aGk=' })
    const env = await encryptJson(b, 'secret', 1000)
    expect(atob(env.data)).not.toContain('devices')
    expect(await decryptJson(env, 'secret')).toEqual(b)
    await expect(decryptJson(env, 'wrong')).rejects.toBeInstanceOf(WrongPasswordError)
  })

  it('parses YAML, JSON, plain data and envelopes', async () => {
    const b = makeBundle(tiny())
    expect(parseText(toYaml(b)).kind).toBe('bundle')
    expect(parseText(JSON.stringify(b.data)).kind).toBe('bundle')
    expect(parseText(JSON.stringify(await encryptJson(b, 'p', 1000))).kind).toBe('encrypted')
    expect(parseText('meta: 1').kind).toBe('invalid')
  })

  it('resolves and prunes assets', () => {
    const d = tiny({ photos: [{ id: 'ph', src: 'asset:a' }] })
    const b = pruneAssets(makeBundle(d, { a: 'data:a', b: 'data:b' }))
    expect(Object.keys(b.assets)).toEqual(['a'])
    expect(resolveAsset('asset:a', b.assets)).toBe('data:a')
    expect(resolveAsset('https://x/y.png', b.assets)).toBe('https://x/y.png')
  })
})

describe('bus systems', () => {
  const smart = () =>
    tiny({
      devices: [
        ...tiny().devices,
        {
          id: 'QA1',
          type: 'actuator',
          upstream: 'A1',
          smart: { system: 'knx', address: '1.1.2', channels: [{ id: 'A', function: 'heating', group: '3/1/1', points: ['p1'] }, { id: 'B', function: 'switch' }] },
        },
        { id: 'KF1', type: 'bus-gateway', smart: { system: 'knx', address: '1.1.2' } },
      ],
      points: [
        { id: 'p1', kind: 'heating', device: 'QA1', x: 0, y: 0, powerW: 800 },
        { id: 'pan', kind: 'panel', x: 0, y: 0, controls: ['3/1/1', '9/9/9'] },
      ],
    })

  it('flags a missing bus PSU, duplicate addresses and loose channels', () => {
    const d = smart()
    const r = runChecks(d, buildGraph(d)).map((c) => `${c.level}:${c.code}`)
    expect(r).toContain('error:bus-no-psu')
    expect(r).toContain('error:bus-dup-address')
    expect(r).toContain('info:channel-unlinked')
    expect(r).toContain('info:ga-unknown')
    expect(r).not.toContain('info:point-unassigned')
  })

  it('never offers a bus actuator as the thing to switch off', () => {
    const d = smart()
    const g = buildGraph(d)
    const a = whatToSwitchOff(g, layoutPanel(d), d.points[0]!)!
    expect(a.device.id).toBe('A1')
    expect(a.controlledBy?.id).toBe('QA1')
    expect(a.alternatives.map((x) => x.id)).toEqual(['D1', 'Q0'])
  })
})
