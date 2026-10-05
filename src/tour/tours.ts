export interface TourStep {
  // i18n key under tour.<section>.<key>; the text lives in the locale files
  key: string
  // data-tour attribute of the element to highlight; none centres the card on the page
  target?: string
}

const step = (key: string, target?: string): TourStep => ({ key, target })

/**
 * Onboarding steps per section, keyed by the id tourFor() returns for a route.
 */
export const TOURS: Record<string, TourStep[]> = {
  panel: [step('nav', 'nav'), step('stats', 'panel-stats'), step('board', 'panel-board'), step('view', 'panel-view'), step('simulate', 'panel-simulate'), step('filters', 'panel-types')],
  plan: [step('canvas', 'plan-canvas'), step('view', 'plan-view'), step('simulate', 'plan-simulate'), step('layers', 'plan-layers'), step('aside', 'plan-aside')],
  find: [step('search', 'find-search'), step('rooms', 'find-rooms')],
  schema: [step('tree', 'schema-tree'), step('simulate', 'schema-simulate')],
  checks: [step('counts', 'checks-counts'), step('load', 'checks-load'), step('list', 'checks-list')],
  maintenance: [step('task', 'maint-task'), step('done', 'maint-done'), step('log', 'maint-log')],
  labels: [step('options', 'labels-options'), step('sticker', 'labels-sticker'), step('print', 'labels-print')],
  emergency: [step('scenarios', 'emergency-scenarios'), step('smell', 'emergency-smell')],
  'edit-general': [step('tabs', 'edit-tabs'), step('preview', 'preview'), step('history', 'edit-history'), step('meta', 'gen-meta'), step('supply', 'gen-supply'), step('contacts', 'gen-contacts')],
  'edit-panel': [step('tabs', 'edit-tabs'), step('board', 'epanel-board'), step('view', 'epanel-view'), step('addrow', 'epanel-addrow'), step('aside', 'epanel-aside')],
  'edit-plan': [step('modes', 'eplan-modes'), step('canvas', 'eplan-canvas'), step('view3d', 'eplan-3d'), step('aside', 'eplan-aside')],
  'edit-maintenance': [step('add', 'emaint-add'), step('task', 'emaint-task')],
  'edit-publish': [step('file', 'pub-file'), step('site', 'pub-site'), step('password', 'pub-password')],
}

// someone opening "Something tripped" is mid-incident: the tour waits for the ? button there
export const MANUAL_ONLY = new Set(['emergency'])

/**
 * Maps a route to its tour id, or returns null when the section has none.
 */
export function tourFor(name: string | symbol | null | undefined, params: Record<string, unknown>): string | null {
  if (name === 'panel' || name === 'device') return 'panel'
  if (name === 'edit') return `edit-${(params.tab as string | undefined) || 'panel'}`
  return typeof name === 'string' && name in TOURS ? name : null
}
