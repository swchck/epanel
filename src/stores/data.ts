import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw, watch } from 'vue'
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval'
import { makeBundle, parseText, pruneAssets, type Bundle } from '@/domain/bundle'
import { runChecks } from '@/domain/checks'
import { decryptJson, encryptJson, isEnvelope, WrongPasswordError, type EncryptedEnvelope } from '@/domain/crypto'
import { buildGraph } from '@/domain/graph'
import { layoutPanel } from '@/domain/layout'
import { taskStatuses } from '@/domain/maintenance'
import { buildSearch } from '@/domain/lookup'
import { referenceIssues, type PanelData, type PanelInput } from '@/domain/schema'
import { isDesktop } from '@/platform'

export type Status = 'idle' | 'loading' | 'locked' | 'ready' | 'empty' | 'error'
export type Source = 'published' | 'demo' | 'file' | 'new'

const KEY_STORAGE = 'panel.key'
const DRAFT_KEY = 'panel.draft'
const DEMO_PASSWORD = 'demo'

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

function clone<T>(v: T): T {
  return structuredClone(toRaw(v))
}

function emptyData(title = ''): PanelInput {
  return {
    meta: { title, contacts: [] },
    supply: { phases: 1, voltage: 230, maxPowerKw: 10 },
    rows: [
      { id: 'r1', modules: 18, items: [] },
      { id: 'r2', modules: 18, items: [] },
    ],
    devices: [],
    rooms: [],
    plan: { width: 1200, height: 800, grid: 50, backgroundOpacity: 0.6 },
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
  const search = computed(() => (data.value ? buildSearch(data.value) : () => []))
  const hasDraft = computed(() => draft.value !== null)
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
    const stored = await idbGet<EncryptedEnvelope>(DRAFT_KEY)
    if (!stored) return
    try {
      const b = await decryptJson<Bundle>(stored, pw)
      draft.value = b
    } catch {
      // a draft encrypted with another password belongs to someone else on this device
    }
  }

  async function init(opts: { key?: string; demo?: boolean | string; prefix?: string } = {}) {
    status.value = 'loading'
    error.value = undefined
    try {
      if (opts.demo) {
        source.value = 'demo'
        const file = opts.demo === 'smart' ? 'demo-smart.panel' : 'demo.panel'
        envelope.value = await fetchEnvelope((opts.prefix ?? '') + file)
        if (!envelope.value) throw new Error(`${file} not found`)
        await unlock(DEMO_PASSWORD, false)
        return
      }
      if (isDesktop) {
        status.value = 'empty'
        return
      }
      source.value = 'published'
      envelope.value = await fetchEnvelope('panel.enc.json')
      if (!envelope.value) {
        status.value = 'empty'
        return
      }
      const candidate = opts.key ?? readStoredKey()
      if (candidate) {
        const ok = await unlock(candidate, true)
        if (!ok && opts.key) error.value = 'wrong-password'
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
      const parsed = parseText(JSON.stringify(raw))
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
    writeStoredKey(null)
    password.value = null
    published.value = null
    draft.value = null
    status.value = envelope.value ? 'locked' : 'empty'
  }

  function startDraft(): Bundle {
    if (!draft.value) {
      const base = published.value ?? makeBundle(emptyData())
      draft.value = clone(base)
    }
    return draft.value as Bundle
  }

  async function discardDraft() {
    draft.value = null
    await idbDel(DRAFT_KEY)
  }

  // the draft becomes the new baseline, e.g. after it was published or saved to a file
  async function commitDraft() {
    if (!draft.value) return
    published.value = clone(draft.value as Bundle)
    await discardDraft()
  }

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  watch(
    draft,
    (b) => {
      clearTimeout(saveTimer)
      if (!b || !password.value || source.value === 'demo') return
      const pw = password.value
      saveTimer = setTimeout(async () => {
        // fewer PBKDF2 rounds than the published file: this runs on every edit and stays on the device
        await idbSet(DRAFT_KEY, await encryptJson(clone(b), pw, 60_000))
        draftSavedAt.value = Date.now()
      }, 1200)
    },
    { deep: true },
  )

  async function exportEnvelope(pw = password.value): Promise<EncryptedEnvelope> {
    if (!pw) throw new Error('no password')
    const b = active.value
    if (!b) throw new Error('nothing to export')
    return encryptJson(pruneAssets(clone(b)), pw)
  }

  function adoptBundle(b: Bundle, pw: string | null, src: Source, f: { name: string; path?: string } | null = null) {
    published.value = b
    draft.value = null
    password.value = pw
    source.value = src
    file.value = f
    status.value = 'ready'
  }

  type LoadResult = { ok: true } | { ok: false; reason: 'needs-password' | 'wrong-password' | 'invalid'; details?: string[] }

  async function loadText(text: string, f: { name: string; path?: string }, pw?: string): Promise<LoadResult> {
    const parsed = parseText(text)
    if (parsed.kind === 'invalid') return { ok: false, reason: 'invalid', details: parsed.issues.map((i) => `${i.path}: ${i.message}`) }
    if (parsed.kind === 'bundle') {
      adoptBundle(parsed.bundle, pw ?? password.value, 'file', f)
      return { ok: true }
    }
    if (!pw) return { ok: false, reason: 'needs-password' }
    try {
      const inner = parseText(JSON.stringify(await decryptJson(parsed.envelope, pw)))
      if (inner.kind !== 'bundle') return { ok: false, reason: 'invalid' }
      envelope.value = parsed.envelope
      adoptBundle(inner.bundle, pw, 'file', f)
      return { ok: true }
    } catch {
      return { ok: false, reason: 'wrong-password' }
    }
  }

  // merges an imported file into the current draft instead of replacing the session (owner receiving a file from the electrician)
  async function importIntoDraft(text: string, pw?: string): Promise<LoadResult> {
    const parsed = parseText(text)
    if (parsed.kind === 'invalid') return { ok: false, reason: 'invalid', details: parsed.issues.map((i) => `${i.path}: ${i.message}`) }
    let bundle: Bundle
    if (parsed.kind === 'encrypted') {
      const tryPw = pw ?? password.value
      if (!tryPw) return { ok: false, reason: 'needs-password' }
      try {
        const inner = parseText(JSON.stringify(await decryptJson(parsed.envelope, tryPw)))
        if (inner.kind !== 'bundle') return { ok: false, reason: 'invalid' }
        bundle = inner.bundle
      } catch {
        return { ok: false, reason: pw ? 'wrong-password' : 'needs-password' }
      }
    } else bundle = parsed.bundle
    draft.value = bundle
    return { ok: true }
  }

  function createNew(title: string, pw: string) {
    adoptBundle(makeBundle(emptyData(title)), pw, 'new', null)
    startDraft()
  }

  function setPassword(pw: string) {
    password.value = pw
    if (source.value === 'published') writeStoredKey(pw)
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
