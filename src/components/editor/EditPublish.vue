<script setup lang="ts">
import { MIN_PASSWORD_LENGTH } from '@/domain/crypto'
import { computed, ref, toRaw } from 'vue'
import { CircleAlert, CloudUpload, Download, FileDown, FileUp, KeyRound, LoaderCircle, Save, Trash2, TriangleAlert } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { toJson, toYaml } from '@/domain/bundle'
import { pruneAssets, type Bundle } from '@/domain/model'
import { isoDay } from '@/domain/maintenance'
import { tr } from '@/domain/model'
import { emptyTarget, GithubError, loadTarget, publishFile, saveTarget } from '@/lib/github'
import { useDraft } from '@/composables/useDraft'
import { useText } from '@/composables/useText'
import { isDesktop, openTextFile, saveTextFile } from '@/platform'
import FormRow from './FormRow.vue'

const { d, data } = useDraft()
const { t, locale } = useText()
const busy = ref<string | null>(null)

const fileBase = computed(() => {
  const title = tr(d.value.meta.title, locale.value, 'panel')
  return (
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'panel'
  )
})

const savedAgo = computed(() => (data.draftSavedAt ? new Date(data.draftSavedAt).toLocaleTimeString(locale.value) : null))
const errors = computed(() => data.checks.filter((c) => c.level === 'error').length)

function stamp() {
  d.value.meta.updated = isoDay(new Date())
}

async function encrypted(): Promise<string> {
  stamp()
  return JSON.stringify(await data.exportEnvelope())
}

async function saveFile(saveAs: boolean) {
  busy.value = 'save'
  try {
    const path = await saveTextFile(`${fileBase.value}.panel`, await encrypted(), saveAs ? undefined : data.file?.path)
    if (!path) return
    if (isDesktop) data.file = { name: path.split(/[\\/]/).pop() ?? path, path }
    await data.commitDraft()
    toast.success(t('editor.publish.saved'), { description: path })
  } finally {
    busy.value = null
  }
}

async function downloadPlain(kind: 'yaml' | 'json') {
  stamp()
  const b = pruneAssets(structuredClone(toRaw(data.draft)) as Bundle)
  await saveTextFile(`${fileBase.value}.${kind}`, kind === 'yaml' ? await toYaml(b) : toJson(b))
}

async function downloadPublishFile() {
  await saveTextFile('panel.enc.json', await encrypted())
}

// importing someone else's file (the electrician's) replaces the draft, never the published copy
const importPw = ref('')
const pendingImport = ref<string | null>(null)
async function importFile() {
  const f = await openTextFile(['panel', 'json', 'yaml', 'yml'])
  if (!f) return
  await runImport(f.text)
}
async function runImport(text: string, pw?: string) {
  const r = await data.importIntoDraft(text, pw)
  if (r.ok) {
    pendingImport.value = null
    toast.success(t('editor.publish.imported'))
  } else if (r.reason === 'needs-password' || r.reason === 'wrong-password') {
    pendingImport.value = text
    if (r.reason === 'wrong-password') toast.error(t('unlock.wrong'))
  } else toast.error(t('start.invalid'), { description: r.details?.slice(0, 3).join('\n') })
}

const gh = ref(emptyTarget())
const rememberToken = ref(false)
loadTarget(data.password).then((target) => {
  gh.value = target
  rememberToken.value = !!target.token
})
const ghReady = computed(() => gh.value.owner && gh.value.repo && gh.value.branch && gh.value.path && gh.value.token)

async function publish() {
  busy.value = 'publish'
  try {
    await saveTarget(gh.value, rememberToken.value, data.password)
    const { commitUrl } = await publishFile(gh.value, await encrypted(), `Update panel data ${isoDay(new Date())}`)
    await data.commitDraft()
    toast.success(t('editor.publish.published'), {
      description: t('editor.publish.publishedHint'),
      action: { label: t('editor.publish.commit'), onClick: () => window.open(commitUrl, '_blank', 'noopener') },
    })
  } catch (e) {
    const status = e instanceof GithubError ? e.status : 0
    toast.error(t('editor.publish.failed'), {
      description: status === 401 || status === 403 ? t('editor.publish.badToken') : status === 404 ? t('editor.publish.notFound') : (e as Error).message,
    })
  } finally {
    busy.value = null
  }
}

