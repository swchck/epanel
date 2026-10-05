<script setup lang="ts">
import { computed, ref, toRaw } from 'vue'
import { ChevronRight, CircleAlert, CloudUpload, Download, FileDown, FileUp, KeyRound, LoaderCircle, Save, Trash2, TriangleAlert } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { toJson, toYaml } from '@/domain/bundle'
import { pruneAssets, type Bundle } from '@/domain/model'
import { isoDay } from '@/domain/maintenance'
import { tr } from '@/domain/model'
import { emptyTarget, GithubError, loadTarget, publishFile, saveTarget } from '@/lib/github'
import { canSignIn, freshToken, SignInError } from '@/lib/githubAuth'
import { useDraft } from '@/composables/useDraft'
import { useText } from '@/composables/useText'
import { isDesktop, openTextFile, saveTextFile } from '@/platform'
import FormRow from './FormRow.vue'
import GithubConnect from './GithubConnect.vue'
import PasswordDialog from './PasswordDialog.vue'

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

// a panel opened from a plain YAML file or created from scratch has no password until its first encrypted export
const pwDialog = ref<'set' | 'change' | null>(null)
let pwWaiter: ((ok: boolean) => void) | null = null
function askPassword(): Promise<boolean> {
  pwDialog.value = 'set'
  return new Promise((resolve) => (pwWaiter = resolve))
}
function onPasswordSet(pw: string) {
  const changed = pwDialog.value === 'change'
  data.setPassword(pw)
  if (changed) toast.success(t('editor.publish.passwordChanged'), { description: t('editor.publish.passwordChangedHint') })
  pwWaiter?.(true)
  pwWaiter = null
}
function onPasswordDialog(open: boolean) {
  if (open) return
  pwDialog.value = null
  pwWaiter?.(false)
  pwWaiter = null
}

async function encrypted(): Promise<string | null> {
  if (!data.password && !(await askPassword())) return null
  stamp()
  return JSON.stringify(await data.exportEnvelope())
}

