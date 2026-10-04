import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw, watch } from 'vue'
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval'
import { runChecks } from '@/domain/checks'
import { decryptJson, encryptJson, isEnvelope, WrongPasswordError, type EncryptedEnvelope } from '@/domain/crypto'
import { buildGraph } from '@/domain/graph'
import { layoutPanel } from '@/domain/layout'
import { taskStatuses } from '@/domain/maintenance'
import { buildSearch } from '@/domain/lookup'
import { pruneAssets, referenceIssues, type Bundle, type PanelData } from '@/domain/model'
import { isDesktop } from '@/platform'

export type Status = 'idle' | 'loading' | 'locked' | 'ready' | 'empty' | 'error'
export type Source = 'published' | 'demo' | 'file' | 'new'

const KEY_STORAGE = 'panel.key'
const DRAFT_KEY = 'panel.draft'
const DEMO_PASSWORD = 'demo'

// zod and js-yaml come with this module; it loads while the panel downloads and decrypts
const parsing = () => import('@/domain/bundle')

function readStoredKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE)
  } catch {
    return null
  }
}

function writeStoredKey(v: string | null) {
  try {
    if (v === null) localStorage.removeItem(KEY_STORAGE)
    else localStorage.setItem(KEY_STORAGE, v)
  } catch {
    // private mode: the key just won't survive a reload
  }
}

async function idbSafe<T>(op: () => Promise<T>): Promise<T | undefined> {
  try {
    return await op()
  } catch {
    // IndexedDB is unavailable in some private modes: drafts then live only in memory
    return undefined
  }
}

function clone<T>(v: T): T {
  return structuredClone(toRaw(v))
}

function emptyBundle(title = ''): Bundle {
  return { format: 'panel-bundle', version: 1, data: emptyData(title), assets: {} }
}

function emptyData(title: string): PanelData {
  return {
    meta: { title, contacts: [] },
    supply: { phases: 1, voltage: 230, maxPowerKw: 10 },
    rows: [
      { id: 'r1', modules: 18, items: [] },
      { id: 'r2', modules: 18, items: [] },
    ],
    devices: [],
    rooms: [],
    plan: { width: 1200, height: 800, grid: 50, backgroundOpacity: 0.6, wallHeight: 270 },
    points: [],
    routes: [],
    photos: [],
    maintenance: {
      tasks: [
        { id: 'rcd-test', title: { ru: 'Нажать «Тест» на УЗО', en: 'Press TEST on RCDs', sr: 'Pritisnuti TEST na FID sklopkama', es: 'Pulsar TEST en los diferenciales' }, intervalDays: 30, devices: [] },
        { id: 'tighten', title: { ru: 'Протяжка клемм', en: 'Re-torque terminals', sr: 'Pritezanje klema', es: 'Reapriete de bornes' }, intervalDays: 365, devices: [] },
      ],
      log: [],
    },
    documents: [],
  }
}

