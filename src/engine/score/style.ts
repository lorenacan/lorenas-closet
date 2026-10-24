import type { ModuleResult, Risk } from '../types'
import { STYLE_LABELS, styleAffinity } from '../config/defaults'
import { allItems, visualWeights, type Parts, type PGarment } from '../prepare'

const MIN_W: Record<Risk, number> = { simple: 0.4, balanced: 0.3, bold: 0.15 }

export interface StyleCtx { risk: Risk; styles: string[] }

/** Compatibilidad máxima entre las etiquetas de estilo de dos prendas. */
export function pairCompat(a: PGarment, b: PGarment): number {
  const ea = Object.entries(a.styles), eb = Object.entries(b.styles)
  if (!ea.length || !eb.length) return 0.6
  let best = 0
  for (const [s, x] of ea) for (const [t, y] of eb) best = Math.max(best, x * y * styleAffinity(s, t))
  return best
}

function fitWithRequested(g: PGarment, req: string[]): number {
  const e = Object.entries(g.styles)
  if (!e.length) return 0.6
  let best = 0
  for (const [s, x] of e) for (const r of req) best = Math.max(best, x * styleAffinity(s, r))
  return best
}

export function scoreStyle(parts: Parts, ctx: StyleCtx): ModuleResult {
  const items = allItems(parts)
  if (items.length === 0) return { score: null, notes: [] }
  const w = visualWeights(parts)
  const core = items.filter((i) => i.kind !== 'accessory')
  const notes: string[] = []

  // Coherencia interna: media ponderada de pares + peor pareja de prendas principales
  let cs = 0, cw = 0, minPair = 1
  let worst: [PGarment, PGarment] | null = null
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]
      const pw = (w.get(a.id) ?? 0) * (w.get(b.id) ?? 0)
      const c = pairCompat(a, b)
      cs += c * pw
      cw += pw
      if (a.kind !== 'accessory' && b.kind !== 'accessory' && c < minPair) { minPair = c; worst = [a, b] }
    }
  }
  const coherence = cw > 0 ? 0.7 * (cs / cw) + 0.3 * minPair : 0.8

  // Perfil de estilo dominante del look
  const profile: Record<string, number> = {}
  for (const it of items) for (const [s, v] of Object.entries(it.styles)) profile[s] = (profile[s] ?? 0) + v * (w.get(it.id) ?? 0)
  const top = Object.entries(profile).sort((a, b) => b[1] - a[1]).slice(0, 2).filter((e) => e[1] > 0.15)

  let score = coherence
  if (ctx.styles.length) {
    let fs = 0, fw = 0, minFit = 1
    let weak: PGarment | null = null
    for (const it of core) {
      const f = fitWithRequested(it, ctx.styles)
      const iw = w.get(it.id) ?? 0
      fs += f * iw
      fw += iw
      if (f < minFit) { minFit = f; weak = it }
    }
    const mw = MIN_W[ctx.risk]
    const fit = fw > 0 ? (1 - mw) * (fs / fw) + mw * minFit : 0.6
    score = 0.6 * fit + 0.4 * coherence
    const req = ctx.styles.map((s) => STYLE_LABELS[s] ?? s).join(' / ')
    if (fit >= 0.7) notes.push(`Encaja con el estilo ${req}`)
    else if (weak && minFit < 0.45) notes.push(`${weak.g.name ?? weak.type} se aleja del estilo ${req}`)
  } else if (top.length) {
    notes.push(`Estilo ${top.map((t) => (STYLE_LABELS[t[0]] ?? t[0]).toLowerCase()).join(' + ')}`)
  }
  if (minPair < 0.35 && worst) notes.push(`${worst[0].g.name ?? worst[0].type} y ${worst[1].g.name ?? worst[1].type} chocan de estilo`)
  else if (coherence >= 0.7 && !notes.length) notes.push('Estilo coherente')
  return { score: Math.max(0, Math.min(1, score)), notes }
}
