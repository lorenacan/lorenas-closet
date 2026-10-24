import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSeed, type GarmentRecord } from '../db/db'
import { GitHubApi } from './github'
import { MANIFEST_KEY, syncOnce } from './engine'
import { fakeGithub } from './fakeGithub'

const garment = (id: string, over: Partial<GarmentRecord> = {}): GarmentRecord => ({
  id, categoryId: 'camiseta', secondaryHex: [], styles: {}, seasons: [], status: 'closet', favorite: false,
  wearCount: 0, createdAt: 1, updatedAt: 1, colorHex: '#111111', ...over,
})
const photo = (text: string) => new Blob([text], { type: 'image/jpeg' })

async function wipeLocal() {
  await Promise.all([db.garments.clear(), db.looks.clear(), db.photos.clear(), db.thumbs.clear(), db.settings.clear(), db.categories.clear()])
}
const mk = (gh: ReturnType<typeof fakeGithub>) =>
  ({ api: new GitHubApi('o/r', 'tok', { fetch: gh.fetch, sleep: async () => {} }), makeThumb: async (b: Blob) => b })

beforeEach(async () => { await wipeLocal(); await ensureSeed() })

describe('sincronización con GitHub', () => {
  it('primera sincronización: sube fichas, fotos, looks y categorías en un repo vacío', async () => {
    const gh = fakeGithub({ empty: true })
    await db.photos.put({ id: 'p1', original: photo('ORIG'), width: 1, height: 1 })
    await db.thumbs.put({ id: 'p1', blob: photo('T'), cutout: false })
    await db.garments.bulkPut([garment('g1', { photoId: 'p1', name: 'Camiseta' }), garment('g2')])
    await db.looks.put({ signature: 'g1|g2', tops: ['g1'], accessories: [], score: 80, notes: [], modules: {}, status: 'saved', wornCount: 0, createdAt: 1, updatedAt: 1 })
    const r = await syncOnce(mk(gh))
    const files = [...gh.files().keys()]
    expect(files).toContain('data/garments/g1.json')
    expect(files).toContain('data/garments/g2.json')
    expect(files).toContain('photos/p1.jpg')
    expect(files).toContain('data/categories.json')
    expect(files.filter((f) => f.startsWith('data/looks/'))).toHaveLength(1)
    expect(JSON.parse(gh.read('data/garments/g1.json')!).name).toBe('Camiseta')
    expect(gh.read('photos/p1.jpg')).toBe('ORIG')
    expect(r.uploaded).toBeGreaterThanOrEqual(5)
  })

  it('segunda sincronización sin cambios no crea commits', async () => {
    const gh = fakeGithub()
    await db.garments.put(garment('g1'))
    await syncOnce(mk(gh))
    const before = gh.commitCount()
    const r = await syncOnce(mk(gh))
    expect(r).toEqual({ uploaded: 0, pulled: 0, deleted: 0 })
    expect(gh.commitCount()).toBe(before)
  })

  it('un cambio local se sube; un borrado local se borra en GitHub (con su foto)', async () => {
    const gh = fakeGithub()
    await db.photos.put({ id: 'p1', original: photo('ORIG'), width: 1, height: 1 })
    await db.thumbs.put({ id: 'p1', blob: photo('T'), cutout: false })
    await db.garments.bulkPut([garment('g1', { photoId: 'p1' }), garment('g2')])
    await syncOnce(mk(gh))
    await db.garments.update('g2', { name: 'Nueva', updatedAt: 5 })
    await syncOnce(mk(gh))
    expect(JSON.parse(gh.read('data/garments/g2.json')!).name).toBe('Nueva')
    await db.garments.delete('g1')
    await db.photos.delete('p1')
    await db.thumbs.delete('p1')
    await syncOnce(mk(gh))
    expect(gh.files().has('data/garments/g1.json')).toBe(false)
    expect(gh.files().has('photos/p1.jpg')).toBe(false)
    expect(gh.files().has('data/garments/g2.json')).toBe(true)
  })

  it('dispositivo nuevo: restaura todo (fichas, fotos, recortes) sin borrar nada en GitHub', async () => {
    const gh = fakeGithub()
    await db.photos.put({ id: 'p1', original: photo('ORIG'), cutout: new Blob(['CUT'], { type: 'image/png' }), width: 1, height: 1 })
    await db.thumbs.put({ id: 'p1', blob: photo('T'), cutout: true })
    await db.garments.bulkPut([garment('g1', { photoId: 'p1', name: 'Vestido' }), garment('g2')])
    await syncOnce(mk(gh))
    const remoteBefore = [...gh.files().keys()].sort()
    expect(remoteBefore).toContain('photos/p1.cut.png')

    await wipeLocal() // “móvil nuevo”: sin datos ni manifiesto
    await ensureSeed()
    await syncOnce(mk(gh))
    expect((await db.garments.toArray()).map((g) => g.id).sort()).toEqual(['g1', 'g2'])
    expect((await db.garments.get('g1'))!.name).toBe('Vestido')
    const p = await db.photos.get('p1')
    expect(await p!.original.text()).toBe('ORIG')
    expect(await p!.cutout!.text()).toBe('CUT')
    expect((await db.thumbs.get('p1'))!.cutout).toBe(true)
    expect([...gh.files().keys()].sort()).toEqual(remoteBefore)
  })

  it('borrado en otro dispositivo se propaga aquí, pero lo no sincronizado nunca se borra', async () => {
    const gh = fakeGithub()
    await db.garments.bulkPut([garment('g1'), garment('g2')])
    await syncOnce(mk(gh))
    // otro dispositivo borra g1 en GitHub
    const api = new GitHubApi('o/r', 't', { fetch: gh.fetch, sleep: async () => {} })
    const head = await api.ensureHead()
    await api.commit(head, [{ path: 'data/garments/g1.json', sha: null }], 'borra g1')
    await db.garments.put(garment('g3')) // nueva y aún sin sincronizar
    await syncOnce(mk(gh))
    expect((await db.garments.toArray()).map((g) => g.id).sort()).toEqual(['g2', 'g3'])
    expect(gh.files().has('data/garments/g3.json')).toBe(true)
  })

  it('conflicto: gana la edición más reciente', async () => {
    const gh = fakeGithub()
    await db.garments.put(garment('g1', { name: 'A', updatedAt: 10 }))
    await syncOnce(mk(gh))
    // edición remota más reciente
    const api = new GitHubApi('o/r', 't', { fetch: gh.fetch, sleep: async () => {} })
    const head = await api.ensureHead()
    const remote = { ...JSON.parse(gh.read('data/garments/g1.json')!), name: 'REMOTA', updatedAt: 99 }
    const sha = await api.createBlob(new TextEncoder().encode(JSON.stringify(remote)))
    await api.commit(head, [{ path: 'data/garments/g1.json', sha }], 'edita')
    await db.garments.update('g1', { name: 'LOCAL', updatedAt: 50 })
    await syncOnce(mk(gh))
    expect((await db.garments.get('g1'))!.name).toBe('REMOTA')
  })

  it('reintenta cuando GitHub limita las peticiones', async () => {
    const gh = fakeGithub({ failFirstPostWith429: true })
    await db.garments.put(garment('g1'))
    await syncOnce(mk(gh))
    expect(gh.files().has('data/garments/g1.json')).toBe(true)
  })

  it('el manifiesto no contiene el token ni se sube a GitHub', async () => {
    const gh = fakeGithub()
    await db.garments.put(garment('g1'))
    await syncOnce(mk(gh))
    expect([...gh.files().keys()].some((p) => p.includes('sync') || p.includes('token'))).toBe(false)
    expect(await db.settings.get(MANIFEST_KEY)).toBeDefined()
  })
})
