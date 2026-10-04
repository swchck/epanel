import { decryptJson, encryptJson, isEnvelope } from '@/domain/crypto'

export interface GithubTarget {
  owner: string
  repo: string
  branch: string
  path: string
  token: string
}

const STORAGE = 'panel.github'

export function emptyTarget(): GithubTarget {
  return { owner: '', repo: '', branch: 'main', path: 'public/app/panel.enc.json', token: '' }
}

// the token can push to the repo, so it is kept encrypted with the panel password like the data itself
export async function loadTarget(password: string | null): Promise<GithubTarget> {
  try {
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return emptyTarget()
    const { token, ...rest } = JSON.parse(raw) as Partial<GithubTarget> & { token?: unknown }
    let plain = ''
    if (password && isEnvelope(token)) plain = await decryptJson<string>(token, password).catch(() => '')
    return { ...emptyTarget(), ...rest, token: plain }
  } catch {
    // storage blocked or corrupted
    return emptyTarget()
  }
}

export async function saveTarget(t: GithubTarget, rememberToken: boolean, password: string | null) {
  const token = rememberToken && password && t.token ? await encryptJson(t.token, password, 60_000) : undefined
  try {
    localStorage.setItem(STORAGE, JSON.stringify({ ...t, token }))
  } catch {
    // storage blocked
  }
}

function utf8ToB64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export class GithubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// contents API: one commit per publish; the Pages workflow picks it up and redeploys
export async function publishFile(t: GithubTarget, content: string, message: string): Promise<{ commitUrl: string }> {
  const api = `https://api.github.com/repos/${encodeURIComponent(t.owner)}/${encodeURIComponent(t.repo)}/contents/${t.path.split('/').map(encodeURIComponent).join('/')}`
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${t.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
  let sha: string | undefined
  const head = await fetch(`${api}?ref=${encodeURIComponent(t.branch)}`, { headers, cache: 'no-store' })
  if (head.ok) sha = ((await head.json()) as { sha: string }).sha
  else if (head.status !== 404) throw new GithubError(head.status, await head.text())

  const res = await fetch(api, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: utf8ToB64(content), branch: t.branch, sha }),
  })
  if (!res.ok) throw new GithubError(res.status, await res.text())
  const json = (await res.json()) as { commit: { html_url: string } }
  return { commitUrl: json.commit.html_url }
}
