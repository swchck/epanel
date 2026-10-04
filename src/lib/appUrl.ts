import { isDesktop } from '@/platform'

// QR codes must point at the public web app even when generated from the desktop editor
export function appUrl(publicUrl: string | undefined, path: string, password?: string | null): string {
  let base = publicUrl?.trim()
  if (!base) base = isDesktop ? '' : `${location.origin}${location.pathname}`
  if (base && !base.endsWith('/') && !base.endsWith('.html')) base += '/'
  const q = password ? `?k=${encodeURIComponent(password)}` : ''
  return `${base}#${path}${q}`
}
