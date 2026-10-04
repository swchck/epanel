<script setup lang="ts">
import { computed, ref } from 'vue'
import { CalendarCheck, Check, History } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DeviceChip from '@/components/common/DeviceChip.vue'
import { isoDay, type TaskStatus } from '@/domain/maintenance'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'

const data = useData()
const { t, tx } = useText()

const statuses = computed(() => [...data.maintenance].sort((a, b) => rank(a) - rank(b)))
function rank(s: TaskStatus) {
  return { overdue: 0, never: 1, soon: 2, ok: 3 }[s.state]
}
const log = computed(() => [...(data.data?.maintenance.log ?? [])].sort((a, b) => b.date.localeCompare(a.date)))
const taskTitle = (id: string) => tx(data.data?.maintenance.tasks.find((x) => x.id === id)?.title, id)

const STATE_TONE: Record<TaskStatus['state'], string> = {
  overdue: 'bg-danger/12 text-danger border-danger/30',
  never: 'bg-muted text-muted-foreground',
  soon: 'bg-warn/15 text-warn border-warn/30',
  ok: 'bg-ok/12 text-ok border-ok/30',
}

const marking = ref<TaskStatus | null>(null)
const date = ref(isoDay(new Date()))
const note = ref('')
const author = ref(localStorage.getItem('panel.author') ?? '')

function openMark(s: TaskStatus) {
  marking.value = s
  date.value = isoDay(new Date())
  note.value = ''
}

function save() {
  if (!marking.value) return
  const draft = data.startDraft()
  draft.data.maintenance.log.push({
    task: marking.value.task.id,
    date: date.value,
    note: note.value.trim() || undefined,
    author: author.value.trim() || undefined,
  })
  try {
    localStorage.setItem('panel.author', author.value.trim())
  } catch {
    // storage blocked
  }
  toast.success(t('maintenance.saved'), { description: t('device.noteDraftHint') })
  marking.value = null
}

function deviceOf(id: string) {
  return data.graph?.byId.get(id)
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 pt-5 lg:px-8 lg:pt-8">
    <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">{{ t('maintenance.title') }}</h1>
    <p class="mt-1 text-muted-foreground">{{ t('maintenance.subtitle') }}</p>

    <div class="mt-6 space-y-3">
      <article v-for="s in statuses" :key="s.task.id" class="rounded-2xl border bg-card p-5">
        <div class="flex flex-wrap items-start gap-3">
          <CalendarCheck class="mt-0.5 size-5 text-primary" />
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold">{{ tx(s.task.title) }}</h2>
            <p class="text-sm text-muted-foreground">
              {{ t('maintenance.every', { n: s.task.intervalDays }) }}
              <template v-if="s.last"> · {{ t('maintenance.last', { date: s.last.date }) }}</template>
            </p>
          </div>
          <span class="rounded-full border px-2.5 py-0.5 text-xs font-medium" :class="STATE_TONE[s.state]">
            {{
              s.state === 'overdue'
                ? t('maintenance.state.overdue', { n: s.overdueDays })
                : s.state === 'never'
                  ? t('maintenance.state.never')
                  : t(`maintenance.state.${s.state}`, { date: s.due })
            }}
          </span>
        </div>
        <p v-if="s.task.howTo" class="mt-3 text-sm">{{ tx(s.task.howTo) }}</p>
        <div v-if="s.task.devices.length" class="mt-3 flex flex-wrap gap-1.5">
          <template v-for="id in s.task.devices" :key="id">
            <RouterLink v-if="deviceOf(id)" :to="`/d/${id}`"><DeviceChip :device="deviceOf(id)!" size="sm" /></RouterLink>
          </template>
        </div>
        <div class="mt-4">
          <Button size="sm" :variant="s.state === 'overdue' ? 'default' : 'outline'" @click="openMark(s)"><Check /> {{ t('maintenance.markDone') }}</Button>
        </div>
      </article>
    </div>

    <section class="mt-8 mb-6">
      <h2 class="mb-3 flex items-center gap-2 font-semibold"><History class="size-4.5" /> {{ t('maintenance.journal') }}</h2>
      <ol v-if="log.length" class="relative space-y-4 border-l pl-5">
        <li v-for="(l, i) in log" :key="i" class="relative">
          <span class="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-primary ring-4 ring-background" />
          <div class="text-sm font-medium">{{ taskTitle(l.task) }}</div>
          <div class="text-xs text-muted-foreground">{{ l.date }}<template v-if="l.author"> · {{ l.author }}</template></div>
          <p v-if="l.note" class="mt-1 text-sm">{{ l.note }}</p>
        </li>
      </ol>
      <p v-else class="text-sm text-muted-foreground">{{ t('maintenance.empty') }}</p>
    </section>

    <Dialog :open="!!marking" @update:open="(v) => !v && (marking = null)">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ tx(marking?.task.title) }}</DialogTitle>
          <DialogDescription>{{ t('maintenance.markHint') }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5"><Label>{{ t('maintenance.date') }}</Label><Input v-model="date" type="date" /></div>
            <div class="space-y-1.5"><Label>{{ t('device.noteAuthor') }}</Label><Input v-model="author" /></div>
          </div>
          <div class="space-y-1.5"><Label>{{ t('maintenance.note') }}</Label><Input v-model="note" /></div>
        </div>
        <DialogFooter>
          <Button @click="save">{{ t('common.save') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
