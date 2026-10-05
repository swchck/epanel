import { afterEach, describe, expect, it, vi } from 'vitest'

const replies: object[] = []
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(async () => ({ ok: true, json: async () => replies.shift() })),
}))

const { createSite, dataPath, freshToken, siteUrl, SignInError, templateRepo, waitForToken } = await import('../githubAuth')
const { emptyTarget } = await import('../github')
const { fetch: httpFetch } = await import('@tauri-apps/plugin-http')
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

  it('names the site template next to the build-time repo', () => {
    expect(templateRepo()).toBe('someone/panel-app-site')
  })

  it('keeps polling while pending, backs off on slow_down and returns the token', async () => {
    vi.useFakeTimers()
    replies.push({ error: 'authorization_pending' }, { error: 'slow_down', interval: 10 }, { access_token: 'ghu_x', refresh_token: 'ghr_x', expires_in: 28800, refresh_token_expires_in: 15897600 })
    const p = waitForToken(code, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(5_000)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(replies).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(9_000)
    expect(replies).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(p).resolves.toMatchObject({ token: 'ghu_x', refreshToken: 'ghr_x', expiresAt: Date.now() + 28_800_000 })
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

  it('leaves a non-expiring or still fresh token alone', async () => {
    const persist = vi.fn(async () => {})
    await expect(freshToken({ ...emptyTarget(), token: 'pat' }, persist)).resolves.toBe('pat')
    await expect(freshToken({ ...emptyTarget(), token: 'ghu', refreshToken: 'ghr', expiresAt: Date.now() + 3_600_000 }, persist)).resolves.toBe('ghu')
    expect(persist).not.toHaveBeenCalled()
  })

  it('refreshes once for concurrent callers and saves the rotated refresh token', async () => {
    vi.mocked(httpFetch).mockClear()
    replies.push({ access_token: 'ghu_new', refresh_token: 'ghr_new', expires_in: 28800, refresh_token_expires_in: 15897600 })
    const t = { ...emptyTarget(), token: 'ghu_old', refreshToken: 'ghr_old', expiresAt: Date.now() + 60_000 }
    const saved: string[] = []
    const persist = async () => void saved.push(t.refreshToken)
    const [a, b] = await Promise.all([freshToken(t, persist), freshToken(t, persist)])
    expect([a, b]).toEqual(['ghu_new', 'ghu_new'])
    expect(httpFetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(vi.mocked(httpFetch).mock.calls[0]![1]!.body as string)).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'ghr_old' })
    expect(saved).toContain('ghr_new')
  })

  it('asks to sign in again when the refresh token is gone or rejected', async () => {
    const persist = async () => {}
    await expect(freshToken({ ...emptyTarget(), token: 'ghu', expiresAt: Date.now() - 1 }, persist)).rejects.toMatchObject({ code: 'expired' })
    replies.push({ error: 'bad_refresh_token' })
    await expect(freshToken({ ...emptyTarget(), token: 'ghu', refreshToken: 'ghr', expiresAt: Date.now() - 1 }, persist)).rejects.toMatchObject({ code: 'expired' })
  })

  it('turns Pages on only after the template commit gives the repo its real default branch', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    let gets = 0
    const reply = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) })
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace('https://api.github.com', '')
      calls.push(`${init?.method ?? 'GET'} ${path}`)
      const repo = (branch: string) => ({ name: 'site', owner: { login: 'ann' }, default_branch: branch, private: false })
      if (path.endsWith('/generate')) return reply(201, repo('master'))
      if (path === '/repos/ann/site') return reply(200, repo(++gets < 2 ? 'master' : 'main'))
      if (path.startsWith('/repos/ann/site/branches/')) return path.endsWith('/main') ? reply(200, {}) : reply(404, {})
      if (path === '/repos/ann/site/pages') return reply(201, {})
      return reply(404, {})
    }))
    const p = createSite('tok', 'ann', 'site')
    await vi.runAllTimersAsync()
    await expect(p).resolves.toMatchObject({ defaultBranch: 'main' })
    const pages = calls.indexOf('POST /repos/ann/site/pages')
    expect(pages).toBeGreaterThan(calls.indexOf('GET /repos/ann/site/branches/main'))
    vi.unstubAllGlobals()
  })

  it('keeps the data at the root of a site and next to the app in a fork of it', async () => {
    const reply = (status: number) => ({ ok: status < 300, status, json: async () => [], text: async () => '' })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => reply(url.includes('/repos/ann/fork/') ? 200 : 404)))
    await expect(dataPath('tok', 'ann', 'site', 'main')).resolves.toBe('panel.enc.json')
    await expect(dataPath('tok', 'ann', 'fork', 'main')).resolves.toBe('public/app/panel.enc.json')
    vi.unstubAllGlobals()
  })
})
