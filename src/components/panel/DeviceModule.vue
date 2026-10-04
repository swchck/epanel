<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Device } from '@/domain/schema'
import { HEIGHT, MODULE } from './geometry'

const props = defineProps<{
  device: Device
  width: number
  // lever position: false only when the user switched it off in simulation
  on: boolean
  // whether voltage reaches this device at all
  energized: boolean
  selected?: boolean
  dimmed?: boolean
  issue?: 'error' | 'warn'
}>()

const W = computed(() => props.width * MODULE)
const poles = computed(() => Math.max(1, Math.min(props.device.poles, Math.round(props.width))))
const t = computed(() => props.device.type)
const rating = computed(() => {
  const d = props.device
  if (!d.rating) return ''
  return d.curve ? `${d.curve}${d.rating}` : `${d.rating}A`
})
const isBreakerLike = computed(() => ['mcb', 'rcd', 'rcbo', 'switch'].includes(t.value))
const leverPoles = computed(() => (t.value === 'rcd' || t.value === 'rcbo' ? 1 : poles.value))
const leverX = computed(() => {
  if (t.value === 'rcd' || t.value === 'rcbo') return 4
  return 4
})
const leverW = computed(() => leverPoles.value * MODULE - 8)
const leverColor = computed(() => {
  if (t.value === 'switch') return 'url(#lever-red)'
  if (t.value === 'rcd') return 'url(#lever-blue)'
  if (t.value === 'rcbo') return 'url(#lever-violet)'
  return 'url(#lever-dark)'
})

const terminalsTop = computed(() => Array.from({ length: Math.max(1, Math.round(props.width)) }, (_, i) => i))

