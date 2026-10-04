import { isEnvelope, type EncryptedEnvelope } from './crypto'
import type { Bundle, ValidationIssue } from './model'
import { PanelData, type PanelInput, safeParsePanel } from './schema'

export function makeBundle(data: PanelInput, assets: Record<string, string> = {}): Bundle {
  return { format: 'panel-bundle', version: 1, data: PanelData.parse(data), assets }
}

export function validateData(data: unknown): ValidationIssue[] {
  const r = safeParsePanel(data)
  return r.ok ? [] : r.issues
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

// js-yaml is only needed for hand-written files, so it stays out of the startup bundle
const loadYaml = () => import('js-yaml')

export async function parseText(text: string): Promise<ParsedInput> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    try {
      raw = (await loadYaml()).load(text)
    } catch (e) {
      return { kind: 'invalid', issues: [{ path: '', message: (e as Error).message }] }
    }
  }
  return bundleFromUnknown(raw)
}

export async function toYaml(b: Bundle): Promise<string> {
  return (await loadYaml()).dump(b, { lineWidth: -1, noRefs: true })
}

export function toJson(b: Bundle): string {
  return JSON.stringify(b, null, 2)
}
