<script setup lang="ts">
import { ref } from 'vue'
import { FilePlus2, FlaskConical, FolderOpen, LoaderCircle, TriangleAlert } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import BrandMark from '@/components/common/BrandMark.vue'
import LangSwitch from '@/components/common/LangSwitch.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { useText } from '@/composables/useText'
import { isDesktop, openTextFile, type OpenedText } from '@/platform'
import { useData } from '@/stores/data'
import { useRouter } from 'vue-router'

const data = useData()
const router = useRouter()
const { t } = useText()
const mode = ref<'choose' | 'new' | 'password'>('choose')
const title = ref('')
const pw = ref('')
const pw2 = ref('')
const pending = ref<OpenedText | null>(null)
const busy = ref(false)
const err = ref('')

async function open() {
  const f = await openTextFile(['panel', 'json', 'yaml', 'yml'])
  if (!f) return
  busy.value = true
  const r = await data.loadText(f.text, { name: f.name, path: f.path })
  busy.value = false
  if (r.ok) return
  if (r.reason === 'needs-password') {
    pending.value = f
    pw.value = ''
    mode.value = 'password'
    return
  }
  toast.error(t('start.invalid'), { description: r.details?.slice(0, 3).join('\n') })
}

async function openWithPassword() {
  if (!pending.value) return
  busy.value = true
  const r = await data.loadText(pending.value.text, { name: pending.value.name, path: pending.value.path }, pw.value)
  busy.value = false
  if (!r.ok) err.value = t(r.reason === 'wrong-password' ? 'unlock.wrong' : 'start.invalid')
}

function create() {
  if (pw.value.length < 4 || pw.value !== pw2.value) {
    err.value = t('start.passwordMismatch')
    return
  }
  data.createNew(title.value || t('start.defaultTitle'), pw.value)
  router.push('/edit')
}
</script>

<template>
  <div class="relative grid min-h-dvh place-items-center bg-background px-4 py-10">
    <div class="absolute top-3 right-3 flex gap-1">
      <LangSwitch />
      <ThemeToggle />
    </div>
    <div class="w-full max-w-lg">
      <div class="mb-8 flex flex-col items-center gap-4 text-center">
        <BrandMark class="size-16" />
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">{{ isDesktop ? $t('start.titleDesktop') : $t('start.title') }}</h1>
          <p class="mt-1.5 text-sm text-balance text-muted-foreground">{{ $t('start.subtitle') }}</p>
        </div>
      </div>

      <div v-if="data.status === 'error'" class="mb-4 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
        <TriangleAlert class="size-4 shrink-0 text-destructive" />{{ data.error }}
      </div>

      <div v-if="mode === 'choose'" class="grid gap-3">
        <button class="start-card" :disabled="busy" @click="open">
          <FolderOpen class="size-6 text-primary" />
          <div>
            <div class="font-medium">{{ $t('start.open') }}</div>
            <div class="text-sm text-muted-foreground">{{ $t('start.openHint') }}</div>
          </div>
          <LoaderCircle v-if="busy" class="ml-auto size-4 animate-spin" />
        </button>
        <button class="start-card" @click="mode = 'new'; err = ''">
          <FilePlus2 class="size-6 text-primary" />
          <div>
            <div class="font-medium">{{ $t('start.create') }}</div>
            <div class="text-sm text-muted-foreground">{{ $t('start.createHint') }}</div>
          </div>
        </button>
        <button class="start-card" @click="data.init({ demo: true })">
          <FlaskConical class="size-6 text-primary" />
          <div>
            <div class="font-medium">{{ $t('start.demo') }}</div>
            <div class="text-sm text-muted-foreground">{{ $t('start.demoHint') }}</div>
          </div>
        </button>
      </div>

      <form v-else-if="mode === 'new'" class="space-y-4 rounded-2xl border bg-card p-5" @submit.prevent="create">
        <div class="space-y-2">
          <Label for="t">{{ $t('start.name') }}</Label>
          <Input id="t" v-model="title" :placeholder="$t('start.defaultTitle')" />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="p1">{{ $t('start.password') }}</Label>
            <Input id="p1" v-model="pw" type="password" autocomplete="new-password" />
          </div>
          <div class="space-y-2">
            <Label for="p2">{{ $t('start.passwordRepeat') }}</Label>
            <Input id="p2" v-model="pw2" type="password" autocomplete="new-password" />
          </div>
        </div>
        <p class="text-xs text-muted-foreground">{{ $t('start.passwordHint') }}</p>
        <p v-if="err" class="text-sm text-destructive">{{ err }}</p>
        <div class="flex justify-end gap-2">
          <Button type="button" variant="ghost" @click="mode = 'choose'">{{ $t('common.back') }}</Button>
          <Button type="submit">{{ $t('start.createSubmit') }}</Button>
        </div>
      </form>

      <form v-else class="space-y-4 rounded-2xl border bg-card p-5" @submit.prevent="openWithPassword">
        <p class="text-sm">{{ $t('start.encrypted', { name: pending?.name }) }}</p>
        <Input v-model="pw" type="password" autofocus :placeholder="$t('unlock.password')" />
        <p v-if="err" class="text-sm text-destructive">{{ err }}</p>
        <div class="flex justify-end gap-2">
          <Button type="button" variant="ghost" @click="mode = 'choose'">{{ $t('common.back') }}</Button>
          <Button type="submit" :disabled="busy">{{ $t('unlock.submit') }}</Button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
@reference "../style.css";
.start-card {
  @apply flex w-full items-center gap-4 rounded-2xl border bg-card p-5 text-left transition hover:border-primary/60 hover:shadow-sm disabled:opacity-60;
}
</style>
