<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check, CircleUserRound, Copy, ExternalLink, LoaderCircle, LogIn, LogOut, Plus } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GithubError, type GithubTarget } from '@/lib/github'
import { branchExists, createSite, dataPath, currentUser, freshToken, listRepos, siteUrl, SignInError, startDeviceFlow, templateRepo, waitForToken, type DeviceCode, type Repo } from '@/lib/githubAuth'
import { useText } from '@/composables/useText'
import { openExternal } from '@/platform'
import FormRow from './FormRow.vue'

const target = defineModel<GithubTarget>({ required: true })
// saves the target after a token refresh; GitHub rotates the refresh token, so this must not be skipped
const props = defineProps<{ persist: () => Promise<void> }>()
const emit = defineEmits<{ signedIn: []; site: [url: string] }>()
const { t } = useText()

const login = ref<string | null>(null)
const repos = ref<Repo[]>([])
const loading = ref(false)
const NEW = '__new'
const choice = ref('')
const newName = ref('panel')
const creating = ref(false)

const code = ref<DeviceCode | null>(null)
const copied = ref(false)
let abort: AbortController | null = null

const token = () => freshToken(target.value, props.persist)

// an expired session drops the tokens and puts the sign-in button back instead of failing every call
function onAuthError(e: unknown): boolean {
  const expired = (e instanceof SignInError && e.code === 'expired') || (e instanceof GithubError && e.status === 401)
  if (!expired) return false
  signOut()
  toast.info(t('editor.github.sessionExpired'))
  return true
}

async function loadAccount() {
  if (!target.value.token) return
  loading.value = true
  try {
    const tok = await token()
    login.value = await currentUser(tok)
    repos.value = await listRepos(tok)
    const saved = repos.value.find((r) => r.owner === target.value.owner && r.name === target.value.repo)
    if (saved) {
      choice.value = `${saved.owner}/${saved.name}`
      // a saved branch can be gone (or was never real, see createSite); fall back to the default one
      if (!(await branchExists(tok, saved.owner, saved.name, target.value.branch))) {
        target.value.branch = saved.defaultBranch
        await props.persist()
      }
    }
  } catch (e) {
    if (!onAuthError(e)) toast.error(t('editor.github.failed'), { description: (e as Error).message })
  } finally {
    loading.value = false
  }
}
watch(() => target.value.token, (tok, old) => tok && tok !== old && loadAccount(), { immediate: true })

async function signIn() {
  try {
    code.value = await startDeviceFlow()
  } catch (e) {
    toast.error(t('editor.github.failed'), { description: (e as Error).message })
    return
  }
  abort = new AbortController()
  try {
    Object.assign(target.value, await waitForToken(code.value, abort.signal))
    code.value = null
    emit('signedIn')
  } catch (e) {
    const reason = e instanceof SignInError ? e.code : 'failed'
    if (reason !== 'cancelled') toast.error(t(`editor.github.error.${reason}`))
    code.value = null
  }
}

async function copyAndOpen() {
  if (!code.value) return
  try {
    await navigator.clipboard.writeText(code.value.userCode)
    copied.value = true
  } catch {
    // clipboard blocked: the code stays on screen to type by hand
  }
  void openExternal(code.value.verificationUri)
}

function cancelSignIn(open: boolean) {
  if (open) return
  abort?.abort()
  code.value = null
  copied.value = false
}
onBeforeUnmount(() => abort?.abort())

function signOut() {
  Object.assign(target.value, { token: '', refreshToken: '', expiresAt: 0, refreshExpiresAt: 0 })
  void props.persist()
  login.value = null
  repos.value = []
  choice.value = ''
}

async function pick(value: string) {
  choice.value = value
  if (value === NEW) return
  const r = repos.value.find((x) => `${x.owner}/${x.name}` === value)
  if (!r) return
  target.value.owner = r.owner
  target.value.repo = r.name
  target.value.branch = r.defaultBranch
  try {
    target.value.path = await dataPath(await token(), r.owner, r.name, r.defaultBranch)
  } catch (e) {
    if (!onAuthError(e)) toast.error(t('editor.github.failed'), { description: (e as Error).message })
  }
}

