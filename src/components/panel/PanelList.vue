<script setup lang="ts">
import { computed } from 'vue'
import { Power, TriangleAlert } from '@lucide/vue'
import DeviceChip from '@/components/common/DeviceChip.vue'
import type { Device } from '@/domain/model'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'
import { useUi } from '@/stores/ui'

const emit = defineEmits<{ select: [id: string] }>()
const data = useData()
const ui = useUi()
const { t, tx } = useText()

const issueByDevice = computed(() => {
  const m = new Map<string, 'error' | 'warn'>()
  for (const c of data.checks) {
    if (!c.device || c.level === 'info') continue
    if (c.level === 'error' || !m.has(c.device)) m.set(c.device, c.level)
  }
  return m
})

const deadDevices = computed(() => {
  const g = data.graph
  if (!g || !ui.off.size) return new Set<string>()
  return new Set([...g.byId.keys()].filter((id) => !g.isFed(id, ui.off)))
})

function rating(d: Device) {
  return [d.rating ? `${d.curve ?? ''}${d.rating}A` : '', d.leakage ? `${d.leakage}mA` : ''].filter(Boolean).join(' · ')
}

function activate(id: string) {
  if (ui.simulate) ui.toggleOff(id)
  else emit('select', id)
}
</script>

<template>
  <div class="space-y-3">
    <section v-for="(row, ri) in data.layout" :key="row.id" class="rounded-2xl border bg-card">
      <header class="flex items-center gap-3 border-b px-4 py-2 text-sm">
        <span class="font-medium">{{ t('labels.row', { n: ri + 1 }) }}</span>
        <span class="text-xs text-muted-foreground tabular">{{ t('editor.panel.used', { used: row.used, total: row.modules }) }}</span>
      </header>
      <ul class="divide-y">
        <template v-for="item in row.items" :key="item.device?.id ?? `b${item.start}`">
          <li v-if="item.device">
            <button
              class="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-accent/60"
              :class="{
                'bg-accent': ui.selectedDevice === item.device.id,
                'opacity-40': !ui.matchesFilter(item.device.id),
              }"
              :aria-pressed="ui.simulate ? ui.off.has(item.device.id) : ui.selectedDevice === item.device.id"
              @click="activate(item.device.id)"
            >
              <DeviceChip :device="item.device" size="sm" />
              <span class="min-w-0 flex-1 truncate text-sm">{{ tx(item.device.label) }}</span>
              <TriangleAlert v-if="issueByDevice.has(item.device.id)" class="size-4 shrink-0" :class="issueByDevice.get(item.device.id) === 'error' ? 'text-danger' : 'text-warn'" />
              <Power v-if="ui.simulate" class="size-4 shrink-0" :class="ui.off.has(item.device.id) ? 'text-ok' : deadDevices.has(item.device.id) ? 'text-muted-foreground' : 'text-danger'" />
              <span class="shrink-0 font-mono text-xs text-muted-foreground tabular">{{ rating(item.device) }}</span>
            </button>
          </li>
        </template>
      </ul>
    </section>
  </div>
</template>
