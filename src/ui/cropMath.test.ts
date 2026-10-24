import { describe, expect, it } from 'vitest'
import { dragRect, fitAspect, MIN_SIZE, type Rect } from './cropMath'

const full: Rect = { x: 0, y: 0, w: 1, h: 1 }
const ratio = (r: Rect, dw: number, dh: number) => (r.w * dw) / (r.h * dh)
const inside = (r: Rect) => r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= 1 + 1e-9 && r.y + r.h <= 1 + 1e-9

describe('geometría del recorte', () => {
  it('fitAspect: rectángulo centrado con la proporción pedida', () => {
    const r = fitAspect(1, 800, 1000)
    expect(ratio(r, 800, 1000)).toBeCloseTo(1)
    expect(inside(r)).toBe(true)
    expect(r.x + r.w / 2).toBeCloseTo(0.5)
    expect(r.y + r.h / 2).toBeCloseTo(0.5)
    const wide = fitAspect(4 / 5, 1000, 500)
    expect(ratio(wide, 1000, 500)).toBeCloseTo(0.8)
    expect(inside(wide)).toBe(true)
  })
  it('mover no se sale de la imagen', () => {
    const r = dragRect('move', { x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 5, -5, 800, 1000, null)
    expect(r).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 })
  })
  it('redimensionar libre respeta límites y tamaño mínimo', () => {
    const a = dragRect('se', { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, 3, 3, 800, 1000, null)
    expect(a.x + a.w).toBeCloseTo(1)
    expect(a.y + a.h).toBeCloseTo(1)
    const b = dragRect('nw', { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, 3, 3, 800, 1000, null)
    expect(b.w).toBeGreaterThanOrEqual(MIN_SIZE - 1e-9)
    expect(inside(b)).toBe(true)
    const c = dragRect('e', { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, -3, 0, 800, 1000, null)
    expect(c.w).toBeCloseTo(MIN_SIZE)
  })
  it('con proporción fija se mantiene en cualquier esquina', () => {
    const start = fitAspect(1, 800, 1000)
    for (const h of ['nw', 'ne', 'sw', 'se'] as const) {
      for (const [dx, dy] of [[0.1, 0.05], [-0.2, 0.3], [0.5, -0.5], [-1, -1], [1, 1]]) {
        const r = dragRect(h, start, dx, dy, 800, 1000, 1)
        expect(ratio(r, 800, 1000)).toBeCloseTo(1, 5)
        expect(inside(r)).toBe(true)
      }
    }
  })
  it('con proporción fija, las asas de borde no deforman el recorte', () => {
    const start = fitAspect(0.8, 800, 1000)
    expect(dragRect('e', start, 0.1, 0, 800, 1000, 0.8)).toEqual(start)
  })
  it('imagen completa como punto de partida', () => {
    expect(dragRect('move', full, 0.3, 0.3, 800, 1000, null)).toEqual(full)
  })
})
