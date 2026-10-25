import { describe, expect, it } from 'vitest'
import { cleanMask } from './cutoutClean'

const W = 60, H = 60
const blank = () => new Uint8Array(W * H)
const rect = (m: Uint8Array, x0: number, y0: number, x1: number, y1: number, v = 255) => {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * W + x] = v
}
const at = (m: Uint8Array, x: number, y: number) => m[y * W + x]

describe('limpieza de la máscara del recorte', () => {
  it('quita motas sueltas pero conserva la prenda', () => {
    const m = blank()
    rect(m, 10, 10, 40, 40)
    rect(m, 50, 5, 53, 8) // mota
    const out = cleanMask(m, W, H)
    expect(at(out, 25, 25)).toBe(255)
    expect(at(out, 51, 6)).toBe(0)
  })
  it('conserva dos piezas grandes (un par de zapatos)', () => {
    const m = blank()
    rect(m, 3, 10, 25, 45)
    rect(m, 35, 10, 57, 45)
    const out = cleanMask(m, W, H)
    expect(at(out, 14, 27)).toBe(255)
    expect(at(out, 46, 27)).toBe(255)
  })
  it('rellena agujeros pequeños del interior', () => {
    const m = blank()
    rect(m, 5, 5, 55, 55)
    rect(m, 28, 28, 30, 30, 0) // agujero de 4 px
    const out = cleanMask(m, W, H)
    expect(at(out, 28, 28)).toBeGreaterThan(200)
  })
  it('no rellena huecos grandes (p. ej. el asa de un bolso) ni el fondo', () => {
    const m = blank()
    rect(m, 5, 5, 55, 55)
    rect(m, 18, 18, 42, 42, 0) // hueco de 576 px
    const out = cleanMask(m, W, H)
    expect(at(out, 30, 30)).toBe(0)
    expect(at(out, 0, 0)).toBe(0)
  })
  it('encoge el borde y lo suaviza', () => {
    const m = blank()
    rect(m, 10, 10, 50, 50)
    const out = cleanMask(m, W, H)
    expect(at(out, 10, 30)).toBeLessThan(255) // el borde exterior baja
    expect(at(out, 30, 30)).toBe(255)
    expect(at(out, 12, 30)).toBeGreaterThan(at(out, 10, 30))
  })
  it('quita el velo débil del fondo (alfa muy bajo)', () => {
    const m = blank()
    rect(m, 10, 10, 40, 40)
    rect(m, 45, 45, 58, 58, 20)
    const out = cleanMask(m, W, H)
    expect(at(out, 50, 50)).toBe(0)
  })
})
