import type { Garment, LayerProfile, Pattern, Season } from './types'
import { classifyColor, type ColorInfo } from './color'
import { FIT_WIDTH, SUBTYPE_DEFAULTS, TYPE_DEFAULTS, lengthValue } from './config/defaults'

/** Prenda con todos los valores por defecto resueltos y los colores ya analizados. */
export interface PGarment {
  id: string
  g: Garment
  kind: Garment['kind']
  type: string
  color: ColorInfo | null
  secondary: ColorInfo[]
  pattern: Pattern
  styles: Record<string, number>
  stylesDeclared: boolean
  layer: LayerProfile | null
  fitWidth: number
  /** 1 (cropped) ... 5 (long); null si no aplica. */
  length: number | null
  insulation: number
  formality: number
  seasons?: Season[]
  wearCount: number
}

const KIND_FALLBACK = { top: 'otro_superior', bottom: 'otro_inferior', onepiece: 'vestido', shoes: 'otro_calzado', accessory: 'otro_accesorio' } as const

export function prepare(g: Garment): PGarment {
  const base = TYPE_DEFAULTS[g.type] ?? TYPE_DEFAULTS[KIND_FALLBACK[g.kind]]
  const sub = g.subtype ? SUBTYPE_DEFAULTS[`${g.type}:${g.subtype}`] : undefined

  let color: ColorInfo | null = null
  if (g.colorHex) {
    color = { ...classifyColor(g.colorHex) }
    if (g.colorTemp) color.temp = g.colorTemp
    if (g.intensity) color.intensity = g.intensity
    if (g.lightness) color.lightness = g.lightness
  }
  const declared = !!g.styles && Object.keys(g.styles).length > 0
  const styles = declared ? g.styles! : { ...base.styles, ...(sub?.styles ?? {}) }
  const layer = base.layer ? { ...base.layer, ...(g.layer ?? {}) } : null
  const len = g.length ?? sub?.length ?? base.length
  const fit = g.fit ?? sub?.fit ?? base.fit ?? 'regular'
  return {
    id: g.id,
    g,
    kind: g.kind,
    type: g.type,
    color,
    secondary: (g.secondaryHex ?? []).map((h) => classifyColor(h)),
    pattern: g.pattern ?? 'solid',
    styles,
    stylesDeclared: declared,
    layer,
    fitWidth: FIT_WIDTH[fit],
    length: len ? lengthValue(len) : null,
    insulation: g.insulation ?? sub?.insulation ?? base.insulation,
    formality: g.formality ?? sub?.formality ?? base.formality,
    seasons: g.seasons && g.seasons.length ? g.seasons : undefined,
    wearCount: g.wearCount ?? 0,
  }
}

/** Piezas de un look (la parte superior va de dentro hacia fuera). */
export interface Parts {
  tops: PGarment[]
  bottom?: PGarment
  onepiece?: PGarment
  shoes?: PGarment
  accessories: PGarment[]
}

export function allItems(p: Parts): PGarment[] {
  const out: PGarment[] = []
  if (p.onepiece) out.push(p.onepiece)
  out.push(...p.tops)
  if (p.bottom) out.push(p.bottom)
  if (p.shoes) out.push(p.shoes)
  out.push(...p.accessories)
  return out
}

/** Capas superiores incluyendo el vestido/mono como capa base, de dentro hacia fuera. */
export function topStack(p: Parts): PGarment[] {
  return p.onepiece ? [p.onepiece, ...p.tops] : p.tops
}

const ACC_AREA: Record<string, number> = { bolso: 0.05, cinturon: 0.02, gorro: 0.04, bufanda: 0.06, joya: 0.01 }

/** Peso visual de cada prenda (suma 1): cuánto "color" y "presencia" aporta al conjunto. */
export function visualWeights(p: Parts): Map<string, number> {
  const w = new Map<string, number>()
  const stack = topStack(p)
  stack.forEach((it, i) => {
    const outermost = i === stack.length - 1
    let v: number
    if (it.kind === 'onepiece') v = stack.length > 1 ? 0.35 : 0.5
    else if (stack.length === 1) v = 0.35
    else v = outermost ? 0.28 : 0.1
    w.set(it.id, v)
  })
  if (p.bottom) w.set(p.bottom.id, 0.3)
  if (p.shoes) w.set(p.shoes.id, 0.08)
  for (const a of p.accessories) w.set(a.id, ACC_AREA[a.type] ?? 0.03)
  let total = 0
  for (const v of w.values()) total += v
  if (total > 0) for (const [k, v] of w) w.set(k, v / total)
  return w
}
