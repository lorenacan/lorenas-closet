import type { Climate, Fit, Kind, LayerProfile, LengthLevel, Occasion, Weights } from '../types'

export const DEFAULT_WEIGHTS: Weights = { color: 0.35, style: 0.25, silhouette: 0.25, occasion: 0.15 }

export const STYLES = [
  'casual', 'smart_casual', 'urbano', 'streetwear', 'deportivo', 'minimalista',
  'clasico', 'elegante', 'formal', 'preppy', 'alternativo',
] as const

export const STYLE_LABELS: Record<string, string> = {
  casual: 'Casual', smart_casual: 'Smart casual', urbano: 'Urbano', streetwear: 'Streetwear',
  deportivo: 'Deportivo', minimalista: 'Minimalista', clasico: 'Clásico', elegante: 'Elegante',
  formal: 'Formal', preppy: 'Preppy', alternativo: 'Alternativo',
}

/** Afinidad entre estilos (simétrica). Lo no listado vale STYLE_DEFAULT_AFFINITY. */
const PAIRS: Record<string, number> = {
  'casual|smart_casual': 0.9, 'casual|urbano': 0.8, 'casual|streetwear': 0.65, 'casual|deportivo': 0.65,
  'casual|minimalista': 0.75, 'casual|clasico': 0.55, 'casual|elegante': 0.3, 'casual|formal': 0.2,
  'casual|preppy': 0.75, 'casual|alternativo': 0.5,
  'smart_casual|urbano': 0.65, 'smart_casual|streetwear': 0.4, 'smart_casual|deportivo': 0.35,
  'smart_casual|minimalista': 0.8, 'smart_casual|clasico': 0.85, 'smart_casual|elegante': 0.75,
  'smart_casual|formal': 0.6, 'smart_casual|preppy': 0.85, 'smart_casual|alternativo': 0.4,
  'urbano|streetwear': 0.9, 'urbano|deportivo': 0.7, 'urbano|minimalista': 0.65, 'urbano|clasico': 0.35,
  'urbano|elegante': 0.3, 'urbano|formal': 0.15, 'urbano|preppy': 0.4, 'urbano|alternativo': 0.65,
  'streetwear|deportivo': 0.75, 'streetwear|minimalista': 0.4, 'streetwear|clasico': 0.2,
  'streetwear|elegante': 0.2, 'streetwear|formal': 0.1, 'streetwear|preppy': 0.3, 'streetwear|alternativo': 0.7,
  'deportivo|minimalista': 0.5, 'deportivo|clasico': 0.15, 'deportivo|elegante': 0.1, 'deportivo|formal': 0.05,
  'deportivo|preppy': 0.3, 'deportivo|alternativo': 0.35,
  'minimalista|clasico': 0.8, 'minimalista|elegante': 0.8, 'minimalista|formal': 0.65,
  'minimalista|preppy': 0.55, 'minimalista|alternativo': 0.5,
  'clasico|elegante': 0.9, 'clasico|formal': 0.85, 'clasico|preppy': 0.8, 'clasico|alternativo': 0.2,
  'elegante|formal': 0.9, 'elegante|preppy': 0.55, 'elegante|alternativo': 0.35,
  'formal|preppy': 0.5, 'formal|alternativo': 0.1, 'preppy|alternativo': 0.2,
}
export const STYLE_DEFAULT_AFFINITY = 0.35

export function styleAffinity(a: string, b: string): number {
  if (a === b) return 1
  return PAIRS[`${a}|${b}`] ?? PAIRS[`${b}|${a}`] ?? STYLE_DEFAULT_AFFINITY
}

export const LENGTH_ORDER: LengthLevel[] = ['cropped', 'hip', 'mid-thigh', 'knee', 'long']
export const lengthValue = (l: LengthLevel): number => LENGTH_ORDER.indexOf(l) + 1

/** Anchura visual de la prenda: 0 muy ajustada ... 4 oversize. */
export const FIT_WIDTH: Record<Fit, number> = { fitted: 0, slim: 1, regular: 2, straight: 2, wide: 3, oversize: 4 }

export const MAX_RANK = 5

