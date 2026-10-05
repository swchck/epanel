// GitHub sign-in for the desktop editor (OAuth device flow) and the repository calls that come with it.
// The two github.com/login endpoints send no CORS headers, so they go through the Tauri HTTP plugin;
// api.github.com allows browser requests and is called with plain fetch.

import { GithubError, type GithubTarget } from './github'

const GITHUB_CLIENT_ID: string = import.meta.env.VITE_GITHUB_CLIENT_ID ?? ''
// `repo` because enabling Pages on a new site needs it; `public_repo` would leave that step to the user
const SCOPE = 'repo'

/**
 * Reports whether this build can sign in to GitHub: the desktop app with an OAuth client id baked in.
 */
export const canSignIn = import.meta.env.VITE_TARGET === 'desktop' && !!GITHUB_CLIENT_ID

/**
 * Names the repository new sites are generated from, as "owner/repo", or returns null when unknown.
 * It is the viewer-only template that lives next to the app's repository: "<app repo>-site".
 */
export function templateRepo(): string | null {
  const m = /github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(__REPO_URL__)
  return m ? `${m[1]}-site` : null
}

// a site made from the template keeps its data at the root; a fork of the app itself keeps it next to the app
const SITE_DATA_PATH = 'panel.enc.json'
const APP_DATA_PATH = 'public/app/panel.enc.json'

/**
 * Returns where the encrypted panel lives in the repository, telling a site from a fork of the app.
 */
export async function dataPath(token: string, owner: string, repo: string, branch: string): Promise<string> {
  try {
    await api(token, `/repos/${owner}/${repo}/contents/public/app?ref=${encodeURIComponent(branch)}`)
    return APP_DATA_PATH
  } catch (e) {
    if (e instanceof GithubError && e.status === 404) return SITE_DATA_PATH
    throw e
  }
}

export interface DeviceCode {
  deviceCode: string
  userCode: string
  verificationUri: string
  // seconds
  interval: number
  expiresIn: number
}

async function loginPost<T>(url: string, body: Record<string, string>): Promise<T> {
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
  const res = await tauriFetch(url, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new GithubError(res.status, await res.text())
  return (await res.json()) as T
}

/**
 * Starts a device sign-in and returns the code the user types on github.com.
 */
export async function startDeviceFlow(): Promise<DeviceCode> {
  const r = await loginPost<{ device_code: string; user_code: string; verification_uri: string; interval: number; expires_in: number }>('https://github.com/login/device/code', {
    client_id: GITHUB_CLIENT_ID,
    scope: SCOPE,
  })
  return { deviceCode: r.device_code, userCode: r.user_code, verificationUri: r.verification_uri, interval: r.interval, expiresIn: r.expires_in }
}

export class SignInError extends Error {
  constructor(public code: 'denied' | 'expired' | 'cancelled' | 'failed') {
    super(code)
  }
}

export type Grant = Pick<GithubTarget, 'token' | 'refreshToken' | 'expiresAt' | 'refreshExpiresAt'>

type TokenReply = { access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number; error?: string; interval?: number }

// an app registered without expiring tokens sends no expiry; zero then means "never" all the way down
function toGrant(r: TokenReply & { access_token: string }): Grant {
  const now = Date.now()
  return {
    token: r.access_token,
    refreshToken: r.refresh_token ?? '',
    expiresAt: r.expires_in ? now + r.expires_in * 1000 : 0,
    refreshExpiresAt: r.refresh_token_expires_in ? now + r.refresh_token_expires_in * 1000 : 0,
  }
}

/**
 * Waits until the user confirms the code on github.com and returns the tokens.
 * @throws SignInError when the user declines, the code expires or the signal aborts.
 */
export async function waitForToken(code: DeviceCode, signal: AbortSignal): Promise<Grant> {
  let interval = code.interval
  const deadline = Date.now() + code.expiresIn * 1000
  while (Date.now() < deadline) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, interval * 1000)
      signal.addEventListener('abort', () => (clearTimeout(t), reject(new SignInError('cancelled'))), { once: true })
    })
    const r = await loginPost<TokenReply>('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_CLIENT_ID,
      device_code: code.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })
    if (r.access_token) return toGrant({ ...r, access_token: r.access_token })
    // RFC 8628 §3.5: slow_down means add 5 seconds, and GitHub sends the new interval along
    if (r.error === 'slow_down') interval = r.interval ?? interval + 5
    else if (r.error === 'access_denied') throw new SignInError('denied')
    else if (r.error === 'expired_token') throw new SignInError('expired')
    else if (r.error !== 'authorization_pending') throw new SignInError('failed')
  }
  throw new SignInError('expired')
}

// refresh a few minutes early so a publish that starts just before expiry does not fail halfway
const REFRESH_MARGIN_MS = 5 * 60_000
let refreshing: Promise<Grant> | null = null

