<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, Network, Power } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import PanelEnclosure from '@/components/panel/PanelEnclosure.vue'
import { whatToSwitchOff } from '@/domain/lookup'
import type { PlanPoint } from '@/domain/schema'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'
import DeviceChip from './DeviceChip.vue'
import { POINT_ICONS } from './kinds'

const props = defineProps<{ point: PlanPoint }>()
const data = useData()
const { t, tx } = useText()

const answer = computed(() => (data.graph ? whatToSwitchOff(data.graph, data.layout, props.point) : undefined))
const channel = computed(() => answer.value?.controlledBy?.smart?.channels.find((c) => c.points.includes(props.point.id)))
const controls = computed(() =>
  props.point.controls.map((group) => {
    const targets: string[] = []
    for (const d of data.data?.devices ?? [])
      for (const ch of d.smart?.channels ?? [])
        if (ch.group === group) {
          const names = ch.points.map((pid) => data.data!.points.find((p) => p.id === pid)).filter(Boolean).map((p) => tx(p!.label, t(`point.kind.${p!.kind}`)))
          targets.push(...(names.length ? names : [`${d.id}.${ch.id}`]))
        }
    return { group, targets }
  }),
)
const room = computed(() => tx(data.data?.rooms.find((r) => r.id === props.point.room)?.name))
const facts = computed(() => {
  const p = props.point
  const out: string[] = []
  if (p.heightMm !== undefined) out.push(t('point.height', { mm: p.heightMm }))
  if (p.powerW) out.push(p.count > 1 ? `${p.count} × ${p.powerW} W` : `${p.powerW} W`)
  return out
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start gap-3">
      <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
        <component :is="POINT_ICONS[point.kind]" class="size-5" />
      </div>
      <div class="min-w-0">
        <div class="font-semibold leading-snug">{{ tx(point.label, t(`point.kind.${point.kind}`)) }}</div>
        <div class="text-sm text-muted-foreground">{{ [room, t(`point.kind.${point.kind}`), ...facts].filter(Boolean).join(' · ') }}</div>
      </div>
    </div>

    <div v-if="answer" class="overflow-hidden rounded-2xl border border-primary/40 bg-primary/8">
      <div class="flex items-center gap-3 p-4">
        <Power class="size-6 shrink-0 text-primary" />
        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ t('find.switchOff') }}</div>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <DeviceChip :device="answer.device" size="lg" />
            <span v-if="answer.place" class="text-sm font-medium">{{ t('device.place', { row: answer.place.rowIndex + 1, pos: answer.place.position }) }}</span>
          </div>
          <div class="mt-1 text-sm text-muted-foreground">{{ tx(answer.device.label) }}</div>
        </div>
      </div>
      <div v-if="answer.place" class="border-t border-primary/20 bg-background/60 p-2">
        <PanelEnclosure :interactive="false" :focus="answer.device.id" :only-row="answer.place.rowIndex" />
      </div>
    </div>
    <p v-else-if="point.kind !== 'panel' && point.kind !== 'sensor'" class="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{{ t('find.unknown') }}</p>

    <div v-if="answer?.controlledBy" class="flex gap-2.5 rounded-xl border border-green-600/30 bg-green-600/8 p-3 text-sm">
      <Network class="mt-0.5 size-4 shrink-0 text-green-600" />
      <div>
        {{ t('find.controlledBy') }}
        <RouterLink :to="`/d/${answer.controlledBy.id}`" class="inline-block align-middle"><DeviceChip :device="answer.controlledBy" size="sm" /></RouterLink>
        <span v-if="channel" class="font-mono text-xs"> · {{ t('smart.channel') }} {{ channel.id }}<template v-if="channel.group"> · {{ channel.group }}</template></span>
        <p class="mt-1 text-xs text-muted-foreground">{{ t('find.controlledByHint') }}</p>
      </div>
    </div>

    <div v-if="controls.length" class="space-y-1.5 rounded-xl border p-3">
      <div class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{{ t('smart.panelControls') }}</div>
      <div v-for="c in controls" :key="c.group" class="text-sm">
        <span class="font-mono text-xs text-green-700 dark:text-green-400">{{ c.group }}</span>
        <span class="text-muted-foreground"> → </span>
        <span v-if="c.targets.length">{{ c.targets.join(', ') }}</span>
        <span v-else class="text-xs text-warn">{{ t('smart.noOutput') }}</span>
      </div>
    </div>

    <div v-if="answer?.alternatives.length" class="text-sm">
      <span class="text-muted-foreground">{{ t('find.alsoCuts') }}</span>
      <span class="ml-1 inline-flex flex-wrap gap-1 align-middle">
        <RouterLink v-for="a in answer.alternatives" :key="a.id" :to="`/d/${a.id}`"><DeviceChip :device="a" size="sm" /></RouterLink>
      </span>
    </div>
    <Button v-if="answer" variant="outline" class="w-full" as-child>
      <RouterLink :to="`/d/${answer.device.id}`">{{ t('find.openInPanel') }} <ArrowRight /></RouterLink>
    </Button>
  </div>
</template>
