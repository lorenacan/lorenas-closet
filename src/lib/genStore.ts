import { useSyncExternalStore } from 'react'
import { db, getSetting, WEIGHTS_KEY, type LastRequest } from '../db/db'
import type { Look, Weights } from '../engine'
import { generateInWorker, toEngine } from './engineBridge'
import type { Garment } from '../engine'

const LS_KEY = 'lc:lastRequest'

export const DEFAULT_REQUEST: LastRequest = {
  layers: 2, styles: [], preferColors: [], avoidColors: [], mustInclude: [], exclude: [],
  risk: 'balanced', prioritizeUnderused: false, allowOnePieces: true, accessories: 1,
}

function loadRequest(): LastRequest {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...DEFAULT_REQUEST, ...JSON.parse(raw) }
  } catch { /* sin almacenamiento local: se usan los valores por defecto */ }
  return DEFAULT_REQUEST
}

interface State {
  request: LastRequest
  running: boolean
  looks: Look[]
  diagnostics: string[]
  hasRun: boolean
  /** Firmas ya mostradas en esta tanda de regeneraciones. */
  seen: string[]
}

let state: State = { request: loadRequest(), running: false, looks: [], diagnostics: [], hasRun: false, seen: [] }
const listeners = new Set<() => void>()
const emit = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()) }

export const useGen = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => state)

export function setRequest(patch: Partial<LastRequest>) {
  const request = { ...state.request, ...patch }
  emit({ request })
  try { localStorage.setItem(LS_KEY, JSON.stringify(request)) } catch { /* ignorar */ }
}

/** Quita un look de la lista de resultados actual (descartado o ya gestionado). */
export function dropFromResults(signature: string) {
  emit({ looks: state.looks.filter((l) => l.signature !== signature) })
}

/** Genera una tanda. `regenerate` evita repetir lo ya mostrado; si no, empieza de cero. */
export async function runGeneration(regenerate: boolean): Promise<void> {
  if (state.running) return
  emit({ running: true })
  try {
    const [cats, recs, storedLooks, weights] = await Promise.all([
      db.categories.toArray(), db.garments.toArray(), db.looks.toArray(),
      getSetting<Weights | null>(WEIGHTS_KEY, null),
    ])
    const byId = new Map(cats.map((c) => [c.id, c]))
    const garments = recs.filter((r) => r.status === 'closet').map((r) => toEngine(r, byId)).filter((g): g is Garment => !!g)
    const r = state.request
    const seen = regenerate ? state.seen : []
    const result = await generateInWorker(garments, {
      layers: r.layers,
      styles: r.styles,
      climate: r.climate,
      occasion: r.occasion,
      formality: r.formality,
      preferColors: r.preferColors,
      avoidColors: r.avoidColors,
      mustInclude: r.mustInclude,
      exclude: r.exclude,
      risk: r.risk,
      prioritizeUnderused: r.prioritizeUnderused,
      allowOnePieces: r.allowOnePieces,
      accessories: r.accessories,
      weights: weights ?? undefined,
      count: 8,
      seed: Math.floor(Math.random() * 2 ** 31),
      excludeSignatures: [...storedLooks.map((l) => l.signature), ...seen],
    })
    emit({
      running: false, hasRun: true, looks: result.looks, diagnostics: result.diagnostics,
      seen: [...seen, ...result.looks.map((l) => l.signature)],
    })
  } catch (e) {
    emit({ running: false, hasRun: true, looks: [], diagnostics: [`Error al generar: ${e instanceof Error ? e.message : String(e)}`] })
  }
}