/**
 * Returns a usable access token for the target, refreshing it first when it is about to expire.
 * The new grant is written into the target and handed to persist before this resolves: GitHub
 * rotates the refresh token on every use, so an unsaved one would lock the user out on next launch.
 * @throws SignInError 'expired' when the refresh token is gone or rejected and the user must sign in again.
 */
export async function freshToken(t: GithubTarget, persist: () => Promise<void>): Promise<string> {
  if (!t.expiresAt || Date.now() < t.expiresAt - REFRESH_MARGIN_MS) return t.token
  if (!t.refreshToken || (t.refreshExpiresAt && Date.now() >= t.refreshExpiresAt)) throw new SignInError('expired')
  // two refreshes with the same token would invalidate each other, so concurrent callers share one
  refreshing ??= (async () => {
    // client_secret is not needed for tokens that came from the device flow
    const r = await loginPost<TokenReply>('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: t.refreshToken,
    })
    if (!r.access_token) throw new SignInError('expired')
    return toGrant({ ...r, access_token: r.access_token })
  })().finally(() => (refreshing = null))
  Object.assign(t, await refreshing)
  await persist()
  return t.token
}

async function api<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    cache: 'no-store',
  })
  if (!res.ok) throw new GithubError(res.status, await res.text())
  return (res.status === 204 ? undefined : await res.json()) as T
}

export interface Repo {
  owner: string
  name: string
  defaultBranch: string
  private: boolean
}

type ApiRepo = { name: string; owner: { login: string }; default_branch: string; private: boolean }
const toRepo = (r: ApiRepo): Repo => ({ owner: r.owner.login, name: r.name, defaultBranch: r.default_branch, private: r.private })

/**
 * Returns the login of the signed-in user.
 */
export async function currentUser(token: string): Promise<string> {
  return (await api<{ login: string }>(token, '/user')).login
}

/**
 * Returns the repository as GitHub sees it now.
 */
export async function getRepo(token: string, owner: string, name: string): Promise<Repo> {
  return toRepo(await api<ApiRepo>(token, `/repos/${owner}/${name}`))
}

/**
 * Lists repositories the user owns, most recently updated first.
 */
export async function listRepos(token: string): Promise<Repo[]> {
  return (await api<ApiRepo[]>(token, '/user/repos?affiliation=owner&sort=updated&per_page=100')).map(toRepo)
}

/**
 * Creates a public repository from the app template and switches GitHub Pages to the Actions build.
 * @throws GithubError 404 when the template repository is not marked as a template or is unreachable.
 */
export async function createSite(token: string, owner: string, name: string): Promise<Repo> {
  const template = templateRepo()
  if (!template) throw new GithubError(404, 'no template repository')
  const repo = toRepo(
    await api<ApiRepo>(token, `/repos/${template}/generate`, {
      method: 'POST',
      body: JSON.stringify({ owner, name, private: false, description: 'Electrical panel map', include_all_branches: false }),
    }),
  )
  // the generate reply arrives before the template's first commit, while default_branch is still the
  // account default (often master); Pages copies whatever branch is default at that moment into the
  // github-pages deployment rule, so it must wait until the real branch exists
  const ready = await waitForFirstBranch(token, repo.owner, repo.name)
  for (let attempt = 0; ; attempt++) {
    try {
      await api(token, `/repos/${ready.owner}/${ready.name}/pages`, { method: 'POST', body: JSON.stringify({ build_type: 'workflow' }) })
      break
    } catch (e) {
      if (e instanceof GithubError && e.status === 409) break
      if (attempt >= 5 || !(e instanceof GithubError) || e.status === 401 || e.status === 403) throw e
      await sleep(1500 * (attempt + 1))
    }
  }
  return ready
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// about 30 s in total; a template copy usually lands within a few seconds
async function waitForFirstBranch(token: string, owner: string, name: string): Promise<Repo> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const repo = await getRepo(token, owner, name)
    if (await branchExists(token, owner, name, repo.defaultBranch)) return repo
    await sleep(1000 + attempt * 500)
  }
  throw new GithubError(504, 'the new repository has no commits yet')
}

/**
 * Reports whether the branch exists in the repository.
 */
export async function branchExists(token: string, owner: string, repo: string, branch: string): Promise<boolean> {
  try {
    await api(token, `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`)
    return true
  } catch (e) {
    if (e instanceof GithubError && e.status === 404) return false
    throw e
  }
}

/**
 * Returns the address the site will be served at once Pages finishes the first build.
 */
export function siteUrl(owner: string, repo: string): string {
  const host = `${owner.toLowerCase()}.github.io`
  return repo.toLowerCase() === host ? `https://${host}/app/` : `https://${host}/${repo}/app/`
}
