import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectOs, latestInstaller } from '../download'

const nav = (userAgent: string, maxTouchPoints = 0, platform?: string) => ({ userAgent, maxTouchPoints, userAgentData: platform ? { platform } : undefined })

describe('download', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('tells desktop systems apart and leaves phones and tablets out', () => {
    expect(detectOs(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'))).toBe('mac')
    expect(detectOs(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5))).toBeNull()
    expect(detectOs(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, 'Windows'))).toBe('windows')
    expect(detectOs(nav('Mozilla/5.0 (X11; Linux x86_64)'))).toBe('linux')
    expect(detectOs(nav('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5))).toBeNull()
    expect(detectOs(nav('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)'))).toBeNull()
  })

  it('picks the installer for the system from the latest release', async () => {
    const assets = ['Panel.Editor_1.0.2_universal.dmg', 'Panel.Editor_1.0.2_x64-setup.exe', 'Panel.Editor_1.0.2_x64_en-US.msi', 'Panel.Editor_1.0.2_amd64.AppImage', 'Panel.Editor_universal.app.tar.gz'].map((name) => ({ name, browser_download_url: `https://dl/${name}` }))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ assets }) })))
    await expect(latestInstaller('https://github.com/a/b', 'mac')).resolves.toBe('https://dl/Panel.Editor_1.0.2_universal.dmg')
    await expect(latestInstaller('https://github.com/a/b', 'windows')).resolves.toBe('https://dl/Panel.Editor_1.0.2_x64-setup.exe')
    await expect(latestInstaller('https://github.com/a/b', 'linux')).resolves.toBe('https://dl/Panel.Editor_1.0.2_amd64.AppImage')
  })

  it('falls back when the release cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    await expect(latestInstaller('https://github.com/a/b', 'mac')).resolves.toBeNull()
    await expect(latestInstaller('', 'mac')).resolves.toBeNull()
  })
})
