<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DEVICE_TYPES, SMART_TYPES, type Device } from '@/domain/schema'
import { renameDevice } from '@/editor/ops'
import { useDraft } from '@/composables/useDraft'
import { useText } from '@/composables/useText'
import { useUi } from '@/stores/ui'
import FormRow from './FormRow.vue'
import LocalizedInput from './LocalizedInput.vue'
import NumberInput from './NumberInput.vue'
import SmartForm from './SmartForm.vue'

const props = defineProps<{ id: string }>()
const { d } = useDraft()
// resolved from the draft instead of passed in, so the form edits the store directly
const device = computed(() => d.value.devices.find((x) => x.id === props.id)!)
const ui = useUi()
const { t, tx } = useText()

const idDraft = ref(device.value.id)
watch(
  () => device.value.id,
  (v) => (idDraft.value = v),
)

function commitId() {
  if (idDraft.value === device.value.id) return
  const old = device.value.id
  if (renameDevice(d.value, old, idDraft.value)) ui.select(idDraft.value.trim())
  else {
    toast.error(t('editor.panel.idTaken'))
    idDraft.value = old
  }
}

const isRcd = computed(() => device.value.type === 'rcd' || device.value.type === 'rcbo')
const hasCurve = computed(() => device.value.type === 'mcb' || device.value.type === 'rcbo')
const tagsText = computed({
  get: () => device.value.tags.join(', '),
  set: (v: string) => (device.value.tags = v.split(',').map((s) => s.trim()).filter(Boolean)),
})

// a device can't be fed by itself or by anything downstream of it
const upstreamOptions = computed(() => {
  const banned = new Set([device.value.id])
  let grew = true
  while (grew) {
    grew = false
    for (const x of d.value.devices) {
      if (x.upstream && banned.has(x.upstream) && !banned.has(x.id)) {
        banned.add(x.id)
        grew = true
      }
    }
  }
  return d.value.devices.filter((x) => !banned.has(x.id) && x.type !== 'bus' && x.type !== 'terminal')
})

function circuit() {
  if (!device.value.circuit) device.value.circuit = {}
  return device.value.circuit
}
</script>

