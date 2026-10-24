import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, uid, type GarmentRecord, type LookRecord, type LookStatus } from './db'
import type { Category } from '../catalog/categories'
import { descendantIds } from '../catalog/categories'
import { processPhoto } from '../lib/image'
import { queueCutout } from '../lib/cutout'

export function useCategories() {
  const list = useLiveQuery(() => db.categories.orderBy('order').toArray(), [], undefined as Category[] | undefined)
  const byId = useMemo(() => new Map((list ?? []).map((c) => [c.id, c])), [list])
  return { list: list ?? [], byId, ready: list !== undefined }
}

export function useGarments() {
  return useLiveQuery(() => db.garments.orderBy('createdAt').reverse().toArray(), [], undefined as GarmentRecord[] | undefined)
}

export function useGarment(id: string | undefined) {
  return useLiveQuery(() => (id ? db.garments.get(id) : undefined), [id])
}

export function useLooks() {
  return useLiveQuery(() => db.looks.orderBy('updatedAt').reverse().toArray(), [], undefined as LookRecord[] | undefined)
}

export function blankGarment(categoryId: string): GarmentRecord {
  const now = Date.now()
  return {
    id: uid(), categoryId, secondaryHex: [], styles: {}, seasons: [], status: 'closet', favorite: false,
    wearCount: 0, createdAt: now, updatedAt: now,
  }
}

/** Guarda una prenda; si hay foto nueva la procesa y lanza el recorte de fondo en segundo plano. */
export async function saveGarment(rec: GarmentRecord, newPhoto?: Blob, removeBg = true): Promise<void> {
  const next = { ...rec, updatedAt: Date.now() }
  if (newPhoto) {
    const p = await processPhoto(newPhoto)
    const photoId = uid()
    await db.transaction('rw', db.photos, db.thumbs, async () => {
      await db.photos.put({ id: photoId, original: p.original, width: p.width, height: p.height })
      await db.thumbs.put({ id: photoId, blob: p.thumb, cutout: false })
    })
    const old = rec.photoId
    next.photoId = photoId
    if (old) await deletePhoto(old)
    if (removeBg) queueCutout(photoId)
  }
  await db.garments.put(next)
}

export async function deletePhoto(id: string) {
  await db.transaction('rw', db.photos, db.thumbs, async () => {
    await db.photos.delete(id)
    await db.thumbs.delete(id)
  })
}

/** Looks guardados que usan una prenda. */
export async function looksUsing(garmentId: string): Promise<LookRecord[]> {
  const all = await db.looks.toArray()
  return all.filter((l) => lookIds(l).includes(garmentId))
}

export async function deleteGarment(id: string) {
  const g = await db.garments.get(id)
  const affected = await looksUsing(id)
  await db.transaction('rw', db.garments, db.looks, async () => {
    await db.garments.delete(id)
    await db.looks.bulkDelete(affected.map((l) => l.signature))
  })
  if (g?.photoId) await deletePhoto(g.photoId)
}

export const lookIds = (l: Pick<LookLike, 'tops' | 'bottom' | 'onepiece' | 'shoes' | 'accessories'>): string[] =>
  [...(l.onepiece ? [l.onepiece] : []), ...l.tops, ...(l.bottom ? [l.bottom] : []), ...(l.shoes ? [l.shoes] : []), ...l.accessories]

/** Forma mínima de un look para guardarlo (vale tanto el del motor como uno ya guardado). */
export interface LookLike {
  signature: string
  tops: string[]
  bottom?: string
  onepiece?: string
  shoes?: string
  accessories: string[]
  score: number
  notes: string[]
  modules: Record<string, number | null | { score: number | null }>
}

export async function setLookStatus(look: LookLike, status: LookStatus, params?: LookRecord['params']) {
  const existing = await db.looks.get(look.signature)
  const now = Date.now()
  const modules: Record<string, number | null> = {}
  for (const [k, v] of Object.entries(look.modules)) modules[k] = v !== null && typeof v === 'object' ? v.score : v
  await db.looks.put({
    signature: look.signature, tops: look.tops, bottom: look.bottom, onepiece: look.onepiece, shoes: look.shoes,
    accessories: look.accessories, score: look.score, notes: look.notes, modules,
    status, wornCount: existing?.wornCount ?? 0, createdAt: existing?.createdAt ?? now, updatedAt: now,
    params: params ?? existing?.params,
  })
}

export const removeLook = (signature: string) => db.looks.delete(signature)

/** Registra que te has puesto un look: suma uso a cada prenda. */
export async function markWorn(look: Pick<LookLike, 'signature' | 'tops' | 'bottom' | 'onepiece' | 'shoes' | 'accessories'>) {
  const ids = lookIds(look)
  const now = Date.now()
  await db.transaction('rw', db.garments, db.looks, async () => {
    for (const id of ids) {
      const g = await db.garments.get(id)
      if (g) await db.garments.update(id, { wearCount: g.wearCount + 1, lastWornAt: now })
    }
    const l = await db.looks.get(look.signature)
    if (l) await db.looks.update(look.signature, { wornCount: l.wornCount + 1, updatedAt: now })
  })
}

export async function countGarmentsIn(categoryId: string): Promise<number> {
  const all = await db.categories.toArray()
  const ids = descendantIds(categoryId, all)
  return db.garments.where('categoryId').anyOf(ids).count()
}
