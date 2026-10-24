import { strToU8, strFromU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { db, type GarmentRecord, type LookRecord, type SettingRow } from './db'
import type { Category } from '../catalog/categories'
import { processCutout, processPhoto } from '../lib/image'

const blobToU8 = async (b: Blob) => new Uint8Array(await b.arrayBuffer())

interface Dump {
  version: 1
  exportedAt: string
  garments: GarmentRecord[]
  looks: LookRecord[]
  categories: Category[]
  settings: SettingRow[]
  photos: { id: string; width: number; height: number; hasCutout: boolean }[]
}

/** Copia de seguridad completa en un ZIP: datos (JSON) + fotos originales y recortes. */
export async function exportBackup(): Promise<Blob> {
  const [garments, looks, categories, settings, photos] = await Promise.all([
    db.garments.toArray(), db.looks.toArray(), db.categories.toArray(), db.settings.toArray(), db.photos.toArray(),
  ])
  const files: Zippable = {}
  for (const p of photos) {
    files[`photos/${p.id}.jpg`] = [await blobToU8(p.original), { level: 0 }]
    if (p.cutout) files[`photos/${p.id}.cut.png`] = [await blobToU8(p.cutout), { level: 0 }]
  }
  const dump: Dump = {
    version: 1, exportedAt: new Date().toISOString(), garments, looks, categories, settings,
    photos: photos.map((p) => ({ id: p.id, width: p.width, height: p.height, hasCutout: !!p.cutout })),
  }
  files['data.json'] = strToU8(JSON.stringify(dump))
  return new Blob([zipSync(files) as BlobPart], { type: 'application/zip' })
}

/** Restaura una copia (sustituye los datos actuales). Devuelve nº de prendas. */
export async function importBackup(file: Blob): Promise<number> {
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const raw = zip['data.json']
  if (!raw) throw new Error('El archivo no es una copia de Lorena’s Closet')
  const dump = JSON.parse(strFromU8(raw)) as Dump
  if (dump.version !== 1) throw new Error('Versión de copia no compatible')

  await db.transaction('rw', [db.garments, db.looks, db.categories, db.settings, db.photos, db.thumbs], async () => {
    await Promise.all([db.garments.clear(), db.looks.clear(), db.categories.clear(), db.settings.clear(), db.photos.clear(), db.thumbs.clear()])
    await db.categories.bulkPut(dump.categories)
    await db.garments.bulkPut(dump.garments)
    await db.looks.bulkPut(dump.looks)
    await db.settings.bulkPut(dump.settings)
  })
  for (const p of dump.photos) {
    const orig = zip[`photos/${p.id}.jpg`]
    if (!orig) continue
    const origBlob = new Blob([orig as BlobPart], { type: 'image/jpeg' })
    const base = await processPhoto(origBlob)
    const cutRaw = p.hasCutout ? zip[`photos/${p.id}.cut.png`] : undefined
    if (cutRaw) {
      const cutBlob = new Blob([cutRaw as BlobPart], { type: 'image/png' })
      const { thumb } = await processCutout(cutBlob)
      await db.photos.put({ id: p.id, original: origBlob, cutout: cutBlob, width: p.width, height: p.height })
      await db.thumbs.put({ id: p.id, blob: thumb, cutout: true })
    } else {
      await db.photos.put({ id: p.id, original: origBlob, width: p.width, height: p.height })
      await db.thumbs.put({ id: p.id, blob: base.thumb, cutout: false })
    }
  }
  return dump.garments.length
}

export async function wipeAll(): Promise<void> {
  await Promise.all([db.garments.clear(), db.looks.clear(), db.photos.clear(), db.thumbs.clear(), db.settings.clear()])
}
