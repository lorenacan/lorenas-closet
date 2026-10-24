import type { Kind } from '../engine'

export interface Category {
  id: string
  parentId: string | null
  name: string
  kind: Kind
  /** Clave de tipo para el motor (camiseta, pantalon...). Los hijos la heredan. */
  type?: string
  subtype?: string
  order: number
  builtin?: boolean
}

let order = 0
const c = (id: string, parentId: string | null, name: string, kind: Kind, type?: string, subtype?: string): Category =>
  ({ id, parentId, name, kind, type, subtype, order: order++, builtin: true })

const tops: [string, string][] = [
  ['top', 'Top'], ['camiseta', 'Camiseta'], ['camisa', 'Camisa'], ['blusa', 'Blusa'], ['polo', 'Polo'],
  ['jersey', 'Jersey'], ['sudadera', 'Sudadera'], ['cardigan', 'Cárdigan'], ['chaleco', 'Chaleco'],
  ['chaqueta', 'Chaqueta'], ['blazer', 'Blazer'], ['cazadora', 'Cazadora'], ['chaqueton', 'Chaquetón'], ['abrigo', 'Abrigo'],
]

export const SEED_CATEGORIES: Category[] = [
  c('sup', null, 'Parte superior', 'top'),
  ...tops.map(([id, name]) => c(id, 'sup', name, 'top', id)),
  c('inf', null, 'Parte inferior', 'bottom'),
  c('pantalon', 'inf', 'Pantalón', 'bottom', 'pantalon'),
  c('pantalon-vaquero', 'pantalon', 'Vaquero', 'bottom', 'pantalon', 'vaquero'),
  c('pantalon-vestir', 'pantalon', 'De vestir', 'bottom', 'pantalon', 'vestir'),
  c('pantalon-chino', 'pantalon', 'Chino', 'bottom', 'pantalon', 'chino'),
  c('pantalon-cargo', 'pantalon', 'Cargo', 'bottom', 'pantalon', 'cargo'),
  c('pantalon-deportivo', 'pantalon', 'Deportivo', 'bottom', 'pantalon', 'deportivo'),
  c('pantalon-otros', 'pantalon', 'Otros', 'bottom', 'pantalon', 'otros'),
  c('pantalon_corto', 'inf', 'Pantalón corto', 'bottom', 'pantalon_corto'),
  c('corto-vaquero', 'pantalon_corto', 'Vaquero', 'bottom', 'pantalon_corto', 'vaquero'),
  c('corto-vestir', 'pantalon_corto', 'De vestir', 'bottom', 'pantalon_corto', 'vestir'),
  c('corto-deportivo', 'pantalon_corto', 'Deportivo', 'bottom', 'pantalon_corto', 'deportivo'),
  c('corto-otros', 'pantalon_corto', 'Otros', 'bottom', 'pantalon_corto', 'otros'),
  c('falda', 'inf', 'Falda', 'bottom', 'falda'),
  c('falda-mini', 'falda', 'Mini', 'bottom', 'falda', 'mini'),
  c('falda-midi', 'falda', 'Midi', 'bottom', 'falda', 'midi'),
  c('falda-larga', 'falda', 'Larga', 'bottom', 'falda', 'larga'),
  c('otro_inferior', 'inf', 'Otras prendas inferiores', 'bottom', 'otro_inferior'),
  c('ves', null, 'Vestidos y monos', 'onepiece'),
  c('vestido', 'ves', 'Vestido', 'onepiece', 'vestido'),
  c('vestido-corto', 'vestido', 'Corto', 'onepiece', 'vestido', 'corto'),
  c('vestido-midi', 'vestido', 'Midi', 'onepiece', 'vestido', 'midi'),
  c('vestido-largo', 'vestido', 'Largo', 'onepiece', 'vestido', 'largo'),
  c('mono', 'ves', 'Mono', 'onepiece', 'mono'),
  c('mono-corto', 'mono', 'Corto', 'onepiece', 'mono', 'corto'),
  c('mono-largo', 'mono', 'Largo', 'onepiece', 'mono', 'largo'),
  c('cal', null, 'Calzado', 'shoes'),
  c('zapatilla_deportiva', 'cal', 'Zapatillas deportivas', 'shoes', 'zapatilla_deportiva'),
  c('zapatilla_casual', 'cal', 'Zapatillas casuales', 'shoes', 'zapatilla_casual'),
  c('zapato', 'cal', 'Zapatos', 'shoes', 'zapato'),
  c('bota', 'cal', 'Botas y botines', 'shoes', 'bota'),
  c('sandalia', 'cal', 'Sandalias', 'shoes', 'sandalia'),
  c('otro_calzado', 'cal', 'Otro calzado', 'shoes', 'otro_calzado'),
  c('acc', null, 'Accesorios', 'accessory'),
  c('bolso', 'acc', 'Bolsos', 'accessory', 'bolso'),
  c('cinturon', 'acc', 'Cinturones', 'accessory', 'cinturon'),
  c('gorro', 'acc', 'Gorros y gorras', 'accessory', 'gorro'),
  c('bufanda', 'acc', 'Bufandas y pañuelos', 'accessory', 'bufanda'),
  c('joya', 'acc', 'Joyas', 'accessory', 'joya'),
  c('otro_accesorio', 'acc', 'Otros accesorios', 'accessory', 'otro_accesorio'),
]

export const KIND_ROOTS: { kind: Kind; id: string; label: string; short: string }[] = [
  { kind: 'top', id: 'sup', label: 'Parte superior', short: 'Superior' },
  { kind: 'bottom', id: 'inf', label: 'Parte inferior', short: 'Inferior' },
  { kind: 'onepiece', id: 'ves', label: 'Vestidos y monos', short: 'Vestidos' },
  { kind: 'shoes', id: 'cal', label: 'Calzado', short: 'Calzado' },
  { kind: 'accessory', id: 'acc', label: 'Accesorios', short: 'Accesorios' },
]

export interface ResolvedCategory { kind: Kind; type: string; subtype?: string }

/** Sube por el árbol hasta encontrar el tipo y subtipo que entiende el motor. */
export function resolveCategory(id: string, byId: Map<string, Category>): ResolvedCategory | null {
  let node = byId.get(id)
  if (!node) return null
  const kind = node.kind
  let type: string | undefined
  let subtype: string | undefined
  while (node) {
    if (!subtype && node.subtype) subtype = node.subtype
    if (!type && node.type) type = node.type
    node = node.parentId ? byId.get(node.parentId) : undefined
  }
  const fallback = { top: 'otro_superior', bottom: 'otro_inferior', onepiece: 'vestido', shoes: 'otro_calzado', accessory: 'otro_accesorio' }[kind]
  return { kind, type: type ?? fallback, subtype: subtype === 'otros' ? undefined : subtype }
}

export function categoryPath(id: string, byId: Map<string, Category>): string[] {
  const out: string[] = []
  let n = byId.get(id)
  while (n) { out.unshift(n.name); n = n.parentId ? byId.get(n.parentId) : undefined }
  return out
}

export function descendantIds(id: string, all: Category[]): string[] {
  const out = [id]
  for (const ch of all.filter((x) => x.parentId === id)) out.push(...descendantIds(ch.id, all))
  return out
}
