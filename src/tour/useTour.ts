import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { TOURS, type TourStep } from './tours'

// per-device: losing it to a private window only means the hints show once more
const seen = useLocalStorage<string[]>('tours-seen', [])
const active = ref<{ id: string; steps: TourStep[]; index: number } | null>(null)

// a step whose element is not on screen (no RCDs, a collapsed panel, a narrow layout) is dropped, not shown in the void
function present(steps: TourStep[]): TourStep[] {
  return steps.filter((s) => !s.target || document.querySelector(`[data-tour="${s.target}"]`))
}

/**
 * Drives the per-section onboarding: which tour is open, which step, and which sections were already shown.
 */
export function useTour() {
  function start(id: string): boolean {
    const steps = present(TOURS[id] ?? [])
    if (!steps.length) return false
    active.value = { id, steps, index: 0 }
    return true
  }

  function finish() {
    const id = active.value?.id
    if (id && !seen.value.includes(id)) seen.value = [...seen.value, id]
    active.value = null
  }

  function go(delta: number) {
    const a = active.value
    if (!a) return
    const next = a.index + delta
    if (next >= a.steps.length) return finish()
    if (next >= 0) active.value = { ...a, index: next }
  }

  return {
    active,
    step: computed(() => (active.value ? active.value.steps[active.value.index] : undefined)),
    has: (id: string) => !!TOURS[id]?.length,
    isSeen: (id: string) => seen.value.includes(id),
    start,
    finish,
    next: () => go(1),
    back: () => go(-1),
    reset: () => (seen.value = []),
  }
}
