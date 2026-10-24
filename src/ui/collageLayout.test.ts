import { describe, expect, it } from 'vitest'
import { BOX_H, BOX_W, collageCells, type Cell, type LookIds } from './collageLayout'

const overlaps = (a: Cell, b: Cell) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01

const make = (n: number, o: Partial<LookIds> = {}): LookIds => ({
  tops: Array.from({ length: n }, (_, i) => `t${i}`), bottom: 'b', shoes: 's', accessories: ['a1', 'a2'], ...o,
})

describe('composición del collage', () => {
  for (const n of [0, 1, 2, 3, 4, 5]) {
    it(`${n} capas: celdas dentro de la caja y sin solapes`, () => {
      const cells = collageCells(make(n))
      expect(cells).toHaveLength(n + 1 + 1 + 2)
      for (const c of cells) {
        expect(c.x).toBeGreaterThanOrEqual(0)
        expect(c.y).toBeGreaterThanOrEqual(0)
        expect(c.x + c.w).toBeLessThanOrEqual(BOX_W)
        expect(c.y + c.h).toBeLessThanOrEqual(BOX_H)
      }
      for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) expect(overlaps(cells[i], cells[j])).toBe(false)
    })
  }
  it('con vestido (sin parte inferior) usa toda la columna', () => {
    const cells = collageCells({ onepiece: 'v', tops: ['abrigo'], shoes: 's', accessories: [] })
    expect(cells.map((c) => c.id).sort()).toEqual(['abrigo', 's', 'v'])
    const v = cells.find((c) => c.id === 'v')!
    expect(v.h).toBeGreaterThan(50)
  })
  it('la capa exterior se coloca primero (la más grande)', () => {
    const cells = collageCells({ tops: ['base', 'media', 'abrigo'], bottom: 'b', accessories: [] })
    expect(cells[0].id).toBe('abrigo')
  })
})