// live readouts are cosmetic: a voltage that wanders by a couple of volts and a meter that ticks
const volts = ref(230)
const kwh = ref(12873.4)
let timer: ReturnType<typeof setInterval> | undefined
function tick() {
  volts.value = 228 + Math.round(Math.random() * 5)
  kwh.value = +(kwh.value + 0.1).toFixed(1)
}
watch(
  () => props.energized && (t.value === 'voltage-relay' || t.value === 'meter'),
  (live) => {
    clearInterval(timer)
    if (live) timer = setInterval(tick, 2200 + Math.random() * 800)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearInterval(timer))

const kwhText = computed(() => kwh.value.toFixed(1).padStart(8, '0'))
const busColor = computed(() => {
  const id = props.device.id.toUpperCase()
  if (id.includes('PE') || props.device.tags.some((x) => /pe|земл|earth/i.test(x))) return 'pe'
  return 'n'
})
</script>

<template>
  <g
    class="device"
    :class="{ 'is-selected': selected, 'is-dimmed': dimmed, 'is-dead': !energized }"
    :data-type="t"
  >
    <!-- selection glow -->
    <rect
      v-if="selected"
      :x="-4"
      :y="-4"
      :width="W + 8"
      :height="HEIGHT + 8"
      rx="8"
      fill="none"
      stroke="var(--live)"
      stroke-width="3"
      filter="url(#glow)"
      class="sel-ring"
    />

    <!-- body -->
    <template v-if="t !== 'bus' && t !== 'terminal'">
      <rect x="1" y="0" :width="W - 2" :height="HEIGHT" rx="4" fill="url(#body)" stroke="#a8a8a0" stroke-width="1" />
      <!-- terminal recesses -->
      <rect x="3" y="3" :width="W - 6" height="26" rx="2" fill="url(#recess)" />
      <rect x="3" :y="HEIGHT - 29" :width="W - 6" height="26" rx="2" fill="url(#recess)" />
      <g v-for="i in terminalsTop" :key="'t' + i">
        <circle :cx="i * MODULE + MODULE / 2" cy="16" r="7" fill="url(#screw)" stroke="#6b6b66" stroke-width="0.8" />
        <line :x1="i * MODULE + MODULE / 2 - 5" y1="16" :x2="i * MODULE + MODULE / 2 + 5" y2="16" stroke="#55554f" stroke-width="1.6" />
        <circle :cx="i * MODULE + MODULE / 2" :cy="HEIGHT - 16" r="7" fill="url(#screw)" stroke="#6b6b66" stroke-width="0.8" />
        <line :x1="i * MODULE + MODULE / 2 - 5" :y1="HEIGHT - 16" :x2="i * MODULE + MODULE / 2 + 5" :y2="HEIGHT - 16" stroke="#55554f" stroke-width="1.6" />
        <!-- live wire glow at the top terminal -->
        <circle v-if="energized" :cx="i * MODULE + MODULE / 2" cy="16" r="3" fill="var(--live)" class="live-dot" />
      </g>
      <!-- raised front shoulder -->
      <rect x="2" y="40" :width="W - 4" :height="HEIGHT - 80" rx="3" fill="url(#shoulder)" stroke="#c4c4bc" stroke-width="0.6" />
    </template>

    <!-- breakers, RCDs, RCBOs, switches -->
    <template v-if="isBreakerLike">
      <text :x="W / 2" y="54" text-anchor="middle" class="brand">{{ device.brand ?? '' }}</text>
      <!-- lever slot -->
      <rect :x="leverX - 1" y="66" :width="leverW + 2" height="46" rx="3" fill="#2a2a28" />
      <!-- position indicator: red I when on, green O when off, as printed on most European breakers -->
      <rect :x="leverX + leverW / 2 - 5" y="60" width="10" height="5" rx="1" :fill="on ? '#d93a2b' : '#2f9e44'" />
      <g class="lever" :style="{ transform: `translateY(${on ? 0 : 20}px)` }">
        <rect :x="leverX + 1" y="68" :width="leverW - 2" height="22" rx="3" :fill="leverColor" />
        <rect :x="leverX + 3" y="70" :width="leverW - 6" height="4" rx="1.5" fill="white" opacity="0.25" />
      </g>
      <!-- RCD extras: test button and leakage -->
      <template v-if="t === 'rcd' || t === 'rcbo'">
        <circle :cx="W - MODULE / 2" cy="80" r="8" fill="#e8c547" stroke="#a88a1e" />
        <text :x="W - MODULE / 2" y="83.5" text-anchor="middle" class="test">T</text>
        <text :x="W - MODULE / 2" y="104" text-anchor="middle" class="small">{{ device.leakage ? `${device.leakage}mA` : '' }}</text>
        <text v-if="device.rcdClass" :x="W - MODULE / 2" y="114" text-anchor="middle" class="tiny">type {{ device.rcdClass }}</text>
      </template>
      <text :x="(t === 'rcd' || t === 'rcbo' ? leverW / 2 + leverX : W / 2)" y="128" text-anchor="middle" class="rating">{{ rating }}</text>
    </template>

    <!-- voltage relay with an LCD -->
    <template v-else-if="t === 'voltage-relay'">
      <text :x="W / 2" y="54" text-anchor="middle" class="brand">{{ device.brand ?? '' }}</text>
      <rect x="6" y="62" :width="W - 12" height="30" rx="3" fill="url(#lcd)" stroke="#123" />
      <text :x="W / 2" y="84" text-anchor="middle" class="seg" :class="{ off: !energized }">{{ energized ? volts : '---' }}</text>
      <circle cx="12" cy="102" r="3" :fill="energized ? '#22c55e' : '#3a3a3a'" />
      <circle :cx="W - 20" cy="104" r="5" fill="#d1d1ca" stroke="#999" />
      <circle :cx="W - 8 - 0" cy="104" r="5" fill="#d1d1ca" stroke="#999" />
      <text :x="W / 2" y="128" text-anchor="middle" class="rating">{{ rating }}</text>
    </template>

    <!-- energy meter -->
    <template v-else-if="t === 'meter'">
      <text x="8" y="54" class="brand" text-anchor="start">{{ device.brand ?? '' }}</text>
      <rect x="6" y="60" :width="W - 12" height="32" rx="3" fill="url(#lcd)" stroke="#123" />
      <text :x="W - 12" y="83" text-anchor="end" class="seg seg-sm" :class="{ off: !energized }">{{ energized ? kwhText : '--------' }}</text>
      <text :x="W - 10" y="104" text-anchor="end" class="small">kWh</text>
      <circle cx="14" cy="104" r="3.5" :fill="energized ? '#ef4444' : '#3a3a3a'" :class="{ blink: energized }" />
      <text x="22" y="107" class="tiny" text-anchor="start">imp</text>
      <text :x="W / 2" y="126" text-anchor="middle" class="small">{{ device.model ?? '' }}</text>
    </template>

    <!-- surge protector: plug-in cartridges with indicator windows -->
    <template v-else-if="t === 'spd'">
      <g v-for="i in poles" :key="'c' + i">
        <rect :x="(i - 1) * MODULE + 4" y="44" :width="MODULE - 8" :height="HEIGHT - 88" rx="3" fill="url(#shoulder)" stroke="#9a9a92" />
        <rect :x="(i - 1) * MODULE + MODULE / 2 - 6" y="56" width="12" height="9" rx="1.5" fill="#22c55e" stroke="#166534" />
        <text :x="(i - 1) * MODULE + MODULE / 2" y="100" text-anchor="middle" class="tiny">{{ i === poles && poles > 1 ? 'N' : 'L' }}</text>
      </g>
      <text :x="W / 2" y="126" text-anchor="middle" class="small">T2</text>
    </template>

    <!-- DIN rail socket -->
    <template v-else-if="t === 'din-socket'">
      <circle :cx="W / 2" cy="88" r="30" fill="#e9e9e3" stroke="#a0a098" />
      <circle :cx="W / 2" cy="88" r="24" fill="#d8d8d0" />
      <circle :cx="W / 2 - 9" cy="88" r="3.5" fill="#333" />
      <circle :cx="W / 2 + 9" cy="88" r="3.5" fill="#333" />
      <rect :x="W / 2 - 3" y="62" width="6" height="5" fill="#b0b0a8" />
      <rect :x="W / 2 - 3" y="109" width="6" height="5" fill="#b0b0a8" />
    </template>

    <!-- contactor -->
    <template v-else-if="t === 'contactor'">
      <rect x="8" y="64" :width="W - 16" height="26" rx="2" fill="#30302d" />
      <rect :x="W / 2 - 6" :y="on && energized ? 66 : 76" width="12" height="12" rx="2" fill="#e5e5e0" class="lever" />
      <text :x="W / 2" y="110" text-anchor="middle" class="tiny">A1 · A2</text>
      <text :x="W / 2" y="128" text-anchor="middle" class="rating">{{ rating }}</text>
    </template>

    <!-- neutral / earth bus -->
    <template v-else-if="t === 'bus'">
      <rect x="1" y="60" :width="W - 2" height="56" rx="4" :fill="busColor === 'pe' ? 'url(#pe-base)' : 'url(#n-base)'" stroke="#334" stroke-opacity="0.4" />
      <rect x="6" y="76" :width="W - 12" height="24" rx="2" fill="url(#brass)" stroke="#7a5f17" />
      <g v-for="i in Math.max(2, Math.round(width * 2))" :key="'s' + i">
        <circle :cx="6 + (i - 0.5) * ((W - 12) / Math.max(2, Math.round(width * 2)))" cy="88" r="5" fill="url(#screw)" stroke="#6b5a20" stroke-width="0.6" />
      </g>
      <text :x="W / 2" y="132" text-anchor="middle" class="busl">{{ busColor === 'pe' ? 'PE' : 'N' }}</text>
    </template>

    <!-- terminal blocks -->
    <template v-else-if="t === 'terminal'">
      <g v-for="i in Math.max(1, Math.round(width * 2))" :key="'k' + i">
        <rect :x="(i - 1) * (W / Math.max(1, Math.round(width * 2))) + 1" y="40" :width="W / Math.max(1, Math.round(width * 2)) - 2" :height="HEIGHT - 80" rx="2" fill="#9aa4b2" stroke="#5b6470" />
        <circle :cx="(i - 0.5) * (W / Math.max(1, Math.round(width * 2)))" cy="60" r="4" fill="url(#screw)" />
      </g>
    </template>

    <template v-else>
      <text :x="W / 2" y="92" text-anchor="middle" class="rating">{{ rating || device.id }}</text>
    </template>

    <!-- dead overlay: de-energised devices look cold -->
    <rect
      v-if="!energized"
      x="1"
      y="0"
      :width="W - 2"
      :height="HEIGHT"
      rx="4"
      fill="#0b1b33"
      opacity="0.38"
      class="dead"
      pointer-events="none"
    />

    <g v-if="issue" :transform="`translate(${W - 9}, 40)`">
      <circle r="8" :fill="issue === 'error' ? 'var(--danger)' : 'var(--warn)'" stroke="white" stroke-width="1.5" />
      <text y="4" text-anchor="middle" class="issue">!</text>
    </g>
  </g>
</template>

<style scoped>
.device {
  transition: opacity 0.25s ease, filter 0.25s ease;
}
.device.is-dimmed {
  opacity: 0.28;
  filter: grayscale(0.8);
}
.lever {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), y 0.25s ease;
  transform-box: fill-box;
}
.sel-ring {
  animation: sel 1.8s ease-in-out infinite;
}
@keyframes sel {
  50% {
    stroke-opacity: 0.45;
  }
}
.live-dot {
  opacity: 0.55;
  animation: blink 2.4s ease-in-out infinite;
}
.blink {
  animation: blink 0.9s steps(2) infinite;
}
.dead {
  transition: opacity 0.3s ease;
}
text {
  font-family: var(--font-mono);
  fill: #2a2a28;
  user-select: none;
}
.brand {
  font-family: var(--font-sans);
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  fill: #6b6b66;
}
.rating {
  font-size: 12px;
  font-weight: 600;
}
.small {
  font-size: 8px;
}
.tiny {
  font-size: 6.5px;
  fill: #55554f;
}
.test {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 700;
}
.seg {
  font-size: 18px;
  font-weight: 600;
  fill: #7cf29a;
  letter-spacing: 0.06em;
}
.seg-sm {
  font-size: 15px;
}
.seg.off {
  fill: #2f4f3a;
}
.busl {
  font-size: 14px;
  font-weight: 700;
  fill: #f4f4f1;
  paint-order: stroke;
  stroke: #333;
  stroke-width: 2px;
}
.issue {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 800;
  fill: white;
}
</style>