/** Abrigo total objetivo por clima [mín, máx]. */
export const CLIMATE_TARGET: Record<Climate, [number, number]> = {
  hot: [0.4, 2], warm: [1.5, 3.5], mild: [3, 5.5], cool: [5, 7.5], cold: [7, 11],
}
export const CLIMATE_SEASONS: Record<Climate, string[]> = {
  hot: ['summer'], warm: ['spring', 'summer'], mild: ['spring', 'autumn'], cool: ['autumn', 'winter'], cold: ['winter'],
}
export const OCCASION_FORMALITY: Record<Occasion, number> = { diario: 1, trabajo: 2.5, evento: 3.5, salir: 2, deporte: 0 }

export interface TypeDefaults {
  kind: Kind
  label: string
  layer?: LayerProfile
  formality: number
  insulation: number
  length?: LengthLevel
  fit?: Fit
  styles: Record<string, number>
}

const L = (rankMin: number, rankMax: number, volume: number, canBeOpen = false, sleeveless = false): LayerProfile =>
  ({ rankMin, rankMax, canBeOpen, volume, sleeveless })

const ACC_STYLES = { casual: 0.6, smart_casual: 0.6, elegante: 0.5, clasico: 0.5, minimalista: 0.5, urbano: 0.5 }

export const TYPE_DEFAULTS: Record<string, TypeDefaults> = {
  // Parte superior
  top: { kind: 'top', label: 'Top', layer: L(1, 1, 0), formality: 1, insulation: 0, length: 'cropped', fit: 'fitted', styles: { casual: 0.8, urbano: 0.6, minimalista: 0.5, elegante: 0.3 } },
  camiseta: { kind: 'top', label: 'Camiseta', layer: L(1, 1, 1), formality: 1, insulation: 0.5, length: 'hip', fit: 'regular', styles: { casual: 1, urbano: 0.7, streetwear: 0.7, deportivo: 0.5, minimalista: 0.7, preppy: 0.4 } },
  camisa: { kind: 'top', label: 'Camisa', layer: L(1, 3, 1, true), formality: 2.5, insulation: 1, length: 'hip', fit: 'regular', styles: { casual: 0.6, smart_casual: 1, clasico: 0.9, formal: 0.6, elegante: 0.5, preppy: 0.9, minimalista: 0.6 } },
  blusa: { kind: 'top', label: 'Blusa', layer: L(1, 1, 1), formality: 2.5, insulation: 0.5, length: 'hip', fit: 'regular', styles: { casual: 0.5, smart_casual: 0.8, elegante: 0.7, clasico: 0.6, formal: 0.5, minimalista: 0.5 } },
  polo: { kind: 'top', label: 'Polo', layer: L(1, 2, 1), formality: 2, insulation: 0.8, length: 'hip', fit: 'regular', styles: { casual: 0.8, preppy: 1, smart_casual: 0.8, clasico: 0.6, deportivo: 0.4 } },
  jersey: { kind: 'top', label: 'Jersey', layer: L(1, 4, 2), formality: 1.5, insulation: 2.5, length: 'hip', fit: 'regular', styles: { casual: 0.9, smart_casual: 0.8, clasico: 0.7, preppy: 0.8, minimalista: 0.6 } },
  sudadera: { kind: 'top', label: 'Sudadera', layer: L(1, 4, 3), formality: 0.5, insulation: 2.5, length: 'hip', fit: 'oversize', styles: { casual: 0.8, urbano: 0.9, streetwear: 1, deportivo: 0.8 } },
  cardigan: { kind: 'top', label: 'Cárdigan', layer: L(2, 4, 2, true), formality: 2, insulation: 2, length: 'hip', fit: 'regular', styles: { casual: 0.7, smart_casual: 0.8, clasico: 0.7, preppy: 0.8, minimalista: 0.6 } },
  chaleco: { kind: 'top', label: 'Chaleco', layer: L(2, 3, 1, true, true), formality: 2.5, insulation: 1, length: 'hip', fit: 'regular', styles: { smart_casual: 0.8, clasico: 0.8, preppy: 0.8, elegante: 0.5, alternativo: 0.3 } },
  chaqueta: { kind: 'top', label: 'Chaqueta', layer: L(2, 5, 2, true), formality: 2.5, insulation: 2, length: 'hip', fit: 'regular', styles: { casual: 0.6, smart_casual: 0.8, clasico: 0.7, urbano: 0.5 } },
  blazer: { kind: 'top', label: 'Blazer', layer: L(2, 4, 2, true), formality: 3.5, insulation: 1.5, length: 'hip', fit: 'regular', styles: { smart_casual: 1, clasico: 0.9, elegante: 0.8, formal: 0.7, minimalista: 0.6, preppy: 0.7 } },
  cazadora: { kind: 'top', label: 'Cazadora', layer: L(2, 5, 2, true), formality: 1.5, insulation: 2, length: 'hip', fit: 'regular', styles: { casual: 0.8, urbano: 1, streetwear: 0.8, alternativo: 0.6, deportivo: 0.3 } },
  chaqueton: { kind: 'top', label: 'Chaquetón', layer: L(4, 5, 3, true), formality: 2, insulation: 3, length: 'mid-thigh', fit: 'regular', styles: { casual: 0.6, clasico: 0.7, elegante: 0.6, smart_casual: 0.6, urbano: 0.5 } },
  abrigo: { kind: 'top', label: 'Abrigo', layer: L(4, 5, 3, true), formality: 3, insulation: 3.5, length: 'knee', fit: 'regular', styles: { clasico: 0.9, elegante: 0.9, formal: 0.7, smart_casual: 0.8, minimalista: 0.7 } },
  otro_superior: { kind: 'top', label: 'Otra prenda superior', layer: L(1, 3, 1), formality: 2, insulation: 1, length: 'hip', fit: 'regular', styles: { casual: 0.6 } },
  // Parte inferior
  pantalon: { kind: 'bottom', label: 'Pantalón', formality: 2, insulation: 1.5, length: 'long', fit: 'straight', styles: { casual: 0.8, smart_casual: 0.6, urbano: 0.5 } },
  pantalon_corto: { kind: 'bottom', label: 'Pantalón corto', formality: 1, insulation: 0.3, length: 'mid-thigh', fit: 'regular', styles: { casual: 1, deportivo: 0.5 } },
  falda: { kind: 'bottom', label: 'Falda', formality: 2, insulation: 0.6, length: 'knee', fit: 'regular', styles: { casual: 0.6, smart_casual: 0.8, elegante: 0.6, clasico: 0.6 } },
  otro_inferior: { kind: 'bottom', label: 'Otra prenda inferior', formality: 2, insulation: 1, length: 'long', fit: 'regular', styles: { casual: 0.6 } },
  // Vestidos y monos
  vestido: { kind: 'onepiece', label: 'Vestido', layer: L(1, 1, 1), formality: 2.5, insulation: 0.8, length: 'knee', fit: 'regular', styles: { casual: 0.6, elegante: 0.7, smart_casual: 0.7, clasico: 0.5 } },
  mono: { kind: 'onepiece', label: 'Mono', layer: L(1, 1, 1), formality: 2, insulation: 1, length: 'long', fit: 'regular', styles: { casual: 0.6, elegante: 0.6, smart_casual: 0.6, urbano: 0.5 } },
  // Calzado
  zapatilla_deportiva: { kind: 'shoes', label: 'Zapatillas deportivas', formality: 0.5, insulation: 1, styles: { deportivo: 1, casual: 0.9, urbano: 0.9, streetwear: 1 } },
  zapatilla_casual: { kind: 'shoes', label: 'Zapatillas casuales', formality: 1, insulation: 1, styles: { casual: 1, urbano: 0.8, minimalista: 0.8, smart_casual: 0.6, preppy: 0.6, streetwear: 0.6 } },
  zapato: { kind: 'shoes', label: 'Zapatos', formality: 3.5, insulation: 1, styles: { clasico: 1, formal: 0.9, elegante: 0.9, smart_casual: 0.9, preppy: 0.8 } },
  bota: { kind: 'shoes', label: 'Botas y botines', formality: 2, insulation: 2, styles: { casual: 0.7, urbano: 0.8, alternativo: 0.8, clasico: 0.5, smart_casual: 0.6, elegante: 0.4 } },
  sandalia: { kind: 'shoes', label: 'Sandalias', formality: 1.5, insulation: 0, styles: { casual: 0.8, elegante: 0.4, minimalista: 0.5 } },
  otro_calzado: { kind: 'shoes', label: 'Otro calzado', formality: 1.5, insulation: 1, styles: { casual: 0.6 } },
  // Accesorios
  bolso: { kind: 'accessory', label: 'Bolso', formality: 2, insulation: 0, styles: ACC_STYLES },
  cinturon: { kind: 'accessory', label: 'Cinturón', formality: 2, insulation: 0, styles: ACC_STYLES },
  gorro: { kind: 'accessory', label: 'Gorros y gorras', formality: 1, insulation: 0.5, styles: { casual: 0.7, urbano: 0.7, streetwear: 0.7, deportivo: 0.5 } },
  bufanda: { kind: 'accessory', label: 'Bufandas y pañuelos', formality: 2, insulation: 1, styles: ACC_STYLES },
  joya: { kind: 'accessory', label: 'Joyas', formality: 2, insulation: 0, styles: ACC_STYLES },
  otro_accesorio: { kind: 'accessory', label: 'Otro accesorio', formality: 2, insulation: 0, styles: ACC_STYLES },
}

