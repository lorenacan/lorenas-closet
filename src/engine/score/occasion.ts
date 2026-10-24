import type { Climate, ModuleResult, Occasion } from '../types'
import { CLIMATE_SEASONS, CLIMATE_TARGET, OCCASION_FORMALITY } from '../config/defaults'
import { allItems, visualWeights, type Parts } from '../prepare'

export interface OccasionCtx {
  climate?: Climate
  occasion?: Occasion
  formality?: number
  /** Si no hay calzado disponible en el pool, no se espera para evaluar el abrigo total. */
  hasShoes: boolean
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export function scoreOccasion(parts: Parts, ctx: OccasionCtx): ModuleResult {
  const target = ctx.formality ?? (ctx.occasion ? OCCASION_FORMALITY[ctx.occasion] : undefined)
  if (!ctx.climate && target === undefined) return { score: null, notes: [] }
  const items = allItems(parts)
  const notes: string[] = []
  const comps: number[] = []

  if (ctx.climate) {
    const complete = (parts.bottom || parts.onepiece) && (parts.shoes || !ctx.hasShoes)
    let tc = 1
    if (complete) {
      let total = 0
      for (const t of parts.tops) total += t.insulation
      if (parts.onepiece) total += parts.onepiece.insulation
      if (parts.bottom) total += parts.bottom.insulation * 0.5
      if (parts.shoes) total += parts.shoes.insulation * 0.3
      for (const a of parts.accessories) total += a.insulation
      const [lo, hi] = CLIMATE_TARGET[ctx.climate]
      const dist = total < lo ? lo - total : total > hi ? total - hi : 0
      tc = clamp01(1 - dist / 3)
      if (dist > 0.8) notes.push(total < lo ? 'Poco abrigo para ese clima' : 'Demasiado abrigo para ese clima')
      else notes.push('Abrigo adecuado para el clima')
    }
    const seasons = CLIMATE_SEASONS[ctx.climate]
    const tagged = items.filter((i) => i.seasons)
    const ts = tagged.length ? tagged.reduce((a, i) => a + (i.seasons!.some((s) => seasons.includes(s)) ? 1 : 0.25), 0) / tagged.length : 1
    comps.push(0.7 * tc + 0.3 * ts)
  }

  if (target !== undefined) {
    const w = visualWeights(parts)
    let fs = 0, fw = 0
    for (const it of items) {
      const iw = (w.get(it.id) ?? 0) * (it.kind === 'accessory' ? 0.5 : 1)
      fs += it.formality * iw
      fw += iw
    }
    const lf = fw ? fs / fw : target
    let f = clamp01(1 - Math.abs(lf - target) / 2.5)
    const core = items.filter((i) => i.kind !== 'accessory').map((i) => i.formality)
    const spread = core.length ? Math.max(...core) - Math.min(...core) : 0
    if (spread > 2.5) f = clamp01(f * (1 - 0.1 * (spread - 2.5)))
    notes.push(f >= 0.75 ? 'Nivel de formalidad adecuado' : lf > target ? 'Más formal de lo pedido' : 'Más informal de lo pedido')
    comps.push(f)
  }
  return { score: comps.reduce((a, b) => a + b, 0) / comps.length, notes }
}
