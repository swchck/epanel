<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Plus, SquareDashed, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import DeviceChip from '@/components/common/DeviceChip.vue'
import PanelEnclosure from '@/components/panel/PanelEnclosure.vue'
import { TYPE_ACCENT } from '@/components/panel/geometry'
import { DEVICE_TYPES, defaultWidth, type DeviceType } from '@/domain/model'
import { addDevice, addRow, findItem, insertBlank, moveItem, moveToRow, removeDevice, removeRow } from '@/editor/ops'
import { useDraft } from '@/composables/useDraft'
import { useText } from '@/composables/useText'
import { useUi } from '@/stores/ui'
import DeviceForm from './DeviceForm.vue'
import NumberInput from './NumberInput.vue'

const { d, data } = useDraft()
const ui = useUi()
const { t, tx } = useText()

const selected = computed(() => d.value.devices.find((x) => x.id === ui.selectedDevice))
const loc = computed(() => (selected.value ? findItem(d.value, selected.value.id) : undefined))
const free = (i: number) => (d.value.rows[i]?.modules ?? 0) - used(i)
// with nothing selected, new devices go to the first row with a free slot; past the last row, a new one is added
const targetRow = computed(() => {
  if (loc.value) return loc.value.row
  const i = d.value.rows.findIndex((_, ri) => free(ri) >= 1)
  return i >= 0 ? i : d.value.rows.length
})
const unplaced = computed(() => d.value.devices.filter((x) => !findItem(d.value, x.id)))

function add(type: DeviceType) {
  const dev = addDevice(d.value, type, -1)
  if (loc.value) {
    d.value.rows[loc.value.row]!.items.splice(loc.value.index + 1, 0, dev.id)
  } else {
    const width = defaultWidth(dev)
    let row = [targetRow.value, ...d.value.rows.keys()].find((i) => free(i) >= width)
    if (row === undefined) {
      addRow(d.value)
      row = d.value.rows.length - 1
    }
    d.value.rows[row]!.items.push(dev.id)
  }
  // new devices hang off the selected RCD (or the selected device's own feeder) — the common way panels are filled in
  const sel = selected.value
  if (sel) dev.upstream = sel.type === 'rcd' ? sel.id : sel.upstream
  ui.select(dev.id)
}

function remove() {
  if (!selected.value) return
  removeDevice(d.value, selected.value.id)
  ui.select(null)
}

function used(i: number) {
  return data.layout[i]?.used ?? 0
}
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
    <div class="min-w-0 space-y-4">
      <div class="rounded-2xl border bg-card p-3">
        <div class="mb-2 text-xs font-medium text-muted-foreground">{{ t('editor.panel.palette', { row: targetRow + 1 }) }}</div>
        <div class="flex flex-wrap gap-1.5">
          <Button v-for="tp in DEVICE_TYPES" :key="tp" variant="outline" size="sm" @click="add(tp)">
            <span class="size-2 rounded-full" :style="{ background: TYPE_ACCENT[tp] }" />
            {{ t(`device.typeShort.${tp}`) }}
          </Button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-2xl">
        <div class="mx-auto max-w-[900px]">
          <PanelEnclosure @select="(id) => ui.select(ui.selectedDevice === id ? null : id)" />
        </div>
      </div>

      <div class="space-y-2">
        <div v-for="(row, ri) in d.rows" :key="row.id" class="rounded-xl border bg-card p-3">
          <div class="mb-2 flex flex-wrap items-center gap-3">
            <span class="text-sm font-medium">{{ t('labels.row', { n: ri + 1 }) }}</span>
            <span class="text-xs text-muted-foreground" :class="{ 'text-danger': used(ri) > row.modules }">{{ t('editor.panel.used', { used: used(ri), total: row.modules }) }}</span>
            <div class="w-28"><NumberInput v-model="row.modules" integer :max="48" :suffix="t('editor.panel.mod')" /></div>
            <div class="flex-1" />
            <Button variant="ghost" size="icon-sm" :aria-label="t('common.delete')" :disabled="row.items.length > 0" @click="removeRow(d, ri)"><Trash2 /></Button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <template v-for="(it, ii) in row.items" :key="ii">
              <button v-if="typeof it === 'string'" :class="{ 'ring-2 ring-primary rounded-md': ui.selectedDevice === it }" @click="ui.select(it)">
                <DeviceChip :device="d.devices.find((x) => x.id === it) ?? { id: it, type: 'other' }" size="sm" />
              </button>
              <span v-else class="inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 text-[11px] text-muted-foreground">
                <SquareDashed class="size-3" />
                <button :aria-label="t('editor.panel.narrower')" @click="it.blank > 1 ? (it.blank -= 1) : row.items.splice(ii, 1)"><Minus class="size-3" /></button>
                {{ it.blank }}
                <button :aria-label="t('editor.panel.wider')" @click="it.blank += 1"><Plus class="size-3" /></button>
              </span>
            </template>
            <button class="rounded-md border border-dashed px-2 text-[11px] text-muted-foreground hover:text-foreground" @click="insertBlank(d, ri, row.items.length)">+ {{ t('editor.panel.blank') }}</button>
          </div>
        </div>
        <Button variant="outline" size="sm" @click="addRow(d)"><Plus /> {{ t('editor.panel.addRow') }}</Button>
      </div>

      <div v-if="unplaced.length" class="rounded-xl border border-warn/40 bg-warn/10 p-3">
        <div class="mb-2 text-sm font-medium">{{ t('editor.panel.unplaced') }}</div>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="u in unplaced" :key="u.id" @click="ui.select(u.id)"><DeviceChip :device="u" size="sm" /></button>
        </div>
      </div>
    </div>

    <aside class="space-y-4">
      <div v-if="selected" class="rounded-2xl border bg-card p-4">
        <div class="mb-4 flex flex-wrap items-center gap-1.5">
          <DeviceChip :device="selected" />
          <span class="mr-auto truncate text-sm text-muted-foreground">{{ tx(selected.label) }}</span>
          <template v-if="loc">
            <Button variant="outline" size="icon-sm" :aria-label="t('editor.panel.left')" @click="moveItem(d, loc.row, loc.index, -1)"><ArrowLeft /></Button>
            <Button variant="outline" size="icon-sm" :aria-label="t('editor.panel.right')" @click="moveItem(d, loc.row, loc.index, 1)"><ArrowRight /></Button>
            <Button variant="outline" size="icon-sm" :disabled="loc.row === 0" :aria-label="t('editor.panel.rowUp')" @click="moveToRow(d, selected.id, loc.row - 1)"><ArrowUp /></Button>
            <Button variant="outline" size="icon-sm" :disabled="loc.row >= d.rows.length - 1" :aria-label="t('editor.panel.rowDown')" @click="moveToRow(d, selected.id, loc.row + 1)"><ArrowDown /></Button>
            <Button variant="outline" size="icon-sm" :aria-label="t('editor.panel.blankBefore')" @click="insertBlank(d, loc.row, loc.index)"><SquareDashed /></Button>
          </template>
          <Button v-else variant="outline" size="sm" @click="moveToRow(d, selected.id, targetRow)">{{ t('editor.panel.place') }}</Button>
          <Button variant="destructive" size="icon-sm" :aria-label="t('common.delete')" @click="remove"><Trash2 /></Button>
        </div>
        <DeviceForm :id="selected.id" :key="selected.id" />
      </div>
      <div v-else class="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{{ t('editor.panel.pick') }}</div>
    </aside>
  </div>
</template>
