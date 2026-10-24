import type { Garment, GenerationRequest, GenerationResult, Look, ModuleResult } from './types'
import { allItems, prepare, type Parts, type PGarment } from './prepare'
import { canAppend } from './score/layers'
import { makeScoreCtx, scoreParts, type ScoreCtx, type Scored } from './score'
import { makeRng, sample, type Rng } from './rng'

const STACK_SAMPLE = 80
const STACK_BEAM = 20
const BOTTOM_SAMPLE = 40
const SHOES_SAMPLE = 25
const FINAL_KEEP = 80
const REQUIRED_BONUS = 0.12
const BELT_BOTTOMS = ['pantalon', 'falda', 'pantalon_corto', 'otro_inferior']

interface Cand { parts: Parts; s: number }

const keyOf = (p: Parts) => allItems(p).map((i) => i.id).join('>')
const topsKey = (p: Parts) => [p.onepiece?.id, ...p.tops.map((t) => t.id)].join('>')
const coreKey = (p: Parts) => `${topsKey(p)}|${p.bottom?.id ?? ''}`
export const signatureOf = (ids: string[]) => [...ids].sort().join('|')

/** Genera looks completos con las prendas recibidas, puntuados y ordenados, sin IA ni aleatoriedad opaca (seed reproducible). */
export function generateLooks(garments: Garment[], req: GenerationRequest): GenerationResult {
  const diagnostics: string[] = []
  const N = Math.max(1, Math.min(5, Math.round(req.layers || 1)))
  const rng = makeRng(req.seed ?? Date.now())
  const count = req.count ?? 8
  const excluded = new Set(req.exclude ?? [])
  const avoid = new Set(req.avoidColors ?? [])

  const all = garments.map(prepare)
  const pool = all.filter((p) => !excluded.has(p.id) && !(p.color && avoid.has(p.color.family)))
  const byKind = (k: PGarment['kind']) => pool.filter((p) => p.kind === k)
  const tops = byKind('top'), bottoms = byKind('bottom'), onepieces = byKind('onepiece')
  const shoes = byKind('shoes'), accs = byKind('accessory')
  const ctx = makeScoreCtx(req, shoes.length > 0)

  // Prendas obligatorias
  const required: PGarment[] = []
  for (const id of req.mustInclude ?? []) {
    const p = pool.find((x) => x.id === id)
    if (p) required.push(p)
    else {
      const orig = all.find((x) => x.id === id)
      diagnostics.push(`La prenda obligatoria "${orig?.g.name ?? orig?.type ?? id}" no se puede usar (excluida, no disponible o de un color evitado).`)
    }
  }
  const reqOf = (k: PGarment['kind']) => required.filter((p) => p.kind === k)
  const reqTops = reqOf('top'), reqBottoms = reqOf('bottom'), reqOne = reqOf('onepiece')
  const reqShoes = reqOf('shoes'), reqAcc = reqOf('accessory')
  if (reqBottoms.length > 1 || reqShoes.length > 1 || reqOne.length > 1 || (reqOne.length && reqBottoms.length)) {
    diagnostics.push('Las prendas obligatorias son incompatibles entre sí (por ejemplo, dos pantalones o un vestido con un pantalón).')
    return { looks: [], diagnostics }
  }
  if (reqTops.length + reqOne.length > N) {
    diagnostics.push(`Has pedido ${N} capa${N > 1 ? 's' : ''} pero hay más prendas superiores obligatorias.`)
    return { looks: [], diagnostics }
  }

  const useSeparates = !reqOne.length && bottoms.length > 0 && tops.length > 0
  const useOnepiece = req.allowOnePieces !== false && !reqBottoms.length && onepieces.length > 0 && (N === 1 || tops.length > 0)
  if (!useSeparates && !useOnepiece) {
    if (!tops.length && !onepieces.length) diagnostics.push('No tienes prendas de la parte superior disponibles.')
    if (!bottoms.length && !onepieces.length) diagnostics.push('No tienes prendas de la parte inferior (ni vestidos o monos) disponibles.')
    if (!diagnostics.length) diagnostics.push('Con las prendas y filtros actuales no hay una estructura de look posible.')
    return { looks: [], diagnostics }
  }

  const toParts = (stack: PGarment[]): Parts =>
    stack[0]?.kind === 'onepiece'
      ? { onepiece: stack[0], tops: stack.slice(1), accessories: [] }
      : { tops: stack, accessories: [] }

  const reqIds = new Set(required.map((r) => r.id))
  const partialScore = (p: Parts): number => {
    let s = scoreParts(p, ctx).total
    for (const it of allItems(p)) if (reqIds.has(it.id)) s += REQUIRED_BONUS
    return s + rng() * 0.06
  }

  // 1) Pilas de capas superiores (beam search de dentro hacia fuera)
  function buildStacks(prefix: PGarment[], need: number, beamWidth: number): PGarment[][] {
    if (need === 0) return [prefix]
    const total = prefix.length + need
    let beam: PGarment[][] = [prefix]
    for (let step = 0; step < need; step++) {
      const next: { stack: PGarment[]; s: number }[] = []
      const seen = new Set<string>()
      for (const partial of beam) {
        const cands = [...new Set([...sample(tops, STACK_SAMPLE, rng), ...reqTops])]
        for (const c of cands) {
          if (!canAppend(partial, c, total)) continue
          const stack = [...partial, c]
          const k = stack.map((x) => x.id).join('>')
          if (seen.has(k)) continue
          seen.add(k)
          next.push({ stack, s: partialScore(toParts(stack)) })
        }
      }
      next.sort((a, b) => b.s - a.s)
      // Tope por padre: evita que todo el beam sea la misma base con distintas capas exteriores
      const perParent = Math.max(2, Math.ceil(beamWidth / 4))
      const taken = new Map<string, number>()
      beam = []
      for (const n of next) {
        const pk = n.stack.slice(0, -1).map((x) => x.id).join('>')
        const c = taken.get(pk) ?? 0
        if (step > 0 && c >= perParent) continue
        taken.set(pk, c + 1)
        beam.push(n.stack)
        if (beam.length >= beamWidth) break
      }
      if (!beam.length) return []
    }
    return beam.filter((st) => reqTops.every((r) => st.some((x) => x.id === r.id)))
  }

  let cands: Cand[] = []
  let stackFailed = false
  if (useSeparates) {
    const stacks = buildStacks([], N, STACK_BEAM)
    if (!stacks.length) stackFailed = true
    const c = stacks.map((st) => ({ parts: toParts(st), s: 0 }))
    for (const x of c) x.s = scoreParts(x.parts, ctx).total
    cands.push(...c.sort((a, b) => b.s - a.s).slice(0, 30))
  }
  if (useOnepiece) {
    const ops = reqOne.length ? reqOne : sample(onepieces, 20, rng)
    const c: Cand[] = []
    for (const op of ops) {
      for (const st of buildStacks([op], N - 1, 6)) {
        const parts = toParts(st)
        c.push({ parts, s: scoreParts(parts, ctx).total })
      }
    }
    cands.push(...c.sort((a, b) => b.s - a.s).slice(0, 15))
  }
  if (!cands.length) {
    if (N > 1 && !tops.some((t) => (t.layer?.rankMin ?? 1) >= 2)) {
      diagnostics.push('No tienes prendas que sirvan de capa intermedia o exterior (chaqueta, blazer, cárdigan, abrigo...).')
    } else if (stackFailed || useSeparates) {
      diagnostics.push(`Con tus prendas no se puede formar un look de ${N} capas compatible (volúmenes, largos u orden de capas).`)
    }
    return { looks: [], diagnostics }
  }

  // 2) Parte inferior
  const withBottoms: Cand[] = []
  for (const c of cands) {
    if (c.parts.onepiece) { withBottoms.push(c); continue }
    const bs = reqBottoms.length ? reqBottoms : sample(bottoms, BOTTOM_SAMPLE, rng)
    for (const b of bs) {
      const parts: Parts = { ...c.parts, bottom: b }
      withBottoms.push({ parts, s: partialScore(parts) })
    }
  }
  const stage2 = keepTop(withBottoms, FINAL_KEEP, topsKey, 3)

  // 3) Calzado
  let stage3: Cand[] = stage2
  if (shoes.length) {
    const out: Cand[] = []
    for (const c of stage2) {
      const ss = reqShoes.length ? reqShoes : sample(shoes, SHOES_SAMPLE, rng)
      for (const sh of ss) {
        const parts: Parts = { ...c.parts, shoes: sh }
        out.push({ parts, s: partialScore(parts) })
      }
    }
    stage3 = keepTop(out, FINAL_KEEP, coreKey, 2)
  } else {
    diagnostics.push('No hay calzado disponible: los looks se muestran sin zapatos.')
  }

  // 4) Accesorios (se añaden solo si no empeoran el conjunto)
  const accCount = Math.max(req.accessories ?? 1, reqAcc.length)
  const complete: { parts: Parts; scored: Scored }[] = []
  for (const c of stage3) {
    const parts = accCount > 0 && accs.length ? addAccessories(c.parts, accs, reqAcc, accCount, ctx, req, rng) : c.parts
    complete.push({ parts, scored: scoreParts(parts, ctx) })
  }

  // 5) A Look, filtrando obligatorias y firmas ya vistas
  const seenSig = new Set(req.excludeSignatures ?? [])
  const looks: Look[] = []
  for (const { parts, scored } of complete) {
    const ids = allItems(parts).map((i) => i.id)
    if (!required.every((r) => ids.includes(r.id))) continue
    const signature = signatureOf(ids)
    if (seenSig.has(signature)) continue
    looks.push(toLook(parts, scored, signature))
  }
  looks.sort((a, b) => b.score - a.score)

  // 6) Selección con diversidad
  const kindSize = new Map<string, number>()
  for (const p of pool) kindSize.set(p.kind, (kindSize.get(p.kind) ?? 0) + 1)
  const kindOf = new Map(pool.map((p) => [p.id, p.kind]))
  const picked = selectDiverse(looks, count, req.maxReuse ?? 3, (id) => kindSize.get(kindOf.get(id) ?? '') ?? 1)
  if (picked.length < count) {
    diagnostics.push(
      picked.length === 0
        ? 'No se ha podido generar ningún look nuevo con estos filtros (puede que ya los hayas visto todos).'
        : `Solo se han podido generar ${picked.length} looks distintos con estos filtros.`,
    )
  }
  return { looks: picked, diagnostics }
}