const pw1 = ref('')
const pw2 = ref('')
function changePassword() {
  if (pw1.value.length < MIN_PASSWORD_LENGTH || pw1.value !== pw2.value) {
    toast.error(t('start.passwordMismatch'))
    return
  }
  data.setPassword(pw1.value)
  pw1.value = pw2.value = ''
  toast.success(t('editor.publish.passwordChanged'), { description: t('editor.publish.passwordChangedHint') })
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-2">
    <section class="space-y-3 rounded-2xl border bg-card p-5 lg:col-span-2">
      <div class="flex flex-wrap items-center gap-3">
        <div class="mr-auto">
          <h3 class="font-semibold">{{ t('editor.publish.status') }}</h3>
          <p class="text-sm text-muted-foreground">
            {{ data.hasDraft ? t('editor.publish.draftLocal') : t('editor.publish.noChanges') }}
            <template v-if="savedAgo"> · {{ t('editor.publish.savedAt', { time: savedAgo }) }}</template>
          </p>
        </div>
        <Button v-if="data.hasDraft && data.published" variant="ghost" size="sm" @click="data.discardDraft()"><Trash2 /> {{ t('settings.discard') }}</Button>
      </div>
      <div v-if="data.issues.length" class="space-y-1 rounded-xl border border-danger/40 bg-danger/8 p-3 text-sm">
        <div class="flex items-center gap-2 font-medium"><CircleAlert class="size-4 text-danger" /> {{ t('editor.publish.refIssues') }}</div>
        <div v-for="(i, k) in data.issues.slice(0, 6)" :key="k" class="font-mono text-xs">{{ i.path }}: {{ i.message }}</div>
      </div>
      <p v-if="errors" class="flex items-center gap-2 text-sm text-warn"><TriangleAlert class="size-4" /> {{ t('editor.publish.checkErrors', { n: errors }) }}</p>
    </section>

    <section class="space-y-4 rounded-2xl border bg-card p-5">
      <div>
        <h3 class="font-semibold">{{ t('editor.publish.fileTitle') }}</h3>
        <p class="text-sm text-muted-foreground">{{ t('editor.publish.fileHint') }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <template v-if="isDesktop">
          <Button :disabled="!!busy" @click="saveFile(false)"><Save /> {{ data.file?.path ? t('editor.publish.save') : t('editor.publish.saveAs') }}</Button>
          <Button v-if="data.file?.path" variant="outline" :disabled="!!busy" @click="saveFile(true)">{{ t('editor.publish.saveAs') }}</Button>
        </template>
        <Button v-else :disabled="!!busy" @click="saveFile(true)"><Download /> {{ t('editor.publish.downloadPanel') }}</Button>
        <Button variant="outline" @click="importFile"><FileUp /> {{ t('editor.publish.import') }}</Button>
      </div>
      <form v-if="pendingImport" class="flex gap-2" @submit.prevent="runImport(pendingImport!, importPw)">
        <Input v-model="importPw" type="password" :placeholder="t('editor.publish.importPassword')" autofocus />
        <Button type="submit">{{ t('unlock.submit') }}</Button>
      </form>
      <details class="text-sm">
        <summary class="cursor-pointer text-muted-foreground">{{ t('editor.publish.plain') }}</summary>
        <p class="my-2 flex gap-2 text-xs text-warn"><TriangleAlert class="size-4 shrink-0" />{{ t('editor.publish.plainWarn') }}</p>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="downloadPlain('yaml')"><FileDown /> YAML</Button>
          <Button variant="outline" size="sm" @click="downloadPlain('json')"><FileDown /> JSON</Button>
        </div>
      </details>
    </section>

    <section class="space-y-4 rounded-2xl border bg-card p-5">
      <div>
        <h3 class="font-semibold">{{ t('editor.publish.siteTitle') }}</h3>
        <p class="text-sm text-muted-foreground">{{ t('editor.publish.siteHint') }}</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <FormRow :label="t('editor.publish.owner')"><Input v-model="gh.owner" placeholder="user" /></FormRow>
        <FormRow :label="t('editor.publish.repo')"><Input v-model="gh.repo" placeholder="panel" /></FormRow>
        <FormRow :label="t('editor.publish.branch')"><Input v-model="gh.branch" /></FormRow>
        <FormRow :label="t('editor.publish.path')"><Input v-model="gh.path" class="font-mono text-xs" /></FormRow>
        <FormRow :label="t('editor.publish.token')" :hint="t('editor.publish.tokenHint')" class="col-span-2">
          <Input v-model="gh.token" type="password" autocomplete="off" placeholder="github_pat_…" />
        </FormRow>
      </div>
      <label class="flex items-center gap-2 text-sm"><Checkbox v-model="rememberToken" /> {{ t('editor.publish.rememberToken') }}</label>
      <div class="flex flex-wrap gap-2">
        <Button :disabled="!ghReady || !!busy" @click="publish">
          <LoaderCircle v-if="busy === 'publish'" class="animate-spin" /><CloudUpload v-else /> {{ t('editor.publish.publish') }}
        </Button>
        <Button variant="outline" @click="downloadPublishFile"><Download /> panel.enc.json</Button>
      </div>
      <p class="text-xs text-muted-foreground">{{ t('editor.publish.manual') }}</p>
    </section>

    <section class="space-y-3 rounded-2xl border bg-card p-5 lg:col-span-2">
      <h3 class="flex items-center gap-2 font-semibold"><KeyRound class="size-4.5" /> {{ t('editor.publish.passwordTitle') }}</h3>
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="changePassword">
        <FormRow :label="t('start.password')" class="w-56"><Input v-model="pw1" type="password" autocomplete="new-password" /></FormRow>
        <FormRow :label="t('start.passwordRepeat')" class="w-56"><Input v-model="pw2" type="password" autocomplete="new-password" /></FormRow>
        <Button type="submit" variant="outline">{{ t('editor.publish.changePassword') }}</Button>
      </form>
      <p class="text-xs text-muted-foreground">{{ t('editor.publish.passwordHint') }}</p>
    </section>
  </div>
</template>
