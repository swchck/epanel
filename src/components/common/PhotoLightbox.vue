<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight, MapPin } from '@lucide/vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { resolveAsset } from '@/domain/bundle'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'

const id = defineModel<string | null>('id', { default: null })
const data = useData()
const { tx, t } = useText()

const photos = computed(() => data.data?.photos ?? [])
const index = computed(() => photos.value.findIndex((p) => p.id === id.value))
const photo = computed(() => photos.value[index.value])
const src = computed(() => resolveAsset(photo.value?.src, data.assets))
const room = computed(() => tx(data.data?.rooms.find((r) => r.id === photo.value?.room)?.name))
const open = computed({
  get: () => !!id.value,
  set: (v) => {
    if (!v) id.value = null
  },
})

function step(d: number) {
  const n = photos.value.length
  if (!n) return
  id.value = photos.value[(index.value + d + n) % n]!.id
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-4xl gap-3 p-3 sm:p-4" @keydown.left="step(-1)" @keydown.right="step(1)">
      <DialogTitle class="pr-8 text-base">{{ tx(photo?.caption, t('photos.untitled')) }}</DialogTitle>
      <DialogDescription class="flex items-center gap-3 text-xs">
        <span v-if="room" class="flex items-center gap-1"><MapPin class="size-3.5" />{{ room }}</span>
        <span v-if="photo?.date">{{ photo.date }}</span>
      </DialogDescription>
      <div class="relative overflow-hidden rounded-lg bg-black">
        <img v-if="src" :src="src" :alt="tx(photo?.caption)" class="mx-auto max-h-[72vh] w-auto object-contain" />
        <template v-if="photos.length > 1">
          <button class="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70" :aria-label="t('common.prev')" @click="step(-1)">
            <ChevronLeft class="size-5" />
          </button>
          <button class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70" :aria-label="t('common.next')" @click="step(1)">
            <ChevronRight class="size-5" />
          </button>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>