/** Mejores candidatos sin duplicados, reservando sitio a los vestidos/monos para que no los desplace el volumen de combinaciones separadas. */
function keepTop(c: Cand[], n: number, groupKey: (p: Parts) => string, perGroup: number): Cand[] {
  const counts = new Map<string, number>()
  const sorted = dedupe([...c].sort((a, b) => b.s - a.s)).filter((x) => {
    const k = groupKey(x.parts)
    const v = counts.get(k) ?? 0
    counts.set(k, v + 1)
    return v < perGroup
  })
  const one = sorted.filter((x) => x.parts.onepiece)
  const sep = sorted.filter((x) => !x.parts.onepiece)
  const oneQuota = Math.min(one.length, Math.round(n * 0.25))
  return [...sep.slice(0, n - oneQuota), ...one.slice(0, oneQuota)]
}

function dedupe(c: Cand[]): Cand[] {
  const seen = new Set<string>()
  return c.filter((x) => {
    const k = keyOf(x.parts)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function accessoryAllowed(a: PGarment, parts: Parts, req: GenerationRequest): boolean {
  if (a.type === 'cinturon') {
    return !!parts.onepiece || (!!parts.bottom && BELT_BOTTOMS.includes(parts.bottom.type))
  }
  if (a.type === 'bufanda') return req.climate === undefined || req.climate === 'cool' || req.climate === 'cold' || req.climate === 'mild'
  return true
}

function addAccessories(
  base: Parts, pool: PGarment[], required: PGarment[], count: number, ctx: ScoreCtx, req: GenerationRequest, rng: Rng,
): Parts {
  let cur: Parts = { ...base, accessories: [...required] }
  let curScore = scoreParts(cur, ctx).total
  const usedTypes = new Set(required.map((a) => a.type))
  for (let k = cur.accessories.length; k < count; k++) {
    let best: { p: Parts; s: number } | null = null
    const eligible = pool.filter((a) => !usedTypes.has(a.type) && accessoryAllowed(a, cur, req))
    for (const a of sample(eligible, 20, rng)) {
      const p: Parts = { ...cur, accessories: [...cur.accessories, a] }
      const s = scoreParts(p, ctx).total + rng() * 0.03
      if (!best || s > best.s) best = { p, s }
    }
    if (!best || best.s < curScore - 0.004) break
    cur = best.p
    curScore = best.s
    usedTypes.add(best.p.accessories[best.p.accessories.length - 1].type)
  }
  return cur
}

function toLook(parts: Parts, scored: Scored, signature: string): Look {
  const m = scored.modules
  const take = (r: ModuleResult, n: number) => r.notes.slice(0, n)
  return {
    tops: parts.tops.map((t) => t.id),
    bottom: parts.bottom?.id,
    onepiece: parts.onepiece?.id,
    shoes: parts.shoes?.id,
    accessories: parts.accessories.map((a) => a.id),
    score: Math.round(scored.total * 1000) / 10,
    modules: m,
    notes: [...take(m.color, 2), ...take(m.style, 1), ...take(m.silhouette, 2), ...take(m.occasion, 1)],
    signature,
  }
}

const idsOf = (l: Look) => [...(l.onepiece ? [l.onepiece] : []), ...l.tops, ...(l.bottom ? [l.bottom] : []), ...(l.shoes ? [l.shoes] : []), ...l.accessories]

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

/** Elige los mejores looks evitando repetir prendas y conjuntos casi idénticos (se relaja si faltan). */
function selectDiverse(sorted: Look[], count: number, maxReuse: number, poolSize: (id: string) => number): Look[] {
  const chosen: Look[] = []
  const sets: Set<string>[] = []
  const uses = new Map<string, number>()
  const thresholds = [0.5, 0.67, 0.84, 1.01]
  for (let pass = 0; pass < thresholds.length && chosen.length < count; pass++) {
    for (const look of sorted) {
      if (chosen.length >= count) break
      if (chosen.includes(look)) continue
      const ids = idsOf(look)
      const set = new Set(ids)
      if (sets.some((s) => jaccard(s, set) > thresholds[pass])) continue
      if (pass < thresholds.length - 1) {
        const over = ids.some((id) => (uses.get(id) ?? 0) >= Math.max(maxReuse, Math.ceil(count / poolSize(id))))
        if (over) continue
      }
      chosen.push(look)
      sets.push(set)
      for (const id of ids) uses.set(id, (uses.get(id) ?? 0) + 1)
    }
  }
  return chosen.sort((a, b) => b.score - a.score)
}