async function saveFile(saveAs: boolean) {
  busy.value = 'save'
  try {
    const text = await encrypted()
    if (!text) return
    const path = await saveTextFile(`${fileBase.value}.panel`, text, saveAs ? undefined : data.file?.path)
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
  const text = await encrypted()
  if (text) await saveTextFile('panel.enc.json', text)
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
const persistTarget = () => saveTarget(gh.value, rememberToken.value, data.password)
function onSignedIn() {
  rememberToken.value = true
  void persistTarget()
}

// the QR codes point at the site, so a freshly created one becomes the panel's address unless one is set
function onSite(url: string) {
  if (!d.value.meta.publicUrl) d.value.meta.publicUrl = url
}

const ghReady = computed(() => gh.value.owner && gh.value.repo && gh.value.branch && gh.value.path && gh.value.token)

async function publish() {
  busy.value = 'publish'
  try {
    const text = await encrypted()
    if (!text) return
    await freshToken(gh.value, persistTarget)
    await persistTarget()
    const { commitUrl } = await publishFile(gh.value, text, `Update panel data ${isoDay(new Date())}`)
    await data.commitDraft()
    toast.success(t('editor.publish.published'), {
      description: t('editor.publish.publishedHint'),
      action: { label: t('editor.publish.commit'), onClick: () => window.open(commitUrl, '_blank', 'noopener') },
    })
  } catch (e) {
    if (e instanceof SignInError && e.code === 'expired') {
      Object.assign(gh.value, { token: '', refreshToken: '', expiresAt: 0, refreshExpiresAt: 0 })
      return void toast.info(t('editor.github.sessionExpired'))
    }
    const status = e instanceof GithubError ? e.status : 0
    toast.error(t('editor.publish.failed'), {
      description: status === 401 || status === 403 ? t('editor.publish.badToken') : status === 404 ? t('editor.publish.notFound') : (e as Error).message,
    })
  } finally {
    busy.value = null
  }
}

</script>

<template>
  <div class="grid items-start gap-6 lg:grid-cols-2">
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

    <section data-tour="pub-file" class="space-y-4 rounded-2xl border bg-card p-5">
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
      <div class="space-y-2 border-t pt-4">
        <div class="text-sm font-medium">{{ t('editor.publish.plain') }}</div>
        <p class="flex gap-2 text-xs text-muted-foreground"><TriangleAlert class="size-3.5 shrink-0 text-warn" />{{ t('editor.publish.plainWarn') }}</p>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="downloadPlain('yaml')"><FileDown /> YAML</Button>
          <Button variant="outline" size="sm" @click="downloadPlain('json')"><FileDown /> JSON</Button>
        </div>
      </div>
    </section>

    <section data-tour="pub-site" class="space-y-4 rounded-2xl border bg-card p-5">
      <div>
        <h3 class="font-semibold">{{ t('editor.publish.siteTitle') }}</h3>
        <p class="text-sm text-muted-foreground">{{ t('editor.publish.siteHint') }}</p>
      </div>
      <template v-if="canSignIn">
        <GithubConnect v-model="gh" :persist="persistTarget" @signed-in="onSignedIn" @site="onSite" />
        <details class="group text-sm">
          <summary class="flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight class="size-4 transition-transform group-open:rotate-90" /> {{ t('editor.github.advanced') }}
          </summary>
          <div class="mt-3 grid grid-cols-2 gap-3">
            <FormRow :label="t('editor.publish.branch')"><Input v-model="gh.branch" /></FormRow>
            <FormRow :label="t('editor.publish.path')"><Input v-model="gh.path" class="font-mono text-xs" /></FormRow>
          </div>
        </details>
      </template>
      <div v-else class="grid grid-cols-2 gap-3">
        <FormRow :label="t('editor.publish.owner')"><Input v-model="gh.owner" placeholder="user" /></FormRow>
        <FormRow :label="t('editor.publish.repo')"><Input v-model="gh.repo" placeholder="panel" /></FormRow>
        <FormRow :label="t('editor.publish.branch')"><Input v-model="gh.branch" /></FormRow>
        <FormRow :label="t('editor.publish.path')"><Input v-model="gh.path" class="font-mono text-xs" /></FormRow>
        <FormRow :label="t('editor.publish.token')" :hint="t('editor.publish.tokenHint')" class="col-span-2">
          <Input v-model="gh.token" type="password" autocomplete="off" placeholder="github_pat_…" />
        </FormRow>
      </div>
      <label v-if="gh.token" class="flex items-center gap-2 text-sm"><Checkbox v-model="rememberToken" /> {{ t(canSignIn ? 'editor.github.remember' : 'editor.publish.rememberToken') }}</label>
      <div class="flex flex-wrap gap-2">
        <Button :disabled="!ghReady || !!busy" @click="publish">
          <LoaderCircle v-if="busy === 'publish'" class="animate-spin" /><CloudUpload v-else /> {{ t('editor.publish.publish') }}
        </Button>
        <Button variant="outline" @click="downloadPublishFile"><Download /> panel.enc.json</Button>
      </div>
      <p class="text-xs text-muted-foreground">{{ t('editor.publish.manual') }}</p>
    </section>

    <section data-tour="pub-password" class="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-5 lg:col-span-2">
      <KeyRound class="size-4.5 shrink-0" />
      <div class="mr-auto min-w-0">
        <h3 class="font-semibold">{{ t('editor.publish.passwordTitle') }}</h3>
        <p class="text-sm text-muted-foreground">{{ t(data.password ? 'editor.publish.passwordSet' : 'editor.publish.passwordLater') }}</p>
      </div>
      <Button v-if="data.password" variant="outline" @click="pwDialog = 'change'">{{ t('editor.publish.changePassword') }}</Button>
    </section>

    <PasswordDialog :open="!!pwDialog" :change="pwDialog === 'change'" @update:open="onPasswordDialog" @set="onPasswordSet" />
  </div>
</template>
