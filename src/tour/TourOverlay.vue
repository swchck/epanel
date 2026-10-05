<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useText } from '@/composables/useText'
import { useTour } from './useTour'

const tour = useTour()
const { t } = useText()
const rect = ref<DOMRect | null>(null)
const card = ref<HTMLElement | null>(null)
const cardSize = ref({ w: 340, h: 180 })
const PAD = 8
const GAP = 14
const EDGE = 12

function targetEl() {
  const id = tour.step.value?.target
  return id ? document.querySelector<HTMLElement>(`[data-tour="${id}"]`) : null
}

function measure() {
  rect.value = targetEl()?.getBoundingClientRect() ?? null
  if (card.value) cardSize.value = { w: card.value.offsetWidth, h: card.value.offsetHeight }
}

watch(
  () => tour.step.value,
  async (s) => {
    if (!s) return
    const el = targetEl()
    // instant, not smooth: the spotlight is measured right after, and a smooth scroll would leave it behind
    el?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
    await nextTick()
    measure()
  },
  { immediate: true },
)

let raf = 0
const remeasure = () => {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(measure)
}
function onKey(e: KeyboardEvent) {
  if (!tour.active.value) return
  if (e.key === 'Escape') tour.finish()
  else if (e.key === 'ArrowRight' || e.key === 'Enter') tour.next()
  else if (e.key === 'ArrowLeft') tour.back()
  else return
  e.preventDefault()
  e.stopPropagation()
}
onMounted(() => {
  window.addEventListener('resize', remeasure)
  // the page scrolls inside <main>, not the window, so listen in the capture phase
  window.addEventListener('scroll', remeasure, true)
  window.addEventListener('keydown', onKey, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', remeasure)
  window.removeEventListener('scroll', remeasure, true)
  window.removeEventListener('keydown', onKey, true)
})

const hole = computed(() => {
  const r = rect.value
  return r ? { left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 } : null
})

// below the element when it fits, else above, else beside it, else over it; always clamped inside the viewport
const cardPos = computed(() => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const { w, h } = cardSize.value
  const hl = hole.value
  if (!hl) return { left: (vw - w) / 2, top: (vh - h) / 2 }
  const clampX = (x: number) => Math.min(Math.max(EDGE, x), vw - w - EDGE)
  const clampY = (y: number) => Math.min(Math.max(EDGE, y), vh - h - EDGE)
  const x = clampX(hl.left + hl.width / 2 - w / 2)
  if (hl.top + hl.height + GAP + h <= vh - EDGE) return { left: x, top: hl.top + hl.height + GAP }
  if (hl.top - GAP - h >= EDGE) return { left: x, top: hl.top - GAP - h }
  const y = clampY(Math.max(hl.top, EDGE + 40))
  if (hl.left + hl.width + GAP + w <= vw - EDGE) return { left: hl.left + hl.width + GAP, top: y }
  if (hl.left - GAP - w >= EDGE) return { left: hl.left - GAP - w, top: y }
  return { left: x, top: clampY(hl.top + hl.height / 2 - h / 2) }
})

const total = computed(() => tour.active.value?.steps.length ?? 0)
const index = computed(() => tour.active.value?.index ?? 0)
const key = computed(() => (tour.active.value && tour.step.value ? `tour.${tour.active.value.id}.${tour.step.value.key}` : ''))
</script>

<template>
  <Teleport to="body">
    <div v-if="tour.active.value && tour.step.value" class="fixed inset-0 z-[90]" role="dialog" aria-modal="true" :aria-label="t(`${key}.title`)">
      <!-- clicks outside the card are swallowed: the tour points at things, it does not let you press them yet -->
      <div class="absolute inset-0" @click.self="tour.next()" />
      <div
        v-if="hole"
        class="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-200"
        :style="{ left: `${hole.left}px`, top: `${hole.top}px`, width: `${hole.width}px`, height: `${hole.height}px`, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)' }"
      />
      <div v-else class="pointer-events-none absolute inset-0 bg-black/55" />
      <div
        ref="card"
        class="absolute w-[min(340px,calc(100vw-24px))] rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl transition-[left,top] duration-200"
        :style="{ left: `${cardPos.left}px`, top: `${cardPos.top}px` }"
      >
        <div class="mb-1 flex items-start gap-2">
          <h3 class="mr-auto font-semibold">{{ t(`${key}.title`) }}</h3>
          <button class="-mt-1 -mr-1 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" :aria-label="t('tour.skip')" @click="tour.finish()"><X class="size-4" /></button>
        </div>
        <p class="text-sm text-muted-foreground">{{ t(`${key}.text`) }}</p>
        <div class="mt-4 flex items-center gap-2">
          <div class="mr-auto flex gap-1" aria-hidden="true">
            <span v-for="i in total" :key="i" class="h-1.5 rounded-full transition-all" :class="i - 1 === index ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'" />
          </div>
          <Button v-if="index > 0" variant="ghost" size="sm" @click="tour.back()"><ChevronLeft /> {{ t('tour.back') }}</Button>
          <Button size="sm" @click="tour.next()">
            <template v-if="index + 1 < total">{{ t('tour.next') }} <ChevronRight /></template>
            <template v-else>{{ t('tour.done') }}</template>
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
