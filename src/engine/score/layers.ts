import type { ModuleResult } from '../types'
import { MAX_RANK } from '../config/defaults'
import { topStack, type Parts, type PGarment } from '../prepare'

/**
 * Asigna a cada capa (de dentro a fuera) el rango mínimo posible.
 * Devuelve null si la pila es físicamente imposible.
 * La primera capa debe poder ir contra la piel (rankMin = 1).
 */
export function assignRanks(stack: PGarment[]): number[] | null {
  const ranks: number[] = []
  let prev = 0
  for (let i = 0; i < stack.length; i++) {
    const l = stack[i].layer
    if (!l) return null
    if (i === 0 && l.rankMin !== 1) return null
    const r = Math.max(prev + 1, l.rankMin)
    if (r > l.rankMax || r > MAX_RANK) return null
    ranks.push(r)
    prev = r
  }
  return ranks
}

/** Reglas duras entre una capa interior y la exterior que se le pone encima. */
export function canLayer(inner: PGarment, outer: PGarment): boolean {
  if (inner.type === outer.type) return false
  const il = inner.layer, ol = outer.layer
  if (!il || !ol) return false
  if (!ol.sleeveless && !il.sleeveless && il.volume - ol.volume >= 2) return false
  return true
}

/** ¿Se puede añadir `next` como capa exterior de `stack` y aún completar `total` capas? */
export function canAppend(stack: PGarment[], next: PGarment, total: number): boolean {
  if (stack.some((s) => s.id === next.id)) return false
  if (stack.length && !canLayer(stack[stack.length - 1], next)) return false
  if (stack.some((s) => s.type === next.type)) return false
  const ranks = assignRanks([...stack, next])
  if (!ranks) return false
  const remaining = total - (stack.length + 1)
  return ranks[ranks.length - 1] + remaining <= MAX_RANK
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

function pairStack(inner: PGarment, outer: PGarment): number {
  const il = inner.layer!, ol = outer.layer!
  let s = 1
  if (!il.sleeveless && !ol.sleeveless) {
    const dv = il.volume - ol.volume
    if (dv === 1) s *= 0.75
  }
  if (inner.length !== null && outer.length !== null) {
    const dl = inner.length - outer.length
    if (dl === 1) s *= ol.canBeOpen ? 0.95 : 0.88
    else if (dl === 2) s *= 0.6
    else if (dl >= 3) s *= 0.35
  }
  if (inner.type === 'camisa' && ['jersey', 'cardigan', 'chaleco'].includes(outer.type)) s = Math.min(1, s + 0.05)
  return s
}

const WIDE_STYLES = ['streetwear', 'urbano']

function proportion(parts: Parts, notes: string[]): number | null {
  const stack = topStack(parts)
  if (!stack.length) return null
  const outer = stack[stack.length - 1]
  if (parts.onepiece && !parts.bottom) {
    const dress = parts.onepiece
    if (stack.length > 1 && outer.length !== null && dress.length !== null && outer.length >= dress.length + 2) {
      notes.push('El abrigo tapa casi todo el vestido')
      return 0.8
    }
    return 0.95
  }
  if (!parts.bottom) return null
  const b = parts.bottom
  const tw = outer.fitWidth, bw = b.fitWidth
  let s: number
  if ((tw >= 3 && bw <= 2) || (tw <= 2 && bw >= 3)) {
    s = 1
    notes.push(tw >= 3 ? 'Parte superior amplia con parte inferior más ajustada' : 'Parte superior ajustada con pantalón amplio')
  } else if (tw >= 3 && bw >= 3) {
    const intended = [outer, b].some((g) => WIDE_STYLES.some((st) => (g.styles[st] ?? 0) >= 0.7))
    s = intended ? 0.85 : 0.5
    notes.push(intended ? 'Volumen arriba y abajo, propio del estilo' : 'Mucho volumen arriba y abajo')
  } else if (tw <= 1 && bw <= 1) {
    s = 0.78
    notes.push('Silueta muy ajustada de arriba abajo')
  } else {
    s = 0.9
    notes.push('Proporciones equilibradas')
  }
  if (outer.length !== null && outer.length >= 4 && bw >= 3 && outer.layer!.volume >= 3) {
    s *= 0.6
    notes.push('Abrigo largo y pantalón ancho: demasiado volumen')
  }
  return s
}

export function scoreLayers(parts: Parts): ModuleResult {
  const stack = topStack(parts)
  const notes: string[] = []
  if (!stack.length) return { score: null, notes }
  if (!assignRanks(stack)) return { score: 0, notes: ['Capas imposibles de combinar'] }

  let ss = 1
  if (stack.length > 1) {
    let sum = 0
    for (let i = 0; i < stack.length - 1; i++) {
      if (!canLayer(stack[i], stack[i + 1])) return { score: 0, notes: ['Capas imposibles de combinar'] }
      sum += pairStack(stack[i], stack[i + 1])
    }
    ss = sum / (stack.length - 1)
    notes.push(ss >= 0.9 ? `${stack.length} capas bien escalonadas` : 'Capas con volúmenes o largos poco ajustados')
  }
  const prop = proportion(parts, notes)
  const score = prop === null ? ss : 0.55 * ss + 0.45 * prop
  return { score: clamp01(score), notes }
}