export const useData = defineStore('data', () => {
  const status = ref<Status>('idle')
  const error = ref<string>()
  const source = ref<Source>('published')
  const envelope = shallowRef<EncryptedEnvelope | null>(null)
  const published = shallowRef<Bundle | null>(null)
  const draft = ref<Bundle | null>(null)
  // a fresh draft is a copy of the published data; it only counts once something in it changes
  const dirty = ref(false)
  const password = ref<string | null>(null)
  const file = ref<{ name: string; path?: string } | null>(null)
  const draftSavedAt = ref<number>()
  // an encrypted file opened from the OS that still needs its password
  const pendingFile = ref<{ name: string; path?: string; text: string } | null>(null)

  const active = computed<Bundle | null>(() => (draft.value as Bundle | null) ?? published.value)
  const data = computed<PanelData | null>(() => active.value?.data ?? null)
  const assets = computed<Record<string, string>>(() => active.value?.assets ?? {})
  const graph = computed(() => (data.value ? buildGraph(data.value) : null))
  const layout = computed(() => (data.value ? layoutPanel(data.value) : []))
  const checks = computed(() => (data.value && graph.value ? runChecks(data.value, graph.value) : []))
  const issues = computed(() => (data.value ? referenceIssues(data.value) : []))
  // fuse.js loads on the first search, not with the app
  const fuse = shallowRef<typeof import('fuse.js').default | null>(null)
  let fuseLoading = false
  const search = computed(() => {
    if (!data.value) return () => []
    if (!fuse.value) {
      if (!fuseLoading) {
        fuseLoading = true
        import('fuse.js').then((m) => (fuse.value = m.default))
      }
      return () => []
    }
    return buildSearch(data.value, fuse.value)
  })
  const hasDraft = computed(() => draft.value !== null && dirty.value)
  const maintenance = computed(() => (data.value ? taskStatuses(data.value.maintenance.tasks, data.value.maintenance.log) : []))
  const overdue = computed(() => maintenance.value.filter((m) => m.state === 'overdue').length)

  function dataUrl(name: string): string {
    return new URL(name, document.baseURI).toString()
  }

  async function fetchEnvelope(name: string): Promise<EncryptedEnvelope | null> {
    const res = await fetch(dataUrl(name), { cache: 'no-cache' })
    if (!res.ok) return null
    const json: unknown = await res.json()
    return isEnvelope(json) ? json : null
  }

  async function restoreDraft(pw: string) {
    const stored = await idbSafe(() => idbGet<EncryptedEnvelope>(DRAFT_KEY))
    if (!stored) return
    try {
      draft.value = await decryptJson<Bundle>(stored, pw)
      dirty.value = true
    } catch {
      // a draft encrypted with another password belongs to someone else on this device
    }
  }

  async function init(opts: { key?: string; demo?: boolean | string; prefix?: string } = {}) {
    void parsing()
    status.value = 'loading'
    error.value = undefined
    // a re-init (leaving the demo) must not carry the demo's draft over to the real panel
    cancelAutosave()
    published.value = null
    draft.value = null
    dirty.value = false
    password.value = null
    file.value = null
    try {
      if (opts.demo) {
        source.value = 'demo'
        const file = opts.demo === 'smart' ? 'demo-smart.panel' : 'demo.panel'
        envelope.value = await fetchEnvelope((opts.prefix ?? '') + file)
        if (!envelope.value) throw new Error(`${file} not found`)
        await unlock(DEMO_PASSWORD, false)
        return
      }
      source.value = 'published'
      if (isDesktop) {
        status.value = 'empty'
        return
      }
      envelope.value = await fetchEnvelope('panel.enc.json')
      if (!envelope.value) {
        status.value = 'empty'
        return
      }
      const candidate = opts.key ?? readStoredKey()
      if (candidate) {
        const ok = await unlock(candidate, true)
        if (ok) return
        if (opts.key) error.value = 'wrong-password'
        else {
          // the remembered password went stale, e.g. the site was republished with a new one
          writeStoredKey(null)
          error.value = undefined
        }
        return
      }
      status.value = 'locked'
    } catch (e) {
      status.value = 'error'
      error.value = (e as Error).message
    }
  }

  async function unlock(pw: string, remember: boolean): Promise<boolean> {
    if (!envelope.value) return false
    try {
      const raw = await decryptJson(envelope.value, pw)
      const parsed = (await parsing()).bundleFromUnknown(raw)
      if (parsed.kind !== 'bundle') throw new Error('invalid bundle')
      published.value = parsed.bundle
      password.value = pw
      if (remember && source.value === 'published') writeStoredKey(pw)
      if (source.value !== 'demo') await restoreDraft(pw)
      status.value = 'ready'
      error.value = undefined
      return true
    } catch (e) {
      status.value = 'locked'
      error.value = e instanceof WrongPasswordError ? 'wrong-password' : (e as Error).message
      return false
    }
  }

  function lock() {
    cancelAutosave()
    writeStoredKey(null)
    password.value = null
    published.value = null
    draft.value = null
    status.value = envelope.value ? 'locked' : 'empty'
  }

  function startDraft(): Bundle {
    if (!draft.value) {
      const base = published.value ?? emptyBundle()
      draft.value = clone(base)
      dirty.value = false
    }
    return draft.value as Bundle
  }

  async function discardDraft() {
    cancelAutosave()
    draft.value = null
    dirty.value = false
    await idbSafe(() => idbDel(DRAFT_KEY))
  }

  // the draft becomes the new baseline, e.g. after it was published or saved to a file
  async function commitDraft() {
    if (!draft.value) return
    published.value = clone(draft.value as Bundle)
    await discardDraft()
  }

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  // bumped on discard/lock so a save already past its timer can't write a dead draft back
  let saveGeneration = 0
  function cancelAutosave() {
    clearTimeout(saveTimer)
    saveGeneration++
  }

  // only the published panel is restored on the next visit; files and new panels are saved explicitly
  watch(
    draft,
    (b, prev) => {
      if (b && b === prev) dirty.value = true
      clearTimeout(saveTimer)
      if (!b || !dirty.value || !password.value || source.value !== 'published') return
      const pw = password.value
      const generation = saveGeneration
      saveTimer = setTimeout(async () => {
        // fewer PBKDF2 rounds than the published file: this runs on every edit and stays on the device
        const env = await encryptJson(clone(b), pw, 60_000)
        if (generation !== saveGeneration || draft.value !== b) return
        await idbSafe(() => idbSet(DRAFT_KEY, env))
        draftSavedAt.value = Date.now()
      }, 1200)
    },
    { deep: true },
  )

  async function exportEnvelope(pw = password.value): Promise<EncryptedEnvelope> {
    if (!pw) throw new Error('no password')
    const b = active.value
    if (!b) throw new Error('nothing to export')
    const issues = (await parsing()).validateData(b.data)
    if (issues.length) throw new Error(issues.slice(0, 5).map((i) => `${i.path}: ${i.message}`).join('\n'))
    return encryptJson(pruneAssets(clone(b)), pw)
  }

  function adoptBundle(b: Bundle, pw: string | null, src: Source, f: { name: string; path?: string } | null = null) {
    published.value = b
    draft.value = null
    dirty.value = false
    password.value = pw
    source.value = src
    file.value = f
    status.value = 'ready'
  }

  type LoadResult = { ok: true } | { ok: false; reason: 'needs-password' | 'wrong-password' | 'invalid'; details?: string[] }

  async function loadText(text: string, f: { name: string; path?: string }, pw?: string): Promise<LoadResult> {
    const { parseText, bundleFromUnknown } = await parsing()
    const parsed = await parseText(text)
    if (parsed.kind === 'invalid') return { ok: false, reason: 'invalid', details: parsed.issues.map((i) => `${i.path}: ${i.message}`) }
    if (parsed.kind === 'bundle') {
      adoptBundle(parsed.bundle, pw ?? password.value, 'file', f)
      return { ok: true }
    }
    if (!pw) return { ok: false, reason: 'needs-password' }
    try {
      const inner = bundleFromUnknown(await decryptJson(parsed.envelope, pw))
      if (inner.kind !== 'bundle') return { ok: false, reason: 'invalid' }
      envelope.value = parsed.envelope
      adoptBundle(inner.bundle, pw, 'file', f)
      return { ok: true }
    } catch {
      return { ok: false, reason: 'wrong-password' }
    }
  }

  // replaces the draft but keeps the session, so the owner can review an electrician's file before publishing it
  async function importIntoDraft(text: string, pw?: string): Promise<LoadResult> {
    const { parseText, bundleFromUnknown } = await parsing()
    const parsed = await parseText(text)
    if (parsed.kind === 'invalid') return { ok: false, reason: 'invalid', details: parsed.issues.map((i) => `${i.path}: ${i.message}`) }
    let bundle: Bundle
    if (parsed.kind === 'encrypted') {
      const tryPw = pw ?? password.value
      if (!tryPw) return { ok: false, reason: 'needs-password' }
      try {
        const inner = bundleFromUnknown(await decryptJson(parsed.envelope, tryPw))
        if (inner.kind !== 'bundle') return { ok: false, reason: 'invalid' }
        bundle = inner.bundle
      } catch {
        return { ok: false, reason: pw ? 'wrong-password' : 'needs-password' }
      }
    } else bundle = parsed.bundle
    draft.value = bundle
    dirty.value = true
    return { ok: true }
  }

  function createNew(title: string, pw: string) {
    adoptBundle(emptyBundle(title), pw, 'new', null)
    startDraft()
  }

  // the site keeps serving the old password until the next publish, so the remembered key stays as is
  function setPassword(pw: string) {
    password.value = pw
  }

  return {
    status,
    error,
    source,
    published,
    draft,
    password,
    file,
    draftSavedAt,
    pendingFile,
    active,
    data,
    assets,
    graph,
    layout,
    checks,
    issues,
    search,
    hasDraft,
    maintenance,
    overdue,
    init,
    unlock,
    lock,
    startDraft,
    discardDraft,
    commitDraft,
    exportEnvelope,
    loadText,
    importIntoDraft,
    createNew,
    setPassword,
  }
})
