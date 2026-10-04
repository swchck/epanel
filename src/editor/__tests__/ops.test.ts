import { describe, expect, it } from 'vitest'
import { tiny } from '@/domain/__tests__/fixture'
import { addDevice, addRow, feederAt, findItem, insertBlank, moveItem, moveToRow, nextDeviceId, placeAt, removeDevice, removePoint, removeRoom, renameDevice } from '../ops'
import { referenceIssues } from '@/domain/model'

describe('editor ops', () => {
  it('numbers new devices by type prefix', () => {
    const d = tiny()
    expect(nextDeviceId(d, 'mcb')).toBe('QF1')
    expect(nextDeviceId(d, 'rcd')).toBe('QD1')
    const dev = addDevice(d, 'mcb', 0)
    expect(dev).toMatchObject({ id: 'QF1', rating: 16, curve: 'C' })
    expect(d.rows[0]!.items.at(-1)).toBe('QF1')
    expect(nextDeviceId(d, 'mcb')).toBe('QF2')
  })

  it('renames a device everywhere it is referenced', () => {
    const d = tiny()
    d.maintenance.tasks.push({ id: 't', title: 't', intervalDays: 1, devices: ['D1'] })
    expect(renameDevice(d, 'D1', 'QD9')).toBe(true)
    expect(d.devices.find((x) => x.id === 'A1')!.upstream).toBe('QD9')
    expect(d.rows[0]!.items).toContain('QD9')
    expect(d.maintenance.tasks[0]!.devices).toEqual(['QD9'])
    expect(renameDevice(d, 'A1', 'A2')).toBe(false)
  })

  it('removes a device and re-attaches its children upstream', () => {
    const d = tiny()
    removeDevice(d, 'D1')
    expect(d.devices.find((x) => x.id === 'A1')!.upstream).toBe('Q0')
    expect(d.rows[0]!.items).not.toContain('D1')
    removeDevice(d, 'A1')
    expect(d.points.find((p) => p.id === 'p1')!.device).toBeUndefined()
  })

  it('reorders items within and across rows', () => {
    const d = tiny()
    moveItem(d, 0, 2, 1)
    expect(d.rows[0]!.items.slice(0, 4)).toEqual(['Q0', 'D1', 'A2', 'A1'])
    moveItem(d, 0, 0, -1)
    expect(d.rows[0]!.items[0]).toBe('Q0')
    addRow(d)
    moveToRow(d, 'A1', 1)
    expect(findItem(d, 'A1')).toEqual({ row: 1, index: 0 })
    insertBlank(d, 1, 0, 2)
    expect(d.rows[1]!.items[0]).toEqual({ blank: 2 })
  })

  it('removes rooms and clears point references', () => {
    const d = tiny()
    d.points[0]!.room = 'bath'
    removeRoom(d, 'bath')
    expect(d.rooms).toEqual([])
    expect(d.points[0]!.room).toBeUndefined()
  })

  it('removes a point together with the bus channels that switch it', () => {
    const d = tiny()
    const pid = d.points[0]!.id
    d.devices[0]!.smart = { system: 'knx', channels: [{ id: 'A', function: 'switch', points: [pid] }] }
    removePoint(d, pid)
    expect(d.points.find((p) => p.id === pid)).toBeUndefined()
    expect(d.devices[0]!.smart!.channels[0]!.points).toEqual([])
    expect(referenceIssues(d)).toEqual([])
  })

  it('reports channel points and routes that point nowhere', () => {
    const d = tiny()
    d.devices[0]!.smart = { system: 'knx', channels: [{ id: 'A', function: 'switch', points: ['ghost'] }] }
    d.routes.push({ id: 'r', device: 'NOPE', points: [[0, 0], [1, 1]], kind: 'power', cables: [], safeWidth: 15 })
    expect(referenceIssues(d).map((i) => i.message)).toEqual(['unknown device NOPE', 'unknown point ghost'])
  })

  it('places a device into a blank and cuts the blank back', () => {
    const d = tiny()
    const dev = addDevice(d, 'mcb', -1)
    placeAt(d, dev.id, 0, 4)
    expect(d.rows[0]!.items.slice(4)).toEqual([dev.id, { blank: 1 }])
    const second = addDevice(d, 'mcb', -1)
    placeAt(d, second.id, 0, 5)
    expect(d.rows[0]!.items.slice(4)).toEqual([dev.id, second.id])
  })

  it('feeds a new breaker from the RCD on its left', () => {
    const d = tiny()
    expect(feederAt(d, 0, 2)).toBe('D1')
    expect(feederAt(d, 0, 4)).toBe('D1')
    expect(feederAt(d, 0, 1)).toBeUndefined()
  })
})
