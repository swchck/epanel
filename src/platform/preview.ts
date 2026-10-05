// The desktop editor's "as the client sees it" window. It runs the same app in viewer mode
// (see viewerOnly) and gets the draft over Tauri events instead of loading anything itself.

import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { Bundle } from '@/domain/model'

const LABEL = 'preview'
const READY = 'preview:ready'
const BUNDLE = 'preview:bundle'

let win: WebviewWindow | null = null

/**
 * Opens the preview window, or brings it to the front when it is already open.
 */
export async function openPreview(title: string): Promise<void> {
  if (win) return void (await win.setFocus())
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  win = new WebviewWindow(LABEL, { url: 'index.html#/?preview', title, width: 1280, height: 840, minWidth: 900, minHeight: 600 })
  void win.once('tauri://destroyed', () => (win = null))
}

/**
 * Feeds the preview window from the editor: the current bundle once it is ready, then on every send().
 * send() is a no-op while no preview is open, so callers can call it on each edit.
 */
export async function servePreview(current: () => Bundle | null): Promise<() => void> {
  const { emitTo, listen } = await import('@tauri-apps/api/event')
  const send = () => {
    const b = current()
    if (win && b) void emitTo(LABEL, BUNDLE, b)
  }
  await listen(READY, send)
  return send
}

/**
 * Receives the editor's bundle in the preview window and asks for the first one.
 */
export async function receivePreview(show: (b: Bundle) => void): Promise<void> {
  const { emitTo, listen } = await import('@tauri-apps/api/event')
  await listen<Bundle>(BUNDLE, (e) => show(e.payload))
  await emitTo('main', READY)
}
