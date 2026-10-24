import type { Climate, GenerationRequest, Look, ModuleResult, Occasion, Risk, Weights } from '../types'
import { DEFAULT_WEIGHTS } from '../config/defaults'
import { allItems, type Parts } from '../prepare'
import { scoreColor } from './color'
import { scoreStyle } from './style'
import { scoreLayers } from './layers'
import { scoreOccasion } from './occasion'

export interface ScoreCtx {
  weights: Weights
  risk: Risk
  styles: string[]
  preferColors: string[]
  climate?: Climate
  occasion?: Occasion
  formality?: number
  hasShoes: boolean
  prioritizeUnderused: boolean
}

export function makeScoreCtx(req: GenerationRequest, hasShoes: boolean): ScoreCtx {
  return {
    weights: { ...DEFAULT_WEIGHTS, ...(req.weights ?? {}) },
    risk: req.risk ?? 'balanced',
    styles: req.styles ?? [],
    preferColors: req.preferColors ?? [],
    climate: req.climate,
    occasion: req.occasion,
    formality: req.formality,
    hasShoes,
    prioritizeUnderused: !!req.prioritizeUnderused,
  }
}

export interface Scored {
  /** 0..1 */
  total: number
  modules: Look['modules']
}

/** Puntúa un look (completo o parcial). Los módulos que no aplican se excluyen y se reponderan los demás. */
export function scoreParts(parts: Parts, ctx: ScoreCtx): Scored {
  const color = scoreColor(parts, ctx)
  const style = scoreStyle(parts, ctx)
  const silhouette = scoreLayers(parts)
  const occasion = scoreOccasion(parts, ctx)
  const mods: [ModuleResult, number][] = [
    [color, ctx.weights.color], [style, ctx.weights.style], [silhouette, ctx.weights.silhouette], [occasion, ctx.weights.occasion],
  ]
  let sum = 0, wsum = 0, min = 1
  for (const [m, w] of mods) {
    if (m.score === null) continue
    sum += m.score * w
    wsum += w
    min = Math.min(min, m.score)
  }
  let total = wsum > 0 ? sum / wsum : 0
  // Un módulo muy flojo arrastra el conjunto aunque los demás sean buenos
  total *= 1 - 0.25 * Math.max(0, 0.35 - min)
  if (ctx.prioritizeUnderused) {
    const core = allItems(parts).filter((i) => i.kind !== 'accessory')
    if (core.length) total += 0.04 * (core.reduce((a, i) => a + 1 / (1 + i.wearCount), 0) / core.length)
  }
  // Estiramos la escala: lo "correcto" ronda 0,8 y lo flojo cae claramente por debajo
  total = 0.5 + (total - 0.72) * 1.6
  return { total: Math.max(0, Math.min(1, total)), modules: { color, style, silhouette, occasion } }
}