<template>
  <div class="space-y-5">
    <div class="grid gap-3 sm:grid-cols-2">
      <FormRow :label="t('editor.panel.id')" :hint="t('editor.panel.idHint')">
        <Input v-model="idDraft" class="font-mono" @blur="commitId" @keydown.enter="commitId" />
      </FormRow>
      <FormRow :label="t('editor.panel.type')">
        <Select v-model="device.type">
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="tp in DEVICE_TYPES" :key="tp" :value="tp">{{ t(`device.type.${tp}`) }}</SelectItem>
          </SelectContent>
        </Select>
      </FormRow>
    </div>
    <FormRow :label="t('editor.panel.label')" :hint="t('editor.panel.labelHint')"><LocalizedInput v-model="device.label" /></FormRow>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <FormRow :label="t('device.field.rating')"><NumberInput v-model="device.rating" suffix="A" /></FormRow>
      <FormRow v-if="hasCurve" :label="t('editor.panel.curve')">
        <Select :model-value="device.curve ?? '__'" @update:model-value="(v) => (device.curve = v === '__' ? undefined : (v as Device['curve']))">
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__">—</SelectItem>
            <SelectItem v-for="c in ['B', 'C', 'D', 'K', 'Z']" :key="c" :value="c">{{ c }}</SelectItem>
          </SelectContent>
        </Select>
      </FormRow>
      <FormRow :label="t('device.field.poles')">
        <Select :model-value="String(device.poles)" @update:model-value="(v) => (device.poles = Number(v))">
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1P</SelectItem>
            <SelectItem value="2">1P+N / 2P</SelectItem>
            <SelectItem value="3">3P</SelectItem>
            <SelectItem value="4">3P+N / 4P</SelectItem>
          </SelectContent>
        </Select>
      </FormRow>
      <FormRow :label="t('editor.panel.width')" :hint="t('editor.panel.widthHint')"><NumberInput v-model="device.width" :placeholder="t('editor.auto')" /></FormRow>
    </div>

    <div v-if="isRcd" class="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
      <FormRow :label="t('device.field.leakage')"><NumberInput v-model="device.leakage" suffix="mA" /></FormRow>
      <FormRow :label="t('device.field.class')">
        <Select :model-value="device.rcdClass ?? '__'" @update:model-value="(v) => (device.rcdClass = v === '__' ? undefined : (v as Device['rcdClass']))">
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__">—</SelectItem>
            <SelectItem v-for="c in ['AC', 'A', 'F', 'B']" :key="c" :value="c">{{ c }}</SelectItem>
          </SelectContent>
        </Select>
      </FormRow>
      <label class="flex h-9 items-center gap-2 text-sm"><Switch :model-value="!!device.selective" @update:model-value="(v) => (device.selective = v || undefined)" /> {{ t('editor.panel.selective') }}</label>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <FormRow :label="t('editor.panel.upstream')" :hint="t('editor.panel.upstreamHint')">
        <Select :model-value="device.upstream ?? '__'" @update:model-value="(v) => (device.upstream = v === '__' ? undefined : (v as string))">
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__">{{ t('editor.panel.noUpstream') }}</SelectItem>
            <SelectItem v-for="u in upstreamOptions" :key="u.id" :value="u.id">{{ u.id }} · {{ tx(u.label) || t(`device.type.${u.type}`) }}</SelectItem>
          </SelectContent>
        </Select>
      </FormRow>
      <FormRow v-if="d.supply.phases === 3" :label="t('device.field.phase')">
        <Select :model-value="device.phase ?? '__'" @update:model-value="(v) => (device.phase = v === '__' ? undefined : (v as Device['phase']))">
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__">—</SelectItem>
            <SelectItem v-for="p in ['L1', 'L2', 'L3', 'L1L2L3']" :key="p" :value="p">{{ p }}</SelectItem>
          </SelectContent>
        </Select>
      </FormRow>
    </div>

    <SmartForm v-if="SMART_TYPES.includes(device.type) || device.smart" :id="device.id" />

    <fieldset class="space-y-3 rounded-xl border p-3">
      <legend class="px-1 text-xs font-semibold text-muted-foreground">{{ t('editor.panel.circuit') }}</legend>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FormRow :label="t('device.field.cable')" class="col-span-2 sm:col-span-1"><Input :model-value="device.circuit?.cable ?? ''" placeholder="ВВГнг(А)-LS 3×2.5" @update:model-value="(v) => (circuit().cable = String(v) || undefined)" /></FormRow>
        <FormRow :label="t('device.field.section')">
          <Select :model-value="device.circuit?.crossSection ? String(device.circuit.crossSection) : '__'" @update:model-value="(v) => (circuit().crossSection = v === '__' ? undefined : Number(v))">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__">—</SelectItem>
              <SelectItem v-for="s in [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35]" :key="s" :value="String(s)">{{ s }} {{ t('units.mm2') }}</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
        <FormRow :label="t('device.field.length')"><NumberInput :model-value="device.circuit?.lengthM" :suffix="t('units.m')" @update:model-value="(v) => (circuit().lengthM = v)" /></FormRow>
      </div>
    </fieldset>

    <div class="grid gap-3 sm:grid-cols-2">
      <FormRow :label="t('editor.panel.brand')"><Input :model-value="device.brand ?? ''" @update:model-value="(v) => (device.brand = String(v) || undefined)" /></FormRow>
      <FormRow :label="t('editor.panel.model')"><Input :model-value="device.model ?? ''" @update:model-value="(v) => (device.model = String(v) || undefined)" /></FormRow>
    </div>
    <FormRow :label="t('editor.panel.tags')" :hint="t('editor.panel.tagsHint')"><Input v-model="tagsText" /></FormRow>

    <div>
      <div class="mb-2 text-xs font-medium text-muted-foreground">{{ t('device.notes') }}</div>
      <div class="space-y-2">
        <div v-for="(n, i) in device.notes" :key="i" class="space-y-2 rounded-xl border p-3">
          <div class="flex gap-2">
            <Input v-model="n.author" :placeholder="t('device.noteAuthor')" class="flex-1" />
            <Input v-model="n.date" type="date" class="w-40" />
            <Button variant="ghost" size="icon" :aria-label="t('common.delete')" @click="device.notes.splice(i, 1)"><Trash2 /></Button>
          </div>
          <Textarea v-model="n.text" rows="2" />
        </div>
        <Button variant="outline" size="sm" @click="device.notes.push({ author: '', date: new Date().toISOString().slice(0, 10), text: '' })">{{ t('device.addNote') }}</Button>
      </div>
    </div>
  </div>
</template>
