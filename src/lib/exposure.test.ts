import { describe, expect, it } from 'vitest'
import { exposureGain, exposureLut } from './image'

describe('exposición automática', () => {
  it('una foto oscura recibe ganancia; una bien expuesta, no', () => {
    const dark = Array.from({ length: 1000 }, (_, i) => 60 + (i % 140)) // máx ~199
    const bright = Array.from({ length: 1000 }, (_, i) => 100 + (i % 156)) // llega a 255
    expect(exposureGain(dark)).toBeGreaterThan(1.1)
    expect(exposureGain(bright)).toBe(1)
  })
  it('la ganancia está acotada para no quemar la foto', () => {
    expect(exposureGain(new Uint8Array(500).fill(90))).toBeLessThanOrEqual(1.3)
    expect(exposureGain([])).toBe(1)
  })
  it('la curva es monótona, conserva el negro y no se pasa de 255', () => {
    const lut = exposureLut(1.2)
    expect(lut[0]).toBe(0)
    expect(lut[255]).toBe(255)
    for (let i = 1; i < 256; i++) expect(lut[i]).toBeGreaterThanOrEqual(lut[i - 1])
    expect(lut[128]).toBeGreaterThan(128)
  })
})