async function create() {
  if (!login.value || !newName.value.trim()) return
  creating.value = true
  try {
    const r = await createSite(await token(), login.value, newName.value.trim())
    repos.value = [r, ...repos.value]
    await pick(`${r.owner}/${r.name}`)
    emit('site', siteUrl(r.owner, r.name))
    toast.success(t('editor.github.created'), { description: t('editor.github.createdHint') })
  } catch (e) {
    if (onAuthError(e)) return
    const status = e instanceof GithubError ? e.status : 0
    toast.error(t('editor.github.createFailed'), { description: status === 422 ? t('editor.github.nameTaken') : status === 404 ? t('editor.github.noTemplate', { repo: templateRepo() ?? '—' }) : (e as Error).message })
  } finally {
    creating.value = false
  }
}

const ready = computed(() => !!login.value)
</script>

<template>
  <div class="space-y-3">
    <div v-if="!target.token" class="space-y-3">
      <p class="text-sm text-muted-foreground">{{ t('editor.github.intro') }}</p>
      <Button @click="signIn"><LogIn /> {{ t('editor.github.signIn') }}</Button>
    </div>

    <template v-else>
      <div class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
        <CircleUserRound class="size-4" />
        <LoaderCircle v-if="loading && !ready" class="size-4 animate-spin" />
        <span v-else class="mr-auto">{{ t('editor.github.signedInAs') }} <b>@{{ login }}</b></span>
        <Button variant="ghost" size="sm" class="h-7" @click="signOut"><LogOut /> {{ t('editor.github.signOut') }}</Button>
      </div>
      <FormRow v-if="ready" :label="t('editor.github.site')">
        <Select :model-value="choice" @update:model-value="(v) => void pick(String(v))">
          <SelectTrigger class="w-full"><SelectValue :placeholder="t('editor.github.pickRepo')" /></SelectTrigger>
          <SelectContent>
            <SelectItem :value="NEW"><Plus class="size-4" /> {{ t('editor.github.newSite') }}</SelectItem>
            <SelectItem v-for="r in repos" :key="r.name" :value="`${r.owner}/${r.name}`">{{ r.owner }}/{{ r.name }}</SelectItem>
          </SelectContent>
        </Select>
      </FormRow>
      <form v-if="choice === NEW" class="flex items-end gap-2" @submit.prevent="create">
        <FormRow :label="t('editor.github.newName')" :hint="newName ? siteUrl(login ?? 'user', newName) : undefined" class="flex-1">
          <Input v-model="newName" class="font-mono" />
        </FormRow>
        <Button type="submit" :disabled="creating || !newName.trim()" class="mb-5">
          <LoaderCircle v-if="creating" class="animate-spin" /><Plus v-else /> {{ t('editor.github.create') }}
        </Button>
      </form>
    </template>

    <Dialog :open="!!code" @update:open="cancelSignIn">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('editor.github.codeTitle') }}</DialogTitle>
          <DialogDescription>{{ t('editor.github.codeHint') }}</DialogDescription>
        </DialogHeader>
        <div class="rounded-xl border bg-muted/50 py-4 text-center font-mono text-3xl font-semibold tracking-[0.2em] select-all">{{ code?.userCode }}</div>
        <Button class="w-full" @click="copyAndOpen">
          <component :is="copied ? Check : Copy" /> {{ t('editor.github.copyOpen') }} <ExternalLink class="ml-auto" />
        </Button>
        <p class="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle class="size-4 animate-spin" /> {{ t('editor.github.waiting') }}</p>
        <DialogFooter>
          <Button variant="ghost" @click="cancelSignIn(false)">{{ t('common.cancel') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
