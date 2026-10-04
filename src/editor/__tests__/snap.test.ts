import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import type { PanelData, Room } from '@/domain/model'
import { useHistory } from '../history'
import { orthogonal, parseTypedLength, placeOnWall, snapToGeometry, wallAt } from '../snap'

const box: Room = { id: 'r', name: 'R', wet: false, polygon: [[0, 0], [400, 0], [400, 300], [0, 300]] }

describe('snap', () => {
  it('prefers a corner over the wall it sits on', () => {
    expect(snapToGeometry([395, 6], [box], 12)).toEqual([400, 0])
  })

  it('falls back to the nearest wall', () => {
    expect(snapToGeometry([200, 7], [box], 12)).toEqual([200, 0])
    expect(snapToGeometry([200, 150], [box], 12)).toBeNull()
  })

  it('snaps to anchors such as outlets', () => {
    expect(snapToGeometry([102, 98], [], 12, [[100, 100]])).toEqual([100, 100])
  })

  it('finds the wall under a door click with its direction', () => {
    expect(wallAt([200, 12], [box], 40)).toEqual({ at: [200, 0], angle: 0 })
    expect(wallAt([390, 150], [box], 40)).toEqual({ at: [400, 150], angle: 90 })
    expect(wallAt([200, 150], [box], 40)).toBeNull()
  })

  it('puts an outlet on the wall, inset toward the clicked side', () => {
    expect(placeOnWall([200, 25], [box], 40)).toEqual([200, 10])
    expect(placeOnWall([200, -25], [box], 40)).toEqual([200, -10])
    expect(placeOnWall([200, 150], [box], 40)).toEqual([200, 150])
  })

  it('locks to the dominant axis', () => {
    expect(orthogonal([0, 0], [100, 20])).toEqual([100, 0])
    expect(orthogonal([0, 0], [20, 100])).toEqual([0, 100])
  })

  it('parses typed lengths in metres into centimetres', () => {
    expect(parseTypedLength('3.5')).toEqual({ a: 350 })
    expect(parseTypedLength('3,5')).toEqual({ a: 350 })
    expect(parseTypedLength('3.5x4')).toEqual({ a: 350, b: 400 })
    expect(parseTypedLength('3.5x')).toEqual({ a: 350 })
    expect(parseTypedLength('')).toBeNull()
    expect(parseTypedLength('.')).toBeNull()
    expect(parseTypedLength('1x2x3')).toBeNull()
  })
})

describe('history', () => {
  it('undoes and redoes settled edits, and a new draft starts fresh', async () => {
    vi.useFakeTimers()
    const state = reactive({ draft: { data: { rooms: [] as Room[] } as unknown as PanelData } as { data: PanelData } | null })
    const h = useHistory(() => state.draft)
    state.draft!.data.rooms.push(box)
    await nextTick()
    vi.advanceTimersByTime(500)
    expect(h.canUndo.value).toBe(true)

    h.undo()
    expect(state.draft!.data.rooms).toHaveLength(0)
    expect(h.canRedo.value).toBe(true)
    h.redo()
    expect(state.draft!.data.rooms).toHaveLength(1)

    state.draft = { data: { rooms: [] } as unknown as PanelData }
    await nextTick()
    expect(h.canUndo.value).toBe(false)
    vi.useRealTimers()
  })
})