/** Refinamientos por subtipo ("pantalon:vaquero"). Sobrescriben el tipo base. */
export const SUBTYPE_DEFAULTS: Record<string, Partial<Pick<TypeDefaults, 'formality' | 'fit' | 'length' | 'styles' | 'insulation'>>> = {
  'pantalon:vaquero': { formality: 1, styles: { casual: 1, urbano: 0.8, streetwear: 0.6, smart_casual: 0.5 } },
  'pantalon:vestir': { formality: 3.5, styles: { formal: 0.9, clasico: 1, elegante: 0.8, smart_casual: 0.8 } },
  'pantalon:chino': { formality: 2.5, styles: { smart_casual: 1, casual: 0.8, preppy: 1, clasico: 0.7 } },
  'pantalon:cargo': { formality: 1, fit: 'wide', styles: { streetwear: 1, urbano: 0.9, casual: 0.7, alternativo: 0.5 } },
  'pantalon:deportivo': { formality: 0, fit: 'wide', styles: { deportivo: 1, streetwear: 0.7, casual: 0.6 } },
  'pantalon_corto:vaquero': { formality: 1, styles: { casual: 1, urbano: 0.6 } },
  'pantalon_corto:vestir': { formality: 2.5, length: 'mid-thigh', styles: { smart_casual: 0.8, preppy: 0.7, casual: 0.6 } },
  'pantalon_corto:deportivo': { formality: 0, styles: { deportivo: 1, streetwear: 0.6, casual: 0.6 } },
  'falda:mini': { length: 'hip', insulation: 0.3, styles: { casual: 0.7, urbano: 0.6, alternativo: 0.5 } },
  'falda:midi': { length: 'knee', styles: { smart_casual: 0.8, elegante: 0.7, casual: 0.6 } },
  'falda:larga': { length: 'long', styles: { casual: 0.6, elegante: 0.6, alternativo: 0.4 } },
  'vestido:corto': { length: 'mid-thigh' },
  'vestido:midi': { length: 'knee' },
  'vestido:largo': { length: 'long' },
  'mono:corto': { length: 'mid-thigh', insulation: 0.4 },
  'mono:largo': { length: 'long' },
}

