import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { PanelData } from '@/domain/model'

// typing or dragging produces a burst of changes; one undo step covers the whole burst
const SETTLE_MS = 400

// Undo history over the draft's data. Assets are left out on purpose: snapshots stay a few
// kilobytes, and an undone photo simply becomes an unused asset that export prunes.
export function useHistory(draft: () => { data: PanelData } | null, limit = 80) {
  const source = () => draft()?.data
  const past = ref<string[]>([])
  const future = ref<string[]>([])
  let current = ''
  let timer: ReturnType<typeof setTimeout> | undefined

  function record() {
    clearTimeout(timer)
    timer = undefined
    const d = source()
    if (!d) return
    const snap = JSON.stringify(d)
    if (snap === current) return
    if (current) past.value = [...past.value.slice(1 - limit), current]
    future.value = []
    current = snap
  }

  function reset() {
    clearTimeout(timer)
    past.value = []
    future.value = []
    const d = source()
    current = d ? JSON.stringify(d) : ''
  }

  // a new draft (opened file, publish, discard) starts a new history; replacing draft.data on undo does not
  watch(draft, reset)
  watch(
    source,
    () => {
      clearTimeout(timer)
      timer = setTimeout(record, SETTLE_MS)
    },
    { deep: true },
  )
  reset()
  onBeforeUnmount(() => clearTimeout(timer))

  function step(from: typeof past, to: typeof future) {
    if (timer) record()
    const snap = from.value.at(-1)
    if (!snap) return
    from.value = from.value.slice(0, -1)
    to.value = [...to.value, current]
    current = snap
    const target = draft()
    if (target) target.data = JSON.parse(snap) as PanelData
  }

  return {
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    undo: () => step(past, future),
    redo: () => step(future, past),
  }
}
