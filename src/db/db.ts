import Dexie, { type Table } from 'dexie'
import type { Climate, Fit, Intensity, LengthLevel, Lightness, Occasion, Pattern, Risk, Season, Temp, Weights } from '../engine'
import { SEED_CATEGORIES, type Category } from '../catalog/categories'

export interface GarmentRecord {
  id: string
  name?: string
  photoId?: string
  categoryId: string
  colorHex?: string
  colorName?: string
  secondaryHex: string[]
  colorTemp?: Temp
  intensity?: Intensity
  lightness?: Lightness
  pattern?: Pattern
  /** Afinidad 0..1 por estilo (1 principal, 0.6 secundario). */
  styles: Record<string, number>
  fit?: Fit
  length?: LengthLevel
  fabric?: string
  insulation?: number
  formality?: number
  seasons: Season[]
  status: string
  favorite: boolean
  notes?: string
  wearCount: number
  lastWornAt?: number
  createdAt: number
  updatedAt: number
}

import type { CutBox } from '../lib/image'

export interface PhotoRecord { id: string; original: Blob; cutout?: Blob; width: number; height: number; /** Zona recortada en coordenadas de la original (para retocar). */ cutBox?: CutBox }
/** `rev` sube cada vez que cambia el recorte (lo usa la sincronización). */
export interface ThumbRecord { id: string; blob: Blob; cutout: boolean; rev?: number }

export type LookStatus = 'saved' | 'favorite' | 'discarded'
export interface LookRecord {
  /** Firma del conjunto: un mismo conjunto de prendas es siempre el mismo look. */
  signature: string
  tops: string[]
  bottom?: string
  onepiece?: string
  shoes?: string
  accessories: string[]
  score: number
  notes: string[]
  modules: Record<string, number | null>
  status: LookStatus
  wornCount: number
  createdAt: number
  updatedAt: number
  params?: { layers: number; styles: string[]; climate?: Climate; occasion?: Occasion }
}

export interface SettingRow { key: string; value: unknown }

export interface LastRequest {
  layers: number
  styles: string[]
  climate?: Climate
  occasion?: Occasion
  formality?: number
  preferColors: string[]
  avoidColors: string[]
  mustInclude: string[]
  exclude: string[]
  risk: Risk
  prioritizeUnderused: boolean
  allowOnePieces: boolean
  accessories: number
}

class ClosetDB extends Dexie {
  garments!: Table<GarmentRecord, string>
  photos!: Table<PhotoRecord, string>
  thumbs!: Table<ThumbRecord, string>
  looks!: Table<LookRecord, string>
  categories!: Table<Category, string>
  settings!: Table<SettingRow, string>

  constructor() {
    super('lorenas-closet')
    this.version(1).stores({
      garments: 'id, categoryId, status, favorite, createdAt, wearCount',
      photos: 'id',
      thumbs: 'id',
      looks: 'signature, status, updatedAt',
      categories: 'id, parentId, order',
      settings: 'key',
    })
  }
}

export const db = new ClosetDB()

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}
export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value })

export const WEIGHTS_KEY = 'weights'
export type WeightsSetting = Weights

/** Rellena el catálogo de categorías la primera vez. */
export async function ensureSeed(): Promise<void> {
  if ((await db.categories.count()) === 0) await db.categories.bulkPut(SEED_CATEGORIES)
}

export const uid = () => crypto.randomUUID()
