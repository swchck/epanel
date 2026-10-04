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

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export async function openTextFile(extensions: string[]): Promise<OpenedText | null> {
  if (isDesktop) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await open({ multiple: false, filters: [{ name: 'Panel', extensions }] })
    if (typeof path !== 'string') return null
    return { name: baseName(path), path, text: await readTextFile(path) }
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
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const ext = suggestedName.split('.').pop() ?? 'panel'
    const target = path ?? (await save({ defaultPath: suggestedName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] }))
    if (!target) return undefined
    await writeTextFile(target, text)
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
