export const isDesktop: boolean =
  import.meta.env.VITE_TARGET === 'desktop' || (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window)

export interface OpenedText {
  name: string
  text: string
  path?: string
}

export interface OpenedBinary {
  name: string
  type: string
  blob: Blob
}

function pickWebFile(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    // the input must be attached for iOS Safari to fire change
    input.style.display = 'none'
    document.body.appendChild(input)
    input.addEventListener('change', () => {
      resolve(Array.from(input.files ?? []))
      input.remove()
    })
    input.addEventListener('cancel', () => {
      resolve([])
      input.remove()
    })
    input.click()
  })
}

export async function openTextFile(extensions: string[]): Promise<OpenedText | null> {
  if (isDesktop) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { invoke } = await import('@tauri-apps/api/core')
    const path = await open({ multiple: false, filters: [{ name: 'Panel', extensions }] })
    if (typeof path !== 'string') return null
    return invoke<OpenedText>('read_text', { path })
  }
  const [file] = await pickWebFile(extensions.map((e) => `.${e}`).join(','))
  if (!file) return null
  return { name: file.name, text: await file.text() }
}

export async function openBinaryFiles(accept: string, multiple = false): Promise<OpenedBinary[]> {
  // the webview's own file input works inside Tauri too and avoids an fs permission for arbitrary paths
  const files = await pickWebFile(accept, multiple)
  return files.map((f) => ({ name: f.name, type: f.type, blob: f }))
}

export async function saveTextFile(suggestedName: string, text: string, path?: string): Promise<string | undefined> {
  if (isDesktop) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { invoke } = await import('@tauri-apps/api/core')
    const ext = suggestedName.split('.').pop() ?? 'panel'
    const target = path ?? (await save({ defaultPath: suggestedName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] }))
    if (!target) return undefined
    await invoke('write_text', { path: target, text })
    return target
  }
  const blob = new Blob([text], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return suggestedName
}

// files opened from Finder/Explorer ("Open with", double-click on a .panel) reach the app this way
export async function onOpenFile(cb: (f: OpenedText) => void) {
  if (!isDesktop) return
  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')
  const take = async () => {
    const pending = await invoke<OpenedText | null>('take_opened_file')
    if (pending) cb(pending)
  }
  // listen before the first take, or a file opened in between is lost
  await listen('open-file', take)
  await take()
}

/** Asks a yes/no question, with the native dialog on desktop. */
export async function confirmAction(message: string): Promise<boolean> {
  if (!isDesktop) return window.confirm(message)
  const { ask } = await import('@tauri-apps/plugin-dialog')
  return ask(message, { kind: 'warning' })
}
