import { getSetting, setSetting } from './db'

export type RepoConfig = {
  owner: string
  repo: string
  branch: string
  chaptersDir: string
  clientId: string
}

export type StoryBibleConfig = {
  owner: string
  repo: string
  branch: string
  stcPath: string
  schemePath: string
  extraPaths: string
}

export type GhFile = {
  name: string
  path: string
  sha: string
  type: 'file' | 'dir'
}

export type DeviceCode = {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

const TOKEN_KEY = 'github_token'

export async function getToken(): Promise<string | null> {
  return getSetting(TOKEN_KEY)
}

export async function setToken(token: string): Promise<void> {
  await setSetting(TOKEN_KEY, token)
}

export async function getRepoConfig(): Promise<RepoConfig> {
  return {
    owner: (await getSetting('gh_owner')) || 'neogedom',
    repo: (await getSetting('gh_repo')) || 'Livro',
    branch: (await getSetting('gh_branch')) || 'main',
    chaptersDir: (await getSetting('gh_chapters_dir')) || 'Livro 1',
    clientId: (await getSetting('gh_client_id')) || '',
  }
}

export async function saveRepoConfig(cfg: Partial<RepoConfig>): Promise<void> {
  const entries: Array<[string, string | undefined]> = [
    ['gh_owner', cfg.owner],
    ['gh_repo', cfg.repo],
    ['gh_branch', cfg.branch],
    ['gh_chapters_dir', cfg.chaptersDir],
    ['gh_client_id', cfg.clientId],
  ]
  for (const [k, v] of entries) if (v != null) await setSetting(k, v)
}

export async function getStoryBibleConfig(): Promise<StoryBibleConfig> {
  return {
    owner: (await getSetting('sb_owner')) || 'neogedom',
    repo: (await getSetting('sb_repo')) || 'storybible',
    branch: (await getSetting('sb_branch')) || 'main',
    stcPath: (await getSetting('sb_stc_path')) || 'temas/arco-stc.md',
    schemePath: (await getSetting('sb_scheme_path')) || 'temas/esquema-l1.md',
    extraPaths: (await getSetting('sb_extra_paths')) || '',
  }
}

export async function saveStoryBibleConfig(cfg: Partial<StoryBibleConfig>): Promise<void> {
  const entries: Array<[string, string | undefined]> = [
    ['sb_owner', cfg.owner],
    ['sb_repo', cfg.repo],
    ['sb_branch', cfg.branch],
    ['sb_stc_path', cfg.stcPath],
    ['sb_scheme_path', cfg.schemePath],
    ['sb_extra_paths', cfg.extraPaths],
  ]
  for (const [k, v] of entries) if (v != null) await setSetting(k, v)
}

async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/vnd.github+json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await fetch(`https://api.github.com${path}`, { ...init, headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${url} falhou: ${res.status}`)
  return res.json() as Promise<T>
}

export async function startDeviceFlow(clientId: string): Promise<DeviceCode> {
  try {
    return await postJson<DeviceCode>('/api/github/device/code', { client_id: clientId, scope: 'repo' })
  } catch {
    return postJson<DeviceCode>('https://github.com/login/device/code', { client_id: clientId, scope: 'repo' })
  }
}

export async function pollDeviceToken(clientId: string, deviceCode: string): Promise<string | 'pending' | 'slow_down'> {
  const payload = {
    client_id: clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  }
  let data: { access_token?: string; error?: string }
  try {
    data = await postJson('/api/github/device/token', payload)
  } catch {
    data = await postJson('https://github.com/login/oauth/access_token', payload)
  }
  if (data.access_token) return data.access_token
  if (data.error === 'authorization_pending') return 'pending'
  if (data.error === 'slow_down') return 'slow_down'
  throw new Error(data.error || 'OAuth failed')
}

function b64EncodeUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function b64DecodeUtf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export async function listChapterFiles(cfg: RepoConfig): Promise<GhFile[]> {
  const dir = encodeURIComponent(cfg.chaptersDir)
  const items = await gh<Array<{ name: string; path: string; sha: string; type: string }>>(
    `/repos/${cfg.owner}/${cfg.repo}/contents/${dir}?ref=${encodeURIComponent(cfg.branch)}`,
  )
  return items
    .filter((i) => i.type === 'file' && /\.md$/i.test(i.name))
    .map((i) => ({ name: i.name, path: i.path, sha: i.sha, type: 'file' }))
}

export async function readFile(cfg: RepoConfig, path: string): Promise<{ sha: string; content: string }> {
  const data = await gh<{ sha: string; content: string }>(
    `/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(cfg.branch)}`,
  )
  return { sha: data.sha, content: b64DecodeUtf8(data.content) }
}

export async function readRepoTextFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<string> {
  const data = await gh<{ content: string }>(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`,
  )
  return b64DecodeUtf8(data.content)
}

async function getRefSha(cfg: RepoConfig, ref: string): Promise<string> {
  const data = await gh<{ object: { sha: string } }>(
    `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${encodeURIComponent(ref)}`,
  )
  return data.object.sha
}

async function createBranch(cfg: RepoConfig, newBranch: string, fromSha: string): Promise<void> {
  await gh(`/repos/${cfg.owner}/${cfg.repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: fromSha }),
  })
}

async function upsertFileOnBranch(
  cfg: RepoConfig,
  path: string,
  content: string,
  sha: string | undefined,
  branch: string,
  message: string,
): Promise<void> {
  await gh(`/repos/${cfg.owner}/${cfg.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: b64EncodeUtf8(content), sha, branch }),
  })
}

export async function createPullRequest(
  cfg: RepoConfig,
  head: string,
  base: string,
  title: string,
  body: string,
): Promise<string> {
  const pr = await gh<{ html_url: string }>(`/repos/${cfg.owner}/${cfg.repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, head, base, body }),
  })
  return pr.html_url
}

export async function syncChapterAsPR(
  cfg: RepoConfig,
  path: string,
  content: string,
  remoteSha: string | undefined,
): Promise<string> {
  const baseSha = await getRefSha(cfg, cfg.branch)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safe = path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const branch = `autoria/${safe}-${stamp}`
  await createBranch(cfg, branch, baseSha)
  await upsertFileOnBranch(cfg, path, content, remoteSha, branch, `Atualiza ${path} via PWA Autoria`)
  return createPullRequest(
    cfg,
    branch,
    cfg.branch,
    `Autoria: atualiza ${path}`,
    'Edição criada pelo PWA de autoria. Revisar e fazer merge manual para resolver conflitos se houver.',
  )
}