/** Pares de neutros (clave ordenada alfabéticamente). */
export const NEUTRAL_PAIRS: Record<string, number> = {
  'blanco|negro': 0.95, 'gris|negro': 0.85, 'beige|negro': 0.8, 'camel|negro': 0.75, 'marron|negro': 0.55,
  'marino|negro': 0.5, 'denim|negro': 0.85,
  'blanco|gris': 0.85, 'beige|blanco': 0.85, 'blanco|camel': 0.85, 'blanco|marron': 0.85, 'blanco|marino': 0.95, 'blanco|denim': 0.92,
  'beige|gris': 0.6, 'camel|gris': 0.6, 'gris|marron': 0.55, 'gris|marino': 0.8, 'denim|gris': 0.85,
  'beige|camel': 0.85, 'beige|marron': 0.85, 'beige|marino': 0.92, 'beige|denim': 0.88,
  'camel|marron': 0.75, 'camel|marino': 0.92, 'camel|denim': 0.88,
  'marino|marron': 0.6, 'denim|marron': 0.8,
  'denim|marino': 0.7,
  'caqui|negro': 0.8, 'blanco|caqui': 0.85, 'beige|caqui': 0.85, 'caqui|camel': 0.75, 'caqui|denim': 0.8, 'caqui|marino': 0.75, 'caqui|gris': 0.7, 'caqui|marron': 0.6,
}
