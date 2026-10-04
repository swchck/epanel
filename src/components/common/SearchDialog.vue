<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CornerDownLeft, DoorOpen, Search } from '@lucide/vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { SearchHit } from '@/domain/lookup'
import { useText } from '@/composables/useText'
import { NAV } from '@/router'
import { useData } from '@/stores/data'
import { useUi } from '@/stores/ui'
import { POINT_ICONS } from './kinds'
import { NAV_ICONS } from './navIcons'
import DeviceChip from './DeviceChip.vue'

const ui = useUi()
const data = useData()
const router = useRouter()
const { t, tx } = useText()
const q = ref('')
const active = ref(0)

const hits = computed(() => data.search(q.value, 24))
const pages = computed(() =>
  NAV.filter((n) => !q.value || t(`nav.${n.name}`).toLowerCase().includes(q.value.toLowerCase())).slice(0, q.value ? 4 : 11),
)
type Row = { kind: 'page'; name: (typeof NAV)[number]['name']; path: string } | { kind: 'hit'; hit: SearchHit }
const rows = computed<Row[]>(() => [
  ...hits.value.map((hit) => ({ kind: 'hit' as const, hit })),
  ...pages.value.map((p) => ({ kind: 'page' as const, name: p.name, path: p.path })),
])

watch(q, () => (active.value = 0))
watch(
  () => ui.searchOpen,
  (o) => {
    if (o) q.value = ''
  },
)

function roomName(id?: string) {
  return tx(data.data?.rooms.find((r) => r.id === id)?.name)
}

function go(r: Row | undefined) {
  if (!r) return
  ui.searchOpen = false
  if (r.kind === 'page') return router.push(r.path)
  const h = r.hit
  if (h.kind === 'device') return router.push(`/d/${h.id}`)
  if (h.kind === 'room') return router.push({ path: '/plan', query: { room: h.id } })
  return router.push({ path: '/plan', query: { point: h.id } })
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    active.value = Math.min(rows.value.length - 1, active.value + 1)
    e.preventDefault()
  } else if (e.key === 'ArrowUp') {
    active.value = Math.max(0, active.value - 1)
    e.preventDefault()
  } else if (e.key === 'Enter') {
    go(rows.value[active.value])
    e.preventDefault()
  }
}
</script>

<template>
  <Dialog v-model:open="ui.searchOpen">
    <DialogContent class="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0" :show-close-button="false">
      <DialogTitle class="sr-only">{{ t('search.open') }}</DialogTitle>
      <DialogDescription class="sr-only">{{ t('search.placeholder') }}</DialogDescription>
      <div class="flex items-center gap-3 border-b px-4">
        <Search class="size-5 text-muted-foreground" />
        <input
          v-model="q"
          autofocus
          class="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          :placeholder="t('search.placeholder')"
          @keydown="onKey"
        />
      </div>
      <div class="max-h-[60vh] overflow-y-auto p-2">
        <div v-if="q && !hits.length" class="px-3 py-8 text-center text-sm text-muted-foreground">{{ t('search.empty') }}</div>
        <button
          v-for="(r, i) in rows"
          :key="r.kind === 'page' ? 'p' + r.name : r.hit.kind + r.hit.id"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm"
          :class="i === active ? 'bg-accent' : ''"
          @mouseenter="active = i"
          @click="go(r)"
        >
          <template v-if="r.kind === 'hit' && r.hit.kind === 'device'">
            <DeviceChip :device="r.hit.device" />
            <span class="min-w-0 flex-1 truncate">{{ tx(r.hit.device.label) }}</span>
            <span class="text-xs text-muted-foreground">{{ t(`device.type.${r.hit.device.type}`) }}</span>
          </template>
          <template v-else-if="r.kind === 'hit' && r.hit.kind === 'room'">
            <DoorOpen class="size-4.5 text-muted-foreground" />
            <span class="flex-1">{{ tx(r.hit.room.name) }}</span>
            <span class="text-xs text-muted-foreground">{{ t('search.room') }}</span>
          </template>
          <template v-else-if="r.kind === 'hit' && r.hit.kind === 'point'">
            <component :is="POINT_ICONS[r.hit.point.kind]" class="size-4.5 text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate">{{ tx(r.hit.point.label, t(`point.kind.${r.hit.point.kind}`)) }}</span>
            <span class="text-xs text-muted-foreground">{{ roomName(r.hit.point.room) }}</span>
          </template>
          <template v-else-if="r.kind === 'page'">
            <component :is="NAV_ICONS[r.name]" class="size-4.5 text-muted-foreground" />
            <span class="flex-1">{{ t(`nav.${r.name}`) }}</span>
          </template>
          <CornerDownLeft v-if="i === active" class="size-4 text-muted-foreground" />
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>
