<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { Plus, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BUS_SYSTEMS, CHANNEL_FUNCTIONS } from '@/domain/schema'
import { useDraft } from '@/composables/useDraft'
import { useText } from '@/composables/useText'
import FormRow from './FormRow.vue'

const props = defineProps<{ id: string }>()
const { d } = useDraft()
const { t, tx } = useText()

const device = computed(() => d.value.devices.find((x) => x.id === props.id)!)
watchEffect(() => {
  if (device.value && !device.value.smart) device.value.smart = { system: 'knx', channels: [] }
})
const smart = computed(() => device.value.smart ?? { system: 'knx' as const, channels: [] })

// points fed by this device are the natural candidates for its channels
const candidates = computed(() => d.value.points.filter((p) => p.device === device.value.id || !p.device))

function addChannel() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const id = letters[smart.value.channels.length] ?? String(smart.value.channels.length + 1)
  smart.value.channels.push({ id, function: 'switch', points: [] })
}

function togglePoint(chIndex: number, pid: string) {
  const ch = smart.value.channels[chIndex]!
  const i = ch.points.indexOf(pid)
  if (i >= 0) ch.points.splice(i, 1)
  else {
    ch.points.push(pid)
    const p = d.value.points.find((x) => x.id === pid)
    if (p && !p.device) p.device = device.value.id
  }
}
</script>

<template>
  <fieldset class="space-y-3 rounded-xl border border-green-600/30 p-3">
    <legend class="px-1 text-xs font-semibold text-muted-foreground">{{ t('editor.smart.title') }}</legend>
    <div class="grid grid-cols-2 gap-3">
      <FormRow :label="t('editor.smart.system')">
        <Select v-model="smart.system">
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem v-for="s in BUS_SYSTEMS" :key="s" :value="s">{{ t(`smart.system.${s}`) }}</SelectItem></SelectContent>
        </Select>
      </FormRow>
      <FormRow :label="t('editor.smart.address')" :hint="t('editor.smart.addressHint')">
        <Input :model-value="smart.address ?? ''" class="font-mono" placeholder="1.1.5" @update:model-value="(v) => (smart.address = String(v) || undefined)" />
      </FormRow>
    </div>
    <div v-if="device.type === 'actuator' || device.type === 'bus-io'" class="space-y-2">
      <div v-for="(ch, i) in smart.channels" :key="i" class="grid grid-cols-[3rem_1fr_6rem_auto] items-center gap-2">
        <Input v-model="ch.id" class="px-2 text-center font-mono" />
        <Select v-model="ch.function">
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem v-for="f in CHANNEL_FUNCTIONS" :key="f" :value="f">{{ t(`smart.fn.${f}`) }}</SelectItem></SelectContent>
        </Select>
        <Input :model-value="ch.group ?? ''" class="px-2 font-mono text-xs" placeholder="1/1/1" @update:model-value="(v) => (ch.group = String(v) || undefined)" />
        <div class="flex">
          <Popover>
            <PopoverTrigger as-child>
              <Button variant="outline" size="sm" class="font-mono text-xs">{{ ch.points.length }}</Button>
            </PopoverTrigger>
            <PopoverContent class="max-h-72 w-72 overflow-y-auto p-1">
              <label v-for="p in candidates" :key="p.id" class="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                <input type="checkbox" class="accent-primary" :checked="ch.points.includes(p.id)" @change="togglePoint(i, p.id)" />
                {{ tx(p.label, t(`point.kind.${p.kind}`)) }}
              </label>
              <p v-if="!candidates.length" class="p-2 text-xs text-muted-foreground">{{ t('editor.smart.noPoints') }}</p>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon-sm" :aria-label="t('common.delete')" @click="smart.channels.splice(i, 1)"><Trash2 /></Button>
        </div>
      </div>
      <Button variant="outline" size="sm" @click="addChannel"><Plus /> {{ t('editor.smart.addChannel') }}</Button>
      <p class="text-[11px] text-muted-foreground">{{ t('editor.smart.channelsHint') }}</p>
    </div>
  </fieldset>
</template>
