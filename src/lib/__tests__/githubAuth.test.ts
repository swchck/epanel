import { afterEach, describe, expect, it, vi } from 'vitest'

const replies: object[] = []
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(async () => ({ ok: true, json: async () => replies.shift() })),
}))

const { siteUrl, SignInError, templateRepo, waitForToken } = await import('../githubAuth')
const code = { deviceCode: 'dc', userCode: 'ABCD-1234', verificationUri: 'https://github.com/login/device', interval: 5, expiresIn: 900 }

afterEach(() => {
  vi.useRealTimers()
  replies.length = 0
})

describe('github sign-in', () => {
  it('builds the Pages address for project and user sites', () => {
    expect(siteUrl('Ann', 'panel')).toBe('https://ann.github.io/panel/app/')
    expect(siteUrl('Ann', 'ann.github.io')).toBe('https://ann.github.io/app/')
  })

  it('reads the template repository from the build-time repo url', () => {
    expect(templateRepo()).toBe('someone/panel-app')
  })

  it('keeps polling while pending, backs off on slow_down and returns the token', async () => {
    vi.useFakeTimers()
    replies.push({ error: 'authorization_pending' }, { error: 'slow_down', interval: 10 }, { access_token: 'gho_x' })
    const p = waitForToken(code, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(5_000)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(replies).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(9_000)
    expect(replies).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(p).resolves.toBe('gho_x')
  })

  it('stops on a declined sign-in and on cancel', async () => {
    vi.useFakeTimers()
    replies.push({ error: 'access_denied' })
    const denied = waitForToken(code, new AbortController().signal)
    const deniedCheck = expect(denied).rejects.toMatchObject({ code: 'denied' })
    await vi.advanceTimersByTimeAsync(5_000)
    await deniedCheck

    const ctl = new AbortController()
    const cancelled = waitForToken(code, ctl.signal)
    ctl.abort()
    await expect(cancelled).rejects.toBeInstanceOf(SignInError)
  })
})
