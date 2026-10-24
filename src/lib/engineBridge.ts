import type { Garment, GenerationRequest, GenerationResult } from '../engine'
import { generateLooks } from '../engine'
import { resolveCategory, type Category } from '../catalog/categories'
import type { GarmentRecord } from '../db/db'

/** Convierte una ficha de la base de datos en la prenda que entiende el motor (o null si su categoría ya no existe). */
export function toEngine(r: GarmentRecord, byId: Map<string, Category>): Garment | null {
  const cat = resolveCategory(r.categoryId, byId)
  if (!cat) return null
  return {
    id: r.id,
    name: r.name,
    kind: cat.kind,
    type: cat.type,
    subtype: cat.subtype,
    colorHex: r.colorHex,
    secondaryHex: r.secondaryHex,
    colorTemp: r.colorTemp,
    intensity: r.intensity,
    lightness: r.lightness,
    pattern: r.pattern,
    styles: Object.keys(r.styles).length ? r.styles : undefined,
    fit: r.fit,
    length: r.length,
    insulation: r.insulation,
    formality: r.formality,
    seasons: r.seasons,
    wearCount: r.wearCount,
  }
}

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, (r: GenerationResult) => void>()

function getWorker(): Worker | null {
  if (worker) return worker
  try {
    worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; result: GenerationResult }>) => {
      pending.get(e.data.id)?.(e.data.result)
      pending.delete(e.data.id)
    }
    worker.onerror = () => { worker = null }
  } catch {
    worker = null
  }
  return worker
}

/** Genera looks en un Web Worker para no bloquear la interfaz (con alternativa en el hilo principal). */
export function generateInWorker(garments: Garment[], req: GenerationRequest): Promise<GenerationResult> {
  const w = getWorker()
  if (!w) return Promise.resolve(generateLooks(garments, req))
  return new Promise((resolve) => {
    const id = ++seq
    pending.set(id, resolve)
    w.postMessage({ id, garments, req })
  })
}
