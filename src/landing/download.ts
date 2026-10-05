export type DesktopOs = 'mac' | 'windows' | 'linux'

export const OS_NAME: Record<DesktopOs, string> = { mac: 'macOS', windows: 'Windows', linux: 'Linux' }

// the installers tauri-action uploads; the .dmg is universal and the AppImage runs on any distribution
const ASSET: Record<DesktopOs, RegExp> = { mac: /\.dmg$/, windows: /-setup\.exe$/, linux: /\.AppImage$/ }

/**
 * Returns the desktop system the visitor is on, or null for phones, tablets and anything unknown.
 */
export function detectOs(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & { userAgentData?: { platform?: string } }): DesktopOs | null {
  const ua = nav.userAgent
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return null
  const platform = `${nav.userAgentData?.platform ?? ''} ${ua}`
  // iPadOS asks for desktop sites with a Mac user agent; touch gives it away
  if (/Mac/i.test(platform)) return nav.maxTouchPoints > 1 ? null : 'mac'
  if (/Win/i.test(platform)) return 'windows'
  if (/CrOS/i.test(platform)) return null
  if (/Linux|X11/i.test(platform)) return 'linux'
  return null
}

/**
 * Returns the direct download link of the latest installer for the system, or null when there is none.
 * The asset names carry the version, so they are looked up in the latest release instead of guessed.
 */
export async function latestInstaller(repoUrl: string, os: DesktopOs): Promise<string | null> {
  const repo = /github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(repoUrl)?.[1]
  if (!repo) return null
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) return null
    const release = (await res.json()) as { assets?: { name: string; browser_download_url: string }[] }
    return release.assets?.find((a) => ASSET[os].test(a.name))?.browser_download_url ?? null
  } catch {
    return null
  }
}
