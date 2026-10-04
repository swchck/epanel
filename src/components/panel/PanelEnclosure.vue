<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { tr } from '@/domain/schema'
import { useData } from '@/stores/data'
import { useUi } from '@/stores/ui'
import DeviceModule from './DeviceModule.vue'
import PanelDefs from './PanelDefs.vue'
import { HEIGHT, MODULE, RAIL_PAD, ROW_GAP } from './geometry'

const props = withDefaults(defineProps<{ interactive?: boolean; compact?: boolean }>(), { interactive: true, compact: false })
const emit = defineEmits<{ select: [id: string] }>()

const data = useData()
const ui = useUi()
const { locale } = useI18n()

const maxModules = computed(() => Math.max(12, ...data.layout.map((r) => r.modules)))
const LABEL_H = 22
const rowPitch = HEIGHT + ROW_GAP
const frame = 26
const innerW = computed(() => maxModules.value * MODULE + RAIL_PAD * 2)
const width = computed(() => innerW.value + frame * 2)
const height = computed(() => data.layout.length * rowPitch + frame * 2 + 30)

const issueByDevice = computed(() => {
  const m = new Map<string, 'error' | 'warn'>()
  for (const c of data.checks) {
    if (!c.device || c.level === 'info') continue
    if (c.level === 'error' || !m.has(c.device)) m.set(c.device, c.level)
  }
  return m
})

const anyFocus = computed(() => ui.highlighted.size > 0)

function rowY(i: number) {
  return frame + 30 + i * rowPitch + 8
}

function isOn(id: string) {
  return !ui.off.has(id)
}

function isEnergized(id: string) {
  return data.graph?.isPowered(id, ui.off) ?? true
}

function isDimmed(id: string) {
  if (!ui.matchesFilter(id)) return true
  return anyFocus.value && !ui.highlighted.has(id)
}

function activate(id: string) {
  if (!props.interactive) return
  if (ui.simulate) ui.toggleOff(id)
  else emit('select', id)
}

function label(id: string) {
  const d = data.graph?.byId.get(id)
  return d ? `${d.id} ${tr(d.label, locale.value)}` : id
}
</script>

<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    class="panel-svg block h-auto w-full select-none"
    role="group"
    :aria-label="$t('panel.title')"
  >
    <PanelDefs />
    <!-- enclosure -->
    <rect x="0" y="0" :width="width" :height="height" rx="18" fill="url(#enclosure)" />
    <rect x="6" y="6" :width="width - 12" :height="height - 12" rx="14" fill="none" stroke="#ffffff" stroke-opacity="0.35" />
    <rect :x="frame" :y="frame" :width="innerW" :height="height - frame * 2" rx="8" fill="url(#backplate)" />
    <!-- nameplate -->
    <g :transform="`translate(${frame + 12}, ${frame + 6})`">
      <rect width="168" height="20" rx="3" fill="#f7f5ee" stroke="#b4b0a2" />
      <text x="8" y="14" class="nameplate">{{ tr(data.data?.meta.title, locale) }}</text>
    </g>

    <g v-for="(row, ri) in data.layout" :key="row.id" :transform="`translate(${frame + RAIL_PAD}, ${rowY(ri)})`">
      <!-- DIN rail -->
      <rect :x="-RAIL_PAD + 6" :y="HEIGHT / 2 - 17" :width="row.modules * MODULE + RAIL_PAD * 2 - 12" height="34" rx="2" fill="url(#rail)" />
      <g v-for="s in Math.floor((row.modules * MODULE + RAIL_PAD * 2) / 40)" :key="'slot' + s">
        <rect :x="-RAIL_PAD + (s - 1) * 40 + 14" :y="HEIGHT / 2 - 4" width="22" height="8" rx="4" fill="#6f747c" />
      </g>
      <!-- module grid ghost so empty slots read as space -->
      <rect x="0" y="0" :width="row.modules * MODULE" :height="HEIGHT" fill="none" stroke="#000" stroke-opacity="0.08" stroke-dasharray="3 5" rx="4" />
      <text :x="-RAIL_PAD + 4" :y="-10" class="rowno">{{ ri + 1 }}</text>

      <template v-for="item in row.items" :key="item.device?.id ?? `blank-${item.start}`">
        <g v-if="item.kind === 'blank'" :transform="`translate(${item.start * MODULE}, 0)`">
          <rect x="1" y="38" :width="item.width * MODULE - 2" :height="HEIGHT - 76" rx="3" fill="url(#blank)" stroke="#b9b6aa" />
          <line
            v-for="k in Math.round(item.width)"
            :key="k"
            :x1="k * MODULE"
            y1="44"
            :x2="k * MODULE"
            :y2="HEIGHT - 44"
            stroke="#c8c5b9"
            v-show="k < item.width"
          />
        </g>
        <g
          v-else-if="item.device"
          :transform="`translate(${item.start * MODULE}, 0)`"
          class="device-hit"
          :class="{ 'cursor-pointer': interactive }"
          :tabindex="interactive ? 0 : -1"
          role="button"
          :aria-label="label(item.device.id)"
          :aria-pressed="ui.selectedDevice === item.device.id"
          @click="activate(item.device.id)"
          @keydown.enter.prevent="activate(item.device.id)"
          @keydown.space.prevent="activate(item.device.id)"
          @mouseenter="ui.hoverDevice = item.device.id"
          @mouseleave="ui.hoverDevice = null"
          @focus="ui.hoverDevice = item.device.id"
          @blur="ui.hoverDevice = null"
        >
          <DeviceModule
            :device="item.device"
            :width="item.width"
            :on="isOn(item.device.id)"
            :energized="isEnergized(item.device.id)"
            :selected="ui.selectedDevice === item.device.id"
            :dimmed="isDimmed(item.device.id)"
            :issue="issueByDevice.get(item.device.id)"
          />
          <!-- marking strip under the device, like the label tape on a real cover -->
          <g :transform="`translate(0, ${HEIGHT + 6})`" :class="{ 'opacity-30': isDimmed(item.device.id) }">
            <rect x="1" y="0" :width="item.width * MODULE - 2" :height="LABEL_H" rx="2" fill="#fbfaf5" stroke="#cfccc0" />
            <text :x="(item.width * MODULE) / 2" y="15" text-anchor="middle" class="mark" :class="{ 'mark-sm': item.width < 1.5 && item.device.id.length > 3 }">
              {{ item.device.id }}
            </text>
          </g>
          <rect v-if="item.overflow" x="0" y="0" :width="item.width * MODULE" :height="HEIGHT" fill="none" stroke="var(--danger)" stroke-width="2" stroke-dasharray="4 3" />
        </g>
      </template>
    </g>
  </svg>
</template>

<style scoped>
.device-hit:focus-visible {
  outline: none;
}
.device-hit:focus-visible :deep(rect:first-of-type) {
  stroke: var(--ring);
  stroke-width: 2.5;
}
text {
  user-select: none;
}
.nameplate {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  fill: #3a3a35;
}
.rowno {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  fill: #7d7a70;
}
.mark {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  fill: #26251f;
}
.mark-sm {
  font-size: 8px;
}
</style>
