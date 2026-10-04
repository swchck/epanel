<script setup lang="ts">
import { computed } from 'vue'
import { History, Plus, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isoDay } from '@/domain/maintenance'
import type { MaintenanceLog } from '@/domain/model'
import { uniqueId } from '@/editor/ops'
import { useDraft } from '@/composables/useDraft'
import { useText } from '@/composables/useText'
import FormRow from './FormRow.vue'
import LocalizedInput from './LocalizedInput.vue'
import NumberInput from './NumberInput.vue'

const { d } = useDraft()
const { t } = useText()

function addTask() {
  d.value.maintenance.tasks.push({
    id: uniqueId(
      d.value.maintenance.tasks.map((x) => x.id),
      'task-',
    ),
    title: '',
    intervalDays: 30,
    devices: [],
  })
}

const logOf = (id: string) => d.value.maintenance.log.filter((l) => l.task === id).sort((a, b) => b.date.localeCompare(a.date))
const orphans = computed(() => d.value.maintenance.log.filter((l) => !d.value.maintenance.tasks.some((x) => x.id === l.task)))

function logDone(id: string) {
  d.value.maintenance.log.push({ task: id, date: isoDay(new Date()) })
}

function dropLog(l: MaintenanceLog) {
  d.value.maintenance.log.splice(d.value.maintenance.log.indexOf(l), 1)
}

// a task's log goes with it, otherwise the entries would linger as orphans nobody can attach anywhere
function removeTask(i: number) {
  const id = d.value.maintenance.tasks[i]!.id
  d.value.maintenance.tasks.splice(i, 1)
  d.value.maintenance.log = d.value.maintenance.log.filter((l) => l.task !== id)
}

function toggle(task: { devices: string[] }, id: string) {
  const i = task.devices.indexOf(id)
  if (i >= 0) task.devices.splice(i, 1)
  else task.devices.push(id)
}
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold">{{ t('editor.maintenance.tasks') }}</h3>
        <Button size="sm" variant="outline" @click="addTask"><Plus /> {{ t('common.add') }}</Button>
      </div>
      <div v-for="(task, i) in d.maintenance.tasks" :key="task.id" class="space-y-3 rounded-xl border bg-card p-4">
        <div class="grid items-end gap-3 sm:grid-cols-[1fr_9rem_auto]">
          <FormRow :label="t('editor.maintenance.title')"><LocalizedInput v-model="task.title" /></FormRow>
          <FormRow :label="t('editor.maintenance.interval')"><NumberInput v-model="task.intervalDays" integer :suffix="t('units.days')" /></FormRow>
          <Button variant="ghost" size="icon" :aria-label="t('common.delete')" @click="removeTask(i)"><Trash2 /></Button>
        </div>
        <FormRow :label="t('editor.maintenance.howTo')"><LocalizedInput v-model="task.howTo" multiline /></FormRow>
        <div>
          <div class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('editor.maintenance.devices') }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="dev in d.devices.filter((x) => x.type !== 'bus' && x.type !== 'terminal')"
              :key="dev.id"
              class="rounded-md border px-2 py-0.5 font-mono text-xs transition"
              :class="task.devices.includes(dev.id) ? 'border-primary bg-primary/15' : 'text-muted-foreground'"
              @click="toggle(task, dev.id)"
            >
              {{ dev.id }}
            </button>
          </div>
        </div>
        <div class="border-t pt-3">
          <div class="mb-1.5 flex items-center justify-between">
            <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><History class="size-3.5" /> {{ t('maintenance.journal') }}</span>
            <Button size="sm" variant="ghost" class="h-7" @click="logDone(task.id)"><Plus /> {{ t('editor.maintenance.logDone') }}</Button>
          </div>
          <div v-if="logOf(task.id).length" class="space-y-2">
            <div v-for="(l, li) in logOf(task.id)" :key="li" class="grid items-center gap-2 sm:grid-cols-[9rem_8rem_1fr_auto]">
              <Input v-model="l.date" type="date" />
              <Input :model-value="l.author ?? ''" :placeholder="t('device.noteAuthor')" @update:model-value="(v) => (l.author = String(v) || undefined)" />
              <Input :model-value="l.note ?? ''" :placeholder="t('maintenance.note')" @update:model-value="(v) => (l.note = String(v) || undefined)" />
              <Button variant="ghost" size="icon" :aria-label="t('common.delete')" @click="dropLog(l)"><Trash2 /></Button>
            </div>
          </div>
          <p v-else class="text-sm text-muted-foreground">{{ t('maintenance.empty') }}</p>
        </div>
      </div>
    </section>

    <section v-if="orphans.length">
      <h3 class="mb-3 font-semibold">{{ t('editor.maintenance.orphans') }}</h3>
      <div class="divide-y rounded-xl border bg-card">
        <div v-for="(l, i) in orphans" :key="i" class="grid items-center gap-2 p-3 sm:grid-cols-[10rem_9rem_8rem_1fr_auto]">
          <span class="truncate font-mono text-sm text-muted-foreground">{{ l.task }}</span>
          <Input v-model="l.date" type="date" />
          <Input :model-value="l.author ?? ''" :placeholder="t('device.noteAuthor')" @update:model-value="(v) => (l.author = String(v) || undefined)" />
          <Input :model-value="l.note ?? ''" :placeholder="t('maintenance.note')" @update:model-value="(v) => (l.note = String(v) || undefined)" />
          <Button variant="ghost" size="icon" :aria-label="t('common.delete')" @click="dropLog(l)"><Trash2 /></Button>
        </div>
      </div>
    </section>
  </div>
</template>
