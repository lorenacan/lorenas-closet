import { db, getSetting, setSetting, WEIGHTS_KEY, type GarmentRecord, type LookRecord } from '../db/db'
import type { Category } from '../catalog/categories'
import { gitBlobSha, type Change, type GitHubApi } from './github'
import { planSync } from './plan'
import { withoutSync } from './guard'

export const MANIFEST_KEY = 'syncManifest'
export const SYNC_KEYS = ['sync', MANIFEST_KEY]
const CHUNK = 50
const enc = new TextEncoder()
const dec = new TextDecoder()

export interface SyncDeps {
  api: GitHubApi
  /** Genera la miniatura de una foto traída de GitHub. */
  makeThumb: (blob: Blob, isCutout: boolean) => Promise<Blob>
  onProgress?: (message: string, done?: number, total?: number) => void
}
export interface SyncResult { uploaded: number; pulled: number; deleted: number }

/** JSON con las claves ordenadas: el mismo dato produce siempre los mismos bytes. */
export function canon(v: unknown): string {
  const norm = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(norm)
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x as object).filter(([, val]) => val !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, val]) => [k, norm(val)]))
    return x
  }
  return JSON.stringify(norm(v))
}

async function sha1Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-1', enc.encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
}

const garmentPath = (id: string) => `data/garments/${id}.json`
const CATS = 'data/categories.json'
const SETTINGS = 'data/settings.json'

interface LocalFile { bytes: Uint8Array; sha: string }

async function localSnapshot() {
  const files = new Map<string, LocalFile>()
  const lookSig = new Map<string, string>()
  const garmentIds = new Map<string, string>()
  const add = async (path: string, value: unknown) => {
    const bytes = enc.encode(canon(value))
    files.set(path, { bytes, sha: await gitBlobSha(bytes) })
  }
  for (const g of await db.garments.toArray()) { await add(garmentPath(g.id), g); garmentIds.set(garmentPath(g.id), g.id) }
  for (const l of await db.looks.toArray()) {
    const p = `data/looks/${await sha1Hex(l.signature)}.json`
    await add(p, l)
    lookSig.set(p, l.signature)
  }
  await add(CATS, (await db.categories.toArray()).sort((a, b) => a.order - b.order))
  const weights = await getSetting<unknown>(WEIGHTS_KEY, null)
  if (weights) await add(SETTINGS, { weights })
  return { files, lookSig, garmentIds }
}

const photoIdOf = (path: string) => /^photos\/(.+?)(\.cut\.png|\.jpg)$/.exec(path)?.[1]

