/**
 * Tipos públicos del motor. El motor NO depende de React, del DOM ni de la
 * base de datos: recibe prendas y una petición, y devuelve looks puntuados.
 */

export type Kind = 'top' | 'bottom' | 'onepiece' | 'shoes' | 'accessory'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type Climate = 'hot' | 'warm' | 'mild' | 'cool' | 'cold'
export type Temp = 'warm' | 'cool' | 'neutral'
export type Intensity = 'muted' | 'medium' | 'vivid'
export type Lightness = 'light' | 'medium' | 'dark'
export type LengthLevel = 'cropped' | 'hip' | 'mid-thigh' | 'knee' | 'long'
export type Fit = 'fitted' | 'slim' | 'regular' | 'straight' | 'wide' | 'oversize'
export type Pattern = 'solid' | 'stripes' | 'checks' | 'floral' | 'graphic' | 'animal' | 'dots' | 'other'
export type Risk = 'simple' | 'balanced' | 'bold'

export interface LayerProfile {
  /** Rango de "exterioridad" (1 = contra la piel ... 5 = abrigo exterior). */
  rankMin: number
  rankMax: number
  /** Puede llevarse abierta (camisa, blazer, cárdigan...). */
  canBeOpen: boolean
  /** Volumen 0 (muy fino) a 3 (voluminoso). */
  volume: number
  /** Sin mangas: no se le exige volumen compatible con lo de debajo. */
  sleeveless?: boolean
}

/** Prenda tal como la entiende el motor. Casi todo es opcional: se completa con valores por defecto del tipo. */
export interface Garment {
  id: string
  name?: string
  kind: Kind
  /** Clave del tipo base: camiseta, blazer, pantalon, falda, zapato, bolso... */
  type: string
  subtype?: string
  colorHex?: string
  secondaryHex?: string[]
  colorTemp?: Temp
  intensity?: Intensity
  lightness?: Lightness
  pattern?: Pattern
  /** Afinidad 0..1 con cada estilo. */
  styles?: Record<string, number>
  fit?: Fit
  length?: LengthLevel
  /** Nivel de abrigo 0..4. */
  insulation?: number
  /** Formalidad 0 (deportivo) a 4 (formal). */
  formality?: number
  seasons?: Season[]
  layer?: Partial<LayerProfile>
  /** Veces que se ha puesto (para priorizar poco usadas). */
  wearCount?: number
}

export interface GenerationRequest {
  /** Capas en la parte superior (1-5). Con vestido/mono, este cuenta como la primera capa. */
  layers: number
  styles?: string[]
  climate?: Climate
  occasion?: Occasion
  /** 0..4. Si se indica, prevalece sobre la ocasión. */
  formality?: number
  preferColors?: string[]
  avoidColors?: string[]
  mustInclude?: string[]
  exclude?: string[]
  risk?: Risk
  prioritizeUnderused?: boolean
  allowOnePieces?: boolean
  /** Nº de accesorios a intentar añadir (0-3). */
  accessories?: number
  /** Nº de looks a devolver. */
  count?: number
  seed?: number
  /** Firmas de looks ya vistos/descartados, que no deben repetirse. */
  excludeSignatures?: string[]
  weights?: Partial<Weights>
  /** Máx. de veces que una misma prenda aparece en el lote. */
  maxReuse?: number
}

export type Occasion = 'diario' | 'trabajo' | 'evento' | 'salir' | 'deporte'

export interface Weights {
  color: number
  style: number
  silhouette: number
  occasion: number
}

export interface ModuleResult {
  /** 0..1 o null si el módulo no aplica (se excluye y se reponderan los demás). */
  score: number | null
  notes: string[]
}

export interface Look {
  /** Capas superiores de dentro (base) hacia fuera. */
  tops: string[]
  bottom?: string
  onepiece?: string
  shoes?: string
  accessories: string[]
  /** 0..100 */
  score: number
  modules: { color: ModuleResult; style: ModuleResult; silhouette: ModuleResult; occasion: ModuleResult }
  notes: string[]
  signature: string
}

export interface GenerationResult {
  looks: Look[]
  /** Motivos legibles cuando no se puede generar (o hay menos looks de los pedidos). */
  diagnostics: string[]
}
