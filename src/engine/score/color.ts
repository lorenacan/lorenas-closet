import type { ModuleResult, Risk } from '../types'
import { FAMILY_LABELS, SCHEME_LABELS, hueDiff, pairHarmony, type ColorInfo, type Scheme } from '../color'
import { allItems, visualWeights, type Parts } from '../prepare'

interface Mass { c: ColorInfo; w: number; pattern: boolean }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const TOL: Record<Risk, number> = { simple: 1.25, balanced: 1, bold: 0.7 }

export interface ColorCtx { risk: Risk; preferColors: string[] }

export function scoreColor(parts: Parts, ctx: ColorCtx): ModuleResult {
  const weights = visualWeights(parts)
  const masses: Mass[] = []
  for (const it of allItems(parts)) {
    if (!it.color) continue
    const w = weights.get(it.id) ?? 0
    const patterned = it.pattern !== 'solid'
    const secFrac = it.secondary.length ? (patterned ? 0.35 : 0.12) : 0
    masses.push({ c: it.color, w: w * (1 - secFrac), pattern: patterned })
    for (const s of it.secondary) masses.push({ c: s, w: (w * secFrac) / it.secondary.length, pattern: patterned })
  }
  const total = masses.reduce((a, m) => a + m.w, 0)
  if (masses.length === 0 || total === 0) return { score: null, notes: [] }
  for (const m of masses) m.w /= total
  const tol = TOL[ctx.risk]
  const notes: string[] = []

  // 1) Armonía por pares ponderada por proporción
  let hs = 0, hw = 0
  let bestScheme: { scheme: Scheme; w: number; a: ColorInfo; b: ColorInfo } | null = null
  for (let i = 0; i < masses.length; i++) {
    for (let j = i + 1; j < masses.length; j++) {
      const pw = masses[i].w * masses[j].w
      const r = pairHarmony(masses[i].c, masses[j].c)
      hs += r.score * pw
      hw += pw
      if (r.scheme !== 'neutral' && (!bestScheme || pw > bestScheme.w)) bestScheme = { scheme: r.scheme, w: pw, a: masses[i].c, b: masses[j].c }
    }
  }
  const harmony = hw > 0 ? hs / hw : 0.85

  // 2) Grupos cromáticos y reparto (protagonista + acentos)
  const neutralMass = masses.filter((m) => m.c.neutral).reduce((a, m) => a + m.w, 0)
  const chroma = masses.filter((m) => !m.c.neutral).sort((a, b) => b.w - a.w)
  const groups: { h: number; w: number }[] = []
  for (const m of chroma) {
    const g = groups.find((x) => hueDiff(x.h, m.c.h) < 30)
    if (g) g.w += m.w
    else groups.push({ h: m.c.h, w: m.w })
  }
  const sig = groups.filter((g) => g.w >= 0.06).sort((a, b) => b.w - a.w)
  const G = sig.length
  const chromaMass = 1 - neutralMass
  let balance: number
  if (G === 0) balance = 0.8
  else if (G === 1) balance = chromaMass <= 0.7 ? 1 : 0.85
  else if (G === 2) balance = sig[0].w / sig[1].w >= 1.8 ? 0.9 : 0.65
  else if (G === 3) balance = sig[2].w < 0.12 ? 0.8 : 0.5
  else balance = 0.25
  balance = clamp01(1 - (1 - balance) * tol)

  // 3) Colores vivos que compiten
  const vivid = masses.filter((m) => m.c.intensity === 'vivid' && m.w >= 0.12).length
  const vividScore = clamp01(1 - (1 - (vivid <= 1 ? 1 : vivid === 2 ? 0.65 : 0.3)) * tol)

  // 4) Equilibrio cálido / frío
  const warm = masses.filter((m) => m.c.temp === 'warm').reduce((a, m) => a + m.w, 0)
  const cool = masses.filter((m) => m.c.temp === 'cool').reduce((a, m) => a + m.w, 0)
  const mix = warm + cool < 0.15 ? 0 : (2 * Math.min(warm, cool)) / (warm + cool)
  const temp = 1 - 0.2 * mix

  // 5) Contraste de luminosidad
  const sigMasses = masses.filter((m) => m.w >= 0.05)
  const Ls = sigMasses.map((m) => m.c.L)
  const range = Ls.length ? Math.max(...Ls) - Math.min(...Ls) : 0
  const contrast = clamp01(0.5 + range * 1.2)

  // 6) Estampados
  const patterned = allItems(parts).filter((i) => i.pattern !== 'solid')
  let pattern = 1
  if (patterned.length === 2) pattern = patterned[0].pattern === patterned[1].pattern ? 0.65 : 0.5
  else if (patterned.length >= 3) pattern = 0.2
  pattern = clamp01(1 - (1 - pattern) * tol)

  let score = 0.35 * harmony + 0.2 * balance + 0.1 * vividScore + 0.1 * temp + 0.1 * contrast + 0.15 * pattern

  // Preferencia de riesgo
  const accent = sig.length >= 2 && sig[0].w / sig[1].w >= 1.5
  if (ctx.risk === 'simple') score += 0.06 * (neutralMass - 0.4)
  if (ctx.risk === 'bold') {
    if (bestScheme && ['complementario', 'complementario-dividido', 'triadico'].includes(bestScheme.scheme) && accent) score += 0.05
    if (patterned.length === 1) score += 0.04
  }
  // Colores preferidos
  if (ctx.preferColors.length) {
    const share = masses.filter((m) => ctx.preferColors.includes(m.c.family)).reduce((a, m) => a + m.w, 0)
    score += 0.12 * Math.min(1, share / 0.3)
  }
  score = clamp01(score)

  // Explicación
  const names = (cs: ColorInfo[]) => {
    const n = [...new Set(cs.map((c) => FAMILY_LABELS[c.family].toLowerCase()))]
    return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n[0]
  }
  if (G === 0) notes.push(`Look de neutros (${names(masses.map((m) => m.c))})`)
  else if (G === 1) {
    notes.push(
      chromaMass > 0.7
        ? `Monocromático en ${names(chroma.map((m) => m.c).slice(0, 1))}`
        : `Neutros con ${names(chroma.map((m) => m.c).slice(0, 1))} como color protagonista`,
    )
  } else if (bestScheme) {
    notes.push(`${cap(SCHEME_LABELS[bestScheme.scheme])}: ${names([bestScheme.a, bestScheme.b])}${accent ? ', con uno dominante' : ''}`)
  }
  if (vivid >= 2) notes.push('Varios colores vivos compiten entre sí')
  if (G >= 4) notes.push('Demasiados colores distintos')
  if (range >= 0.4) notes.push('Buen contraste de luminosidad')
  if (patterned.length >= 2) notes.push('Dos estampados a la vez')
  return { score, notes }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
