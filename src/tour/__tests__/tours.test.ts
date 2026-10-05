import { describe, expect, it } from 'vitest'
import en from '@/i18n/en.json'
import es from '@/i18n/es.json'
import ru from '@/i18n/ru.json'
import sr from '@/i18n/sr.json'
import { TOURS, tourFor } from '../tours'

type Tree = Record<string, unknown>
const get = (tree: Tree, path: string) => path.split('.').reduce<unknown>((o, k) => (o as Tree | undefined)?.[k], tree)

describe('tours', () => {
  it('has a title and text for every step in every language', () => {
    const missing: string[] = []
    for (const [name, messages] of Object.entries({ ru, en, sr, es }))
      for (const [id, steps] of Object.entries(TOURS))
        for (const s of steps)
          for (const part of ['title', 'text']) if (typeof get(messages as Tree, `tour.${id}.${s.key}.${part}`) !== 'string') missing.push(`${name}: tour.${id}.${s.key}.${part}`)
    expect(missing).toEqual([])
  })

  it('maps routes to their section tour', () => {
    expect(tourFor('device', { id: 'QF1' })).toBe('panel')
    expect(tourFor('edit', {})).toBe('edit-panel')
    expect(tourFor('edit', { tab: 'publish' })).toBe('edit-publish')
    expect(tourFor('settings', {})).toBeNull()
  })
})
