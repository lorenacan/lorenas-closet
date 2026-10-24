import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import { processCutout } from './image'

/**
 * Quitar fondo en el propio navegador (modelo ONNX/WASM de @imgly/background-removal).
 * La foto NO se envía a ningún servidor; solo se descarga el modelo la primera vez (~40-80 MB) y queda en caché.
 */
type Listener = () => void
const queue: string[] = []
const active = new Set<string>()
const failed = new Map<string, string>()
const listeners = new Set<Listener>()
const versions = new Map<string, number>()
let running = false

const notify = () => listeners.forEach((l) => l())
export const subscribeCutout = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l) } }
export const cutoutState = (photoId: string): 'pending' | 'failed' | 'idle' =>
  active.has(photoId) ? 'pending' : failed.has(photoId) ? 'failed' : 'idle'
export const cutoutVersion = (photoId?: string) => (photoId ? versions.get(photoId) ?? 0 : 0)
export const cutoutError = (photoId: string) => failed.get(photoId)

export function queueCutout(photoId: string): void {
  if (active.has(photoId)) return
  failed.delete(photoId)
  active.add(photoId)
  queue.push(photoId)
  notify()
  void run()
}

async function run(): Promise<void> {
  if (running) return
  running = true
  while (queue.length) {
    const id = queue.shift()!
    try {
      const photo = await db.photos.get(id)
      if (photo && !photo.cutout) {
        const { removeBackground } = await import('@imgly/background-removal')
        const out = await removeBackground(photo.original, { output: { format: 'image/png' } })
        const { cutout, thumb } = await processCutout(out)
        await db.transaction('rw', db.photos, db.thumbs, async () => {
          await db.photos.update(id, { cutout })
          await db.thumbs.put({ id, blob: thumb, cutout: true })
        })
        versions.set(id, (versions.get(id) ?? 0) + 1)
      }
    } catch (e) {
      failed.set(id, e instanceof Error ? e.message : String(e))
    } finally {
      active.delete(id)
      notify()
    }
  }
  running = false
}

/** Estado reactivo del recorte de una foto: 'pending' mientras se procesa y versión para recargar la imagen al terminar. */
export function useCutout(photoId?: string): { state: 'pending' | 'failed' | 'idle'; version: number; error?: string } {
  const snap = useSyncExternalStore(subscribeCutout, () => `${photoId ? cutoutState(photoId) : 'idle'}|${cutoutVersion(photoId)}`)
  const [state, version] = snap.split('|')
  return { state: state as 'pending' | 'failed' | 'idle', version: Number(version), error: photoId ? cutoutError(photoId) : undefined }
}
