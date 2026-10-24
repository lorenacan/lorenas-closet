/**
 * Cliente mínimo de la API de GitHub (Git Data API) para guardar los datos en un repositorio privado.
 * Sube por lotes: blobs -> árbol -> commit -> actualizar rama.
 */
export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export interface GitHubOptions {
  fetch?: typeof fetch
  /** Pausa mínima entre peticiones que crean contenido (GitHub limita ~80/min). */
  postGapMs?: number
  sleep?: (ms: number) => Promise<void>
  maxRetries?: number
}

export interface Head { branch: string; commitSha: string; treeSha: string }
export interface Change { path: string; /** null = borrar */ sha: string | null }

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64.replace(/\n/g, ''))
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export class GitHubApi {
  private f: typeof fetch
  private sleep: (ms: number) => Promise<void>
  private lastPost = 0

  constructor(private repo: string, private token: string, private opts: GitHubOptions = {}) {
    this.f = opts.fetch ?? ((...a) => fetch(...a))
    this.sleep = opts.sleep ?? defaultSleep
  }

  private async req<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
    if (method !== 'GET' && this.opts.postGapMs) {
      const wait = this.lastPost + this.opts.postGapMs - Date.now()
      if (wait > 0) await this.sleep(wait)
      this.lastPost = Date.now()
    }
    const res = await this.f(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T
    const text = await res.text().catch(() => '')
    const limited = res.status === 429 || (res.status === 403 && /rate limit|abuse|secondary/i.test(text))
    if (limited && attempt < (this.opts.maxRetries ?? 5)) {
      const ra = Number(res.headers.get('retry-after'))
      await this.sleep((ra > 0 ? ra : 15 * 2 ** attempt) * 1000)
      return this.req(method, path, body, attempt + 1)
    }
    if (res.status >= 500 && attempt < 3) {
      await this.sleep(1000 * 2 ** attempt)
      return this.req(method, path, body, attempt + 1)
    }
    throw new GitHubError(res.status, humanError(res.status, text))
  }

  getRepo() {
    return this.req<{ default_branch: string; private: boolean; permissions?: { push?: boolean } }>('GET', `/repos/${this.repo}`)
  }

  /** Devuelve la cabeza de la rama; si el repositorio está vacío crea el primer commit. */
  async ensureHead(): Promise<Head> {
    const info = await this.getRepo()
    const branch = info.default_branch
    const read = async (): Promise<Head | null> => {
      try {
        const ref = await this.req<{ object: { sha: string } }>('GET', `/repos/${this.repo}/git/ref/heads/${branch}`)
        const commit = await this.req<{ tree: { sha: string } }>('GET', `/repos/${this.repo}/git/commits/${ref.object.sha}`)
        return { branch, commitSha: ref.object.sha, treeSha: commit.tree.sha }
      } catch (e) {
        if (e instanceof GitHubError && (e.status === 409 || e.status === 404)) return null
        throw e
      }
    }
    const head = await read()
    if (head) return head
    await this.req('PUT', `/repos/${this.repo}/contents/README.md`, {
      message: 'Inicia el repositorio de datos',
      content: toBase64(new TextEncoder().encode('# Datos de Lorena’s Closet\n\nCopia automática de tu armario. No edites estos archivos a mano.\n')),
    })
    const again = await read()
    if (!again) throw new GitHubError(500, 'No se pudo iniciar el repositorio')
    return again
  }

  /** Mapa ruta -> sha de todos los archivos del árbol. */
  async getTree(treeSha: string): Promise<Map<string, string>> {
    const t = await this.req<{ tree: { path: string; sha: string; type: string }[]; truncated: boolean }>(
      'GET', `/repos/${this.repo}/git/trees/${treeSha}?recursive=1`,
    )
    if (t.truncated) throw new GitHubError(413, 'El repositorio de datos es demasiado grande para sincronizar')
    return new Map(t.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]))
  }

  async createBlob(bytes: Uint8Array): Promise<string> {
    const r = await this.req<{ sha: string }>('POST', `/repos/${this.repo}/git/blobs`, { content: toBase64(bytes), encoding: 'base64' })
    return r.sha
  }

  async getBlob(sha: string): Promise<Uint8Array> {
    const r = await this.req<{ content: string }>('GET', `/repos/${this.repo}/git/blobs/${sha}`)
    return fromBase64(r.content)
  }

  async commit(head: Head, changes: Change[], message: string): Promise<Head> {
    const tree = await this.req<{ sha: string }>('POST', `/repos/${this.repo}/git/trees`, {
      base_tree: head.treeSha,
      tree: changes.map((c) => ({ path: c.path, mode: '100644', type: 'blob', sha: c.sha })),
    })
    const commit = await this.req<{ sha: string }>('POST', `/repos/${this.repo}/git/commits`, { message, tree: tree.sha, parents: [head.commitSha] })
    await this.req('PATCH', `/repos/${this.repo}/git/refs/heads/${head.branch}`, { sha: commit.sha })
    return { branch: head.branch, commitSha: commit.sha, treeSha: tree.sha }
  }
}

function humanError(status: number, text: string): string {
  if (status === 401) return 'El token no es válido o ha caducado'
  if (status === 404) return 'No encuentro el repositorio, o el token no tiene acceso a él'
  if (status === 403) return 'GitHub ha rechazado la petición (permisos del token o límite de uso)'
  if (status === 409) return 'Conflicto al guardar en GitHub; se reintentará'
  if (status === 422) return 'GitHub no ha aceptado los datos enviados'
  return `Error de GitHub (${status}) ${text.slice(0, 120)}`
}

/** sha1 de un blob de git ("blob <len>\0<contenido>"), para saber si un archivo cambió sin descargarlo. */
export async function gitBlobSha(bytes: Uint8Array): Promise<string> {
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`)
  const all = new Uint8Array(header.length + bytes.length)
  all.set(header)
  all.set(bytes, header.length)
  const digest = await crypto.subtle.digest('SHA-1', all)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
