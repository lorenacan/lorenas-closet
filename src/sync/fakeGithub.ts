import { createHash } from 'node:crypto'

/** GitHub simulado en memoria con los endpoints de la Git Data API que usa la app (solo para tests). */
export function fakeGithub(opts: { empty?: boolean; failFirstPostWith429?: boolean } = {}) {
  const blobs = new Map<string, Uint8Array>()
  const trees = new Map<string, Map<string, string>>()
  const commits = new Map<string, { tree: string }>()
  let head: string | null = null
  let n = 0
  const log: string[] = []
  let throttled = !!opts.failFirstPostWith429
  const sha = (b: Uint8Array) => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex')
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

  function addBlob(b: Uint8Array) { const s = sha(b); blobs.set(s, b); return s }
  function newCommit(tree: Map<string, string>) {
    const tsha = `tree${++n}`
    trees.set(tsha, tree)
    const csha = `commit${n}`
    commits.set(csha, { tree: tsha })
    head = csha
    return { tsha, csha }
  }
  if (!opts.empty) newCommit(new Map([['README.md', addBlob(new TextEncoder().encode('hola'))]]))

  const fetchFn: typeof fetch = async (input, init) => {
    const url = new URL(String(input))
    const path = url.pathname.replace('/repos/o/r', '')
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    log.push(`${method} ${path}`)
    if (method === 'POST' && throttled) { throttled = false; return new Response('secondary rate limit', { status: 403, headers: { 'retry-after': '1' } }) }
    if (path === '' && method === 'GET') return json({ default_branch: 'main', private: true, permissions: { push: true } })
    if (path === '/git/ref/heads/main') return head ? json({ object: { sha: head } }) : json({ message: 'Git Repository is empty.' }, 409)
    if (path.startsWith('/git/commits/') && method === 'GET') return json({ tree: { sha: commits.get(path.split('/').pop()!)!.tree } })
    if (path === '/contents/README.md' && method === 'PUT') {
      newCommit(new Map([['README.md', addBlob(Buffer.from(body.content, 'base64'))]]))
      return json({}, 201)
    }
    if (path.startsWith('/git/trees/') && method === 'GET') {
      const t = trees.get(path.split('/').pop()!)!
      return json({ truncated: false, tree: [...t].map(([p, s]) => ({ path: p, sha: s, type: 'blob' })) })
    }
    if (path === '/git/blobs' && method === 'POST') return json({ sha: addBlob(Buffer.from(body.content, 'base64')) }, 201)
    if (path.startsWith('/git/blobs/') && method === 'GET') {
      const b = blobs.get(path.split('/').pop()!)
      return b ? json({ content: Buffer.from(b).toString('base64'), encoding: 'base64' }) : json({}, 404)
    }
    if (path === '/git/trees' && method === 'POST') {
      const base = new Map(trees.get(body.base_tree)!)
      for (const e of body.tree) e.sha === null ? base.delete(e.path) : base.set(e.path, e.sha)
      const tsha = `tree${++n}`
      trees.set(tsha, base)
      return json({ sha: tsha }, 201)
    }
    if (path === '/git/commits' && method === 'POST') {
      const csha = `commit${++n}`
      commits.set(csha, { tree: body.tree })
      return json({ sha: csha }, 201)
    }
    if (path === '/git/refs/heads/main' && method === 'PATCH') { head = body.sha; return json({}) }
    return json({ message: `no implementado: ${method} ${path}` }, 404)
  }

  return {
    fetch: fetchFn,
    log,
    files: () => (head ? new Map(trees.get(commits.get(head)!.tree)!) : new Map<string, string>()),
    read: (path: string) => { const s = (head ? trees.get(commits.get(head)!.tree)! : new Map()).get(path); return s ? Buffer.from(blobs.get(s)!).toString() : undefined },
    commitCount: () => commits.size,
  }
}