export async function syncOnce(deps: SyncDeps): Promise<SyncResult> {
  const { api, onProgress } = deps
  const result: SyncResult = { uploaded: 0, pulled: 0, deleted: 0 }
  onProgress?.('Conectando con GitHub…')
  let head = await api.ensureHead()
  const remoteAll = await api.getTree(head.treeSha)
  const remoteData = new Map([...remoteAll].filter(([p]) => p.startsWith('data/')))

  const snap = await localSnapshot()
  const manifest = await getSetting<Record<string, string>>(MANIFEST_KEY, {})
  const newManifest = { ...manifest }
  const localSha = new Map([...snap.files].map(([p, f]) => [p, f.sha]))
  const plan = planSync(localSha, remoteData, manifest)

  for (const p of plan.same) newManifest[p] = localSha.get(p)!

  // Conflictos: gana la edición más reciente (fichas y looks); categorías y ajustes, lo remoto si nunca se sincronizó
  const cache = new Map<string, Uint8Array>()
  const fetchRemote = async (p: string) => {
    if (!cache.has(p)) cache.set(p, await api.getBlob(remoteData.get(p)!))
    return cache.get(p)!
  }
  const upload = new Set(plan.upload)
  const pull = new Set(plan.pull)
  for (const p of plan.conflicts) {
    if (p.startsWith('data/garments/') || p.startsWith('data/looks/')) {
      const remote = JSON.parse(dec.decode(await fetchRemote(p))) as { updatedAt?: number }
      const local = JSON.parse(dec.decode(snap.files.get(p)!.bytes)) as { updatedAt?: number }
      ;((remote.updatedAt ?? 0) > (local.updatedAt ?? 0) ? pull : upload).add(p)
    } else (manifest[p] === undefined ? pull : upload).add(p)
  }

  // 1) Traer lo remoto
  const removedPhotoIds = new Set<string>()
  await withoutSync(async () => {
    let i = 0
    for (const p of pull) {
      onProgress?.('Descargando datos…', ++i, pull.size)
      const bytes = await fetchRemote(p)
      const value = JSON.parse(dec.decode(bytes))
      if (p.startsWith('data/garments/')) await db.garments.put(value as GarmentRecord)
      else if (p.startsWith('data/looks/')) await db.looks.put(value as LookRecord)
      else if (p === CATS) { await db.categories.clear(); await db.categories.bulkPut(value as Category[]) }
      else if (p === SETTINGS) await setSetting(WEIGHTS_KEY, value.weights)
      newManifest[p] = remoteData.get(p)!
      result.pulled++
    }
    for (const p of plan.deleteLocal) {
      if (p.startsWith('data/garments/')) {
        const id = snap.garmentIds.get(p)
        const g = id ? await db.garments.get(id) : undefined
        if (g?.photoId) removedPhotoIds.add(g.photoId)
        if (id) await db.garments.delete(id)
      } else if (p.startsWith('data/looks/')) {
        const sig = snap.lookSig.get(p)
        if (sig) await db.looks.delete(sig)
      }
      delete newManifest[p]
      result.deleted++
    }
  })

  // 2) Fotos: traer las que faltan, y calcular cuáles subir o borrar
  const garments = await db.garments.toArray()
  const referenced = new Set(garments.map((g) => g.photoId).filter((x): x is string => !!x))
  const remotePhotos = new Map<string, { jpg?: string; cut?: string }>()
  for (const [p, sha] of remoteAll) {
    const id = photoIdOf(p)
    if (!id) continue
    const e = remotePhotos.get(id) ?? {}
    if (p.endsWith('.cut.png')) e.cut = sha
    else e.jpg = sha
    remotePhotos.set(id, e)
  }
  const localPhotos = new Map<string, boolean>()
  await db.thumbs.each((t) => { localPhotos.set(t.id, t.cutout) })

  await withoutSync(async () => {
    for (const id of referenced) {
      const r = remotePhotos.get(id)
      if (!r) continue
      const has = localPhotos.has(id)
      if (!has && r.jpg) {
        onProgress?.('Descargando fotos…')
        const original = new Blob([await api.getBlob(r.jpg) as BlobPart], { type: 'image/jpeg' })
        const cutout = r.cut ? new Blob([await api.getBlob(r.cut) as BlobPart], { type: 'image/png' }) : undefined
        const thumb = await deps.makeThumb(cutout ?? original, !!cutout)
        await db.photos.put({ id, original, cutout, width: 0, height: 0 })
        await db.thumbs.put({ id, blob: thumb, cutout: !!cutout })
        localPhotos.set(id, !!cutout)
        newManifest[`photos/${id}.jpg`] = r.jpg
        if (r.cut) newManifest[`photos/${id}.cut.png`] = r.cut
        result.pulled++
      } else if (has && !localPhotos.get(id) && r.cut) {
        const cutout = new Blob([await api.getBlob(r.cut) as BlobPart], { type: 'image/png' })
        await db.photos.update(id, { cutout })
        await db.thumbs.put({ id, blob: await deps.makeThumb(cutout, true), cutout: true })
        localPhotos.set(id, true)
        newManifest[`photos/${id}.cut.png`] = r.cut
        result.pulled++
      }
    }
  })

  // 3) Subidas (fotos primero, luego datos) y borrados remotos, en lotes con un commit cada uno
  interface Job { path: string; load: () => Promise<Uint8Array> }
  const jobs: Job[] = []
  const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer())
  for (const [id, hasCut] of localPhotos) {
    const r = remotePhotos.get(id)
    if (!referenced.has(id) && !removedPhotoIds.has(id)) continue
    if (!r?.jpg && !removedPhotoIds.has(id)) jobs.push({ path: `photos/${id}.jpg`, load: async () => bytesOf((await db.photos.get(id))!.original) })
    if (hasCut && !r?.cut && !removedPhotoIds.has(id)) jobs.push({ path: `photos/${id}.cut.png`, load: async () => bytesOf((await db.photos.get(id))!.cutout!) })
  }
  for (const p of upload) jobs.push({ path: p, load: async () => snap.files.get(p)!.bytes })

  const deletions: string[] = [...plan.deleteRemote]
  for (const [id, r] of remotePhotos) {
    if (referenced.has(id)) continue
    for (const [ext, sha] of [['.jpg', r.jpg], ['.cut.png', r.cut]] as const) {
      const p = `photos/${id}${ext}`
      if (sha && newManifest[p] !== undefined) deletions.push(p)
    }
  }
  for (const id of removedPhotoIds) {
    await db.photos.delete(id)
    await db.thumbs.delete(id)
  }

  const total = jobs.length
  let done = 0
  const persist = () => setSetting(MANIFEST_KEY, newManifest)
  const chunks: Job[][] = []
  for (let i = 0; i < jobs.length; i += CHUNK) chunks.push(jobs.slice(i, i + CHUNK))
  if (!chunks.length && deletions.length) chunks.push([])
  for (let c = 0; c < chunks.length; c++) {
    const changes: Change[] = []
    for (const job of chunks[c]) {
      const sha = await api.createBlob(await job.load())
      changes.push({ path: job.path, sha })
      onProgress?.('Subiendo a GitHub…', ++done, total)
    }
    if (c === 0) for (const p of deletions) changes.push({ path: p, sha: null })
    if (!changes.length) continue
    head = await api.commit(head, changes, `Sincroniza armario (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`)
    for (const ch of changes) {
      if (ch.sha === null) { delete newManifest[ch.path]; result.deleted++ }
      else { newManifest[ch.path] = ch.sha; result.uploaded++ }
    }
    await persist()
  }
  await persist()
  onProgress?.('Listo')
  return result
}
