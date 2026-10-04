import * as yaml from 'js-yaml'
import { isEnvelope, type EncryptedEnvelope } from './crypto'
import { PanelData, type PanelInput, safeParsePanel, type ValidationIssue } from './schema'

export const ASSET_PREFIX = 'asset:'

export interface Bundle {
  format: 'panel-bundle'
  version: 1
  data: PanelData
  // id → data URL; referenced from data as "asset:<id>" so the plaintext never leaves the encrypted bundle
  assets: Record<string, string>
}

export function makeBundle(data: PanelInput, assets: Record<string, string> = {}): Bundle {
  return { format: 'panel-bundle', version: 1, data: PanelData.parse(data), assets }
}

export function resolveAsset(src: string | undefined, assets: Record<string, string>): string | undefined {
  if (!src) return undefined
  if (src.startsWith(ASSET_PREFIX)) return assets[src.slice(ASSET_PREFIX.length)]
  return src
}

export function usedAssetIds(data: PanelData): Set<string> {
  const ids = new Set<string>()
  const add = (s?: string) => {
    if (s?.startsWith(ASSET_PREFIX)) ids.add(s.slice(ASSET_PREFIX.length))
  }
  add(data.plan.background)
  data.photos.forEach((p) => add(p.src))
  data.documents.forEach((d) => add(d.href))
  data.devices.forEach((d) => d.photos.forEach(add))
  return ids
}

export function pruneAssets(b: Bundle): Bundle {
  const used = usedAssetIds(b.data)
  return { ...b, assets: Object.fromEntries(Object.entries(b.assets).filter(([k]) => used.has(k))) }
}

export type ParsedInput =
  | { kind: 'bundle'; bundle: Bundle }
  | { kind: 'encrypted'; envelope: EncryptedEnvelope }
  | { kind: 'invalid'; issues: ValidationIssue[] }

export function bundleFromUnknown(raw: unknown): ParsedInput {
  if (isEnvelope(raw)) return { kind: 'encrypted', envelope: raw }
  const obj = raw as { format?: string; data?: unknown; assets?: Record<string, string> }
  const isBundle = obj && typeof obj === 'object' && obj.format === 'panel-bundle'
  const r = safeParsePanel(isBundle ? obj.data : raw)
  if (!r.ok) return { kind: 'invalid', issues: r.issues }
  return { kind: 'bundle', bundle: { format: 'panel-bundle', version: 1, data: r.data, assets: isBundle ? (obj.assets ?? {}) : {} } }
}

export function parseText(text: string): ParsedInput {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    try {
      raw = yaml.load(text)
    } catch (e) {
      return { kind: 'invalid', issues: [{ path: '', message: (e as Error).message }] }
    }
  }
  return bundleFromUnknown(raw)
}

export function toYaml(b: Bundle): string {
  return yaml.dump(b, { lineWidth: -1, noRefs: true })
}

export function toJson(b: Bundle): string {
  return JSON.stringify(b, null, 2)
}
