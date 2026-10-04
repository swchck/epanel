<script setup lang="ts">
import { computed } from 'vue'
import { CircleAlert, Info, TriangleAlert } from '@lucide/vue'
import type { CheckResult } from '@/domain/checks'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'
import DeviceChip from './DeviceChip.vue'

const props = defineProps<{ check: CheckResult; compact?: boolean }>()
const { t, tx } = useText()
const data = useData()

const point = computed(() => data.data?.points.find((p) => p.id === props.check.point))
const device = computed(() => (props.check.device ? data.graph?.byId.get(props.check.device) : undefined))
const params = computed(() => ({
  ...props.check.params,
  point: point.value ? tx(point.value.label, t(`point.kind.${point.value.kind}`)) : '',
  device: props.check.device ?? '',
  profile: props.check.params.profile ? t(`point.profile.${props.check.params.profile}`) : '',
}))
const icon = computed(() => ({ error: CircleAlert, warn: TriangleAlert, info: Info })[props.check.level])
const tone = computed(
  () =>
    ({
      error: 'border-danger/35 bg-danger/8 [&_.ic]:text-danger',
      warn: 'border-warn/40 bg-warn/10 [&_.ic]:text-warn',
      info: 'border-info/30 bg-info/8 [&_.ic]:text-info',
    })[props.check.level],
)
</script>

<template>
  <div class="flex gap-3 rounded-xl border p-3" :class="tone">
    <component :is="icon" class="ic mt-0.5 size-4.5 shrink-0" />
    <div class="min-w-0 flex-1 space-y-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium">{{ t(`checks.code.${check.code}.title`, params) }}</span>
        <RouterLink v-if="device && !compact" :to="`/d/${device.id}`"><DeviceChip :device="device" size="sm" /></RouterLink>
      </div>
      <p class="text-sm text-muted-foreground">{{ t(`checks.code.${check.code}.hint`, params) }}</p>
    </div>
  </div>
</template>
