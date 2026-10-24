import type { Intensity, Lightness, Temp } from './types'
import { NEUTRAL_PAIRS } from './config/defaults'

export interface ColorInfo {
  hex: string
  L: number // luminosidad perceptual OKLCH 0..1
  C: number // croma
  h: number // tono 0..360
  family: string
  neutral: boolean
  temp: Temp
  lightness: Lightness
  intensity: Intensity
}

export const NEUTRAL_FAMILIES = ['negro', 'blanco', 'gris', 'beige', 'camel', 'marron', 'caqui', 'marino', 'denim']
export const CHROMATIC_FAMILIES = ['rojo', 'naranja', 'amarillo', 'verde', 'turquesa', 'azul', 'violeta', 'rosa']
export const FAMILY_LABELS: Record<string, string> = {
  negro: 'Negro', blanco: 'Blanco', gris: 'Gris', beige: 'Beige', camel: 'Camel', marron: 'Marrón', caqui: 'Caqui',
  marino: 'Azul marino', denim: 'Denim', rojo: 'Rojo', naranja: 'Naranja', amarillo: 'Amarillo',
  verde: 'Verde', turquesa: 'Turquesa', azul: 'Azul', violeta: 'Violeta', rosa: 'Rosa',
}

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  if (Number.isNaN(n) || h.length !== 6) return [128, 128, 128]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function hexToOklch(hex: string): { L: number; C: number; h: number } {
  const [r8, g8, b8] = hexToRgb(hex)
  const r = srgbToLinear(r8 / 255), g = srgbToLinear(g8 / 255), b = srgbToLinear(b8 / 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(a, bb)
  let h = (Math.atan2(bb, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { L, C, h }
}

const cache = new Map<string, ColorInfo>()

/** Traduce un color hex a los atributos comparables del sistema. */
export function classifyColor(hex: string): ColorInfo {
  const key = hex.toLowerCase()
  const hit = cache.get(key)
  if (hit) return hit
  const { L, C, h } = hexToOklch(key)
  let family: string
  let neutral = true
  let temp: Temp

  const warmTint = h >= 35 && h <= 125
  if (C < 0.02 || (C < 0.035 && !warmTint)) {
    family = L < 0.3 ? 'negro' : L > 0.92 ? 'blanco' : 'gris'
    temp = 'neutral'
  } else if (h >= 35 && h <= 125 && C < 0.12) {
    family = L > 0.93 ? 'blanco' : L > 0.78 ? 'beige' : h >= 95 ? 'caqui' : L > 0.55 ? 'camel' : 'marron'
    temp = family === 'blanco' ? 'neutral' : 'warm'
  } else if (h >= 215 && h <= 285 && L < 0.4 && C < 0.13) {
    family = 'marino'
    temp = 'cool'
  } else if (h >= 225 && h <= 285 && C < (L < 0.75 ? 0.095 : 0.07)) {
    family = 'denim'
    temp = 'cool'
  } else {
    neutral = false
    if (h >= 340 || h < 8) family = L >= 0.55 ? 'rosa' : 'rojo'
    else if (h < 42) family = L >= 0.82 ? 'rosa' : 'rojo'
    else if (h < 75) family = 'naranja'
    else if (h < 112) family = 'amarillo'
    else if (h < 170) family = 'verde'
    else if (h < 222) family = 'turquesa'
    else if (h < 265) family = 'azul'
    else if (h < 320) family = 'violeta'
    else family = 'rosa'
    temp = h < 100 || h >= 340 ? 'warm' : h >= 170 && h <= 300 ? 'cool' : 'neutral'
  }
  const info: ColorInfo = {
    hex: key, L, C, h, family, neutral, temp,
    lightness: L < 0.45 ? 'dark' : L > 0.75 ? 'light' : 'medium',
    intensity: C < 0.06 ? 'muted' : C < 0.14 ? 'medium' : 'vivid',
  }
  cache.set(key, info)
  return info
}

/** Distancia angular de tono (0..180). */
export function hueDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

export type Scheme = 'neutral' | 'monocromatico' | 'analogo' | 'tension' | 'triadico' | 'complementario-dividido' | 'complementario'

export interface PairResult { score: number; scheme: Scheme }

/** Compatibilidad entre dos colores (0..1). Es una puntuación, no una regla absoluta. */
export function pairHarmony(a: ColorInfo, b: ColorInfo): PairResult {
  if (a.neutral && b.neutral) {
    if (a.family === b.family) return { score: a.family === 'negro' ? 0.9 : 0.82, scheme: 'neutral' }
    const key = [a.family, b.family].sort().join('|')
    return { score: NEUTRAL_PAIRS[key] ?? 0.7, scheme: 'neutral' }
  }
  if (a.neutral || b.neutral) {
    const n = a.neutral ? a : b
    const c = a.neutral ? b : a
    let s = 0.86
    if (['negro', 'blanco', 'gris', 'denim', 'marino'].includes(n.family)) s = 0.88
    // El marino con rojos/rosas vivos y el negro con marrones/marino tienen algo más de riesgo
    if (n.family === 'marino' && (c.family === 'rojo' || c.family === 'marron')) s -= 0.1
    if (n.family === 'denim' && c.intensity === 'vivid') s -= 0.03
    return { score: s, scheme: 'neutral' }
  }
  const d = hueDiff(a.h, b.h)
  let base: number
  let scheme: Scheme
  if (d < 12) { base = 0.85; scheme = 'monocromatico' }
  else if (d < 60) { base = 0.85; scheme = 'analogo' }
  else if (d < 80) { base = 0.5; scheme = 'tension' }
  else if (d < 100) { base = 0.55; scheme = 'tension' }
  else if (d < 125) { base = 0.65; scheme = 'triadico' }
  else if (d < 145) { base = 0.7; scheme = 'complementario-dividido' }
  else { base = 0.68; scheme = 'complementario' }

  if (d >= 60) {
    if (a.intensity === 'vivid' && b.intensity === 'vivid') base *= 0.75
    else if (a.intensity === 'muted' || b.intensity === 'muted') base = Math.min(0.95, base * 1.12)
    if (Math.abs(a.L - b.L) >= 0.25) base = Math.min(0.95, base * 1.06)
    else if (a.intensity === 'vivid' && b.intensity === 'vivid') base *= 0.9
  }
  return { score: base, scheme }
}

export const SCHEME_LABELS: Record<Scheme, string> = {
  neutral: 'neutros combinados',
  monocromatico: 'monocromático',
  analogo: 'colores análogos',
  tension: 'colores en tensión',
  triadico: 'tríada',
  'complementario-dividido': 'complementarios divididos',
  complementario: 'complementarios',
}
