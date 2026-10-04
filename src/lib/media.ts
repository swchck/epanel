export const MAX_DOC_BYTES = 8 * 1024 * 1024

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function canvasToDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  const webp = canvas.toDataURL('image/webp', quality)
  // Safari silently falls back to PNG for unsupported types, which is 5-10× bigger than JPEG
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality)
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  await img.decode()
  return img
}

export async function compressImage(blob: Blob, maxSide = 1600, quality = 0.82): Promise<{ url: string; width: number; height: number }> {
  if (blob.type === 'image/svg+xml') {
    const url = await blobToDataUrl(blob)
    const img = await loadImage(url)
    return { url, width: img.naturalWidth || 1200, height: img.naturalHeight || 800 }
  }
  const objectUrl = URL.createObjectURL(blob)
  try {
    const img = await loadImage(objectUrl)
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return { url: canvasToDataUrl(canvas, quality), width: canvas.width, height: canvas.height }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function renderPdfFirstPage(blob: Blob, maxSide = 2000): Promise<{ url: string; width: number; height: number }> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = maxSide / Math.max(base.width, base.height)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvas, viewport }).promise
    return { url: canvasToDataUrl(canvas, 0.85), width: canvas.width, height: canvas.height }
  } finally {
    await doc.loadingTask.destroy()
  }
}

export async function planImageFrom(blob: Blob): Promise<{ url: string; width: number; height: number }> {
  if (blob.type === 'application/pdf') return renderPdfFirstPage(blob)
  return compressImage(blob, 2400, 0.85)
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 13)}`
}
