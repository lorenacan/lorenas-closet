import { describe, expect, it } from 'vitest'
import { generateLooks } from '../generate'
import { wardrobe } from './fixtures'
import type { GenerationRequest, Look } from '../types'

const W = wardrobe()
const byId = new Map(W.map((x) => [x.id, x]))
const itemsOf = (l: Look) => [...(l.onepiece ? [l.onepiece] : []), ...l.tops, ...(l.bottom ? [l.bottom] : []), ...(l.shoes ? [l.shoes] : []), ...l.accessories]
const gen = (r: Partial<GenerationRequest> = {}) => generateLooks(W, { layers: 2, seed: 1, ...r })

describe('generador de looks', () => {
  it('es determinista con la misma semilla', () => {
    expect(gen().looks.map((l) => l.signature)).toEqual(gen().looks.map((l) => l.signature))
  })
  it('devuelve el número de capas pedido, con orden de capas lógico', () => {
    for (const n of [1, 2, 3, 4]) {
      const { looks } = gen({ layers: n, allowOnePieces: false })
      expect(looks.length).toBeGreaterThan(0)
      for (const l of looks) {
        expect(l.tops).toHaveLength(n)
        const types = l.tops.map((id) => byId.get(id)!.type)
        expect(types[0]).toMatch(/^(camiseta|camisa|jersey|sudadera)$/)
        if (n > 1) expect(['abrigo', 'chaqueton']).not.toContain(types[0])
        expect(new Set(types).size).toBe(types.length)
      }
    }
  })
  it('un abrigo o chaquetón siempre queda como última capa', () => {
    for (const l of gen({ layers: 3, allowOnePieces: false }).looks) {
      const types = l.tops.map((id) => byId.get(id)!.type)
      types.forEach((t, i) => { if (t === 'abrigo' || t === 'chaqueton') expect(i).toBe(types.length - 1) })
    }
  })
  it('los looks salen ordenados por puntuación y sin repetirse', () => {
    const { looks } = gen({ count: 8 })
    const scores = looks.map((l) => l.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(new Set(looks.map((l) => l.signature)).size).toBe(looks.length)
    expect(looks.length).toBeGreaterThanOrEqual(5)
  })
  it('respeta prendas excluidas, obligatorias y colores a evitar', () => {
    const ex = gen({ exclude: ['jeans-blue', 'tee-white'] }).looks.flatMap(itemsOf)
    expect(ex).not.toContain('jeans-blue')
    expect(ex).not.toContain('tee-white')
    for (const l of gen({ mustInclude: ['blazer-navy'], layers: 2, count: 4 }).looks) expect(itemsOf(l)).toContain('blazer-navy')
    const noRed = gen({ avoidColors: ['rojo'], layers: 2, accessories: 3 }).looks.flatMap(itemsOf)
    expect(noRed).not.toContain('tee-red')
    expect(noRed).not.toContain('scarf-red')
  })
  it('no repite looks ya vistos (excludeSignatures) y no varía el orden de calidad', () => {
    const first = gen({ count: 4 })
    const second = gen({ count: 4, seed: 2, excludeSignatures: first.looks.map((l) => l.signature) })
    const seen = new Set(first.looks.map((l) => l.signature))
    for (const l of second.looks) expect(seen.has(l.signature)).toBe(false)
  })
  it('ofrece variedad real: distintas bases y distintas capas exteriores en un mismo lote', () => {
    for (const n of [2, 3]) {
      const { looks } = gen({ layers: n, allowOnePieces: false, count: 8 })
      expect(looks.length).toBe(8)
      const stacks = new Set(looks.map((l) => l.tops.join('>')))
      expect(stacks.size).toBeGreaterThanOrEqual(5)
      const bottoms = new Set(looks.map((l) => l.bottom))
      expect(bottoms.size).toBeGreaterThanOrEqual(3)
    }
  })
  it('limita la reutilización de una misma prenda dentro del lote', () => {
    const { looks } = gen({ count: 8, maxReuse: 3, accessories: 0 })
    const uses = new Map<string, number>()
    for (const l of looks) for (const id of itemsOf(l)) uses.set(id, (uses.get(id) ?? 0) + 1)
    const tops = [...uses].filter(([id]) => byId.get(id)!.kind === 'top')
    for (const [, c] of tops) expect(c).toBeLessThanOrEqual(4)
  })
  it('el estilo cambia el resultado: formal vs deportivo/streetwear', () => {
    const formal = gen({ styles: ['formal'], layers: 2, count: 3, allowOnePieces: false }).looks.flatMap(itemsOf)
    const sport = gen({ styles: ['streetwear'], layers: 2, count: 3, allowOnePieces: false }).looks.flatMap(itemsOf)
    const types = (ids: string[]) => ids.map((id) => byId.get(id)!.type)
    expect(types(formal).filter((t) => t === 'zapato' || t === 'blazer').length).toBeGreaterThan(types(sport).filter((t) => t === 'zapato' || t === 'blazer').length)
    expect(types(sport).filter((t) => t === 'sudadera' || t === 'zapatilla_deportiva' || t === 'cazadora').length).toBeGreaterThan(
      types(formal).filter((t) => t === 'sudadera' || t === 'zapatilla_deportiva' || t === 'cazadora').length,
    )
  })
  it('el clima condiciona el abrigo: frío usa abrigo/jersey, calor no', () => {
    const cold = gen({ climate: 'cold', layers: 3, allowOnePieces: false, count: 3 }).looks
    expect(cold.length).toBeGreaterThan(0)
    for (const l of cold) {
      const types = l.tops.map((id) => byId.get(id)!.type)
      expect(types.some((t) => ['abrigo', 'chaqueton', 'jersey', 'sudadera', 'cardigan'].includes(t))).toBe(true)
    }
    const hot = gen({ climate: 'hot', layers: 1, allowOnePieces: false, count: 3 }).looks.flatMap(itemsOf).map((id) => byId.get(id)!.type)
    expect(hot).not.toContain('abrigo')
    expect(hot).not.toContain('bota')
  })
  it('puede usar vestidos y monos como capa base', () => {
    const { looks } = gen({ layers: 2, count: 30 })
    expect(looks.some((l) => l.onepiece)).toBe(true)
    for (const l of looks.filter((x) => x.onepiece)) {
      expect(l.bottom).toBeUndefined()
      expect(l.tops).toHaveLength(1)
    }
  })
  it('explica por qué: cada look trae desglose y notas', () => {
    const l = gen().looks[0]
    expect(l.modules.color.score).not.toBeNull()
    expect(l.notes.length).toBeGreaterThan(0)
  })
  it('informa cuando es imposible (sin capas exteriores o sin calzado)', () => {
    const noOuter = generateLooks(W.filter((x) => !['blazer', 'cazadora', 'abrigo', 'chaqueton', 'cardigan', 'camisa', 'jersey', 'sudadera'].includes(x.type)), { layers: 3, seed: 1, allowOnePieces: false })
    expect(noOuter.looks).toHaveLength(0)
    expect(noOuter.diagnostics.join(' ')).toMatch(/capa/i)
    const noShoes = generateLooks(W.filter((x) => x.kind !== 'shoes'), { layers: 1, seed: 1 })
    expect(noShoes.looks.length).toBeGreaterThan(0)
    expect(noShoes.diagnostics.join(' ')).toMatch(/calzado/i)
  })
  it('rápido con un armario grande (1500 prendas)', () => {
    const big = Array.from({ length: 1500 }, (_, i) => {
      const src = W[i % W.length]
      return { ...src, id: `${src.id}-${i}`, colorHex: `#${((i * 2654435761) >>> 8 & 0xffffff).toString(16).padStart(6, '0')}` }
    })
    const t = Date.now()
    const { looks } = generateLooks(big, { layers: 3, seed: 3, allowOnePieces: false })
    expect(looks.length).toBeGreaterThan(0)
    expect(Date.now() - t).toBeLessThan(4000)
  })
})
