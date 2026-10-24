import { describe, expect, it } from 'vitest'
import { assignRanks, canAppend, scoreLayers } from '../score/layers'
import { prepare } from '../prepare'
import type { Fit } from '../types'
import { bottom, top } from './fixtures'

const P = (type: string, extra = {}) => prepare(top(type, '#222222', extra))

describe('lógica de capas', () => {
  it('una capa: solo prendas aptas como base', () => {
    expect(assignRanks([P('camiseta')])).not.toBeNull()
    expect(assignRanks([P('sudadera')])).not.toBeNull()
    expect(assignRanks([P('blazer')])).toBeNull()
    expect(assignRanks([P('abrigo')])).toBeNull()
  })
  it('el chaquetón siempre es capa exterior', () => {
    expect(assignRanks([P('camiseta'), P('chaqueton')])).toEqual([1, 4])
    expect(assignRanks([P('chaqueton'), P('camiseta')])).toBeNull()
  })
  it('tres capas: camiseta + camisa + blazer', () => {
    expect(assignRanks([P('camiseta'), P('camisa'), P('blazer')])).toEqual([1, 2, 3])
  })
  it('cuatro capas exigen escalonado completo', () => {
    expect(assignRanks([P('camiseta'), P('camisa'), P('jersey'), P('abrigo')])).toEqual([1, 2, 3, 4])
    expect(assignRanks([P('camiseta'), P('jersey'), P('sudadera'), P('abrigo')])).not.toBeNull()
    expect(assignRanks([P('camiseta'), P('camisa'), P('cardigan'), P('blazer'), P('abrigo'), P('chaqueton')])).toBeNull()
  })
  it('no repite el mismo tipo de prenda ni usa imposibles de volumen', () => {
    expect(canAppend([P('camiseta')], P('camiseta', { id: 'otra' }), 2)).toBe(false)
    // sudadera (volumen 3) bajo cazadora (2) es posible pero penalizada; bajo algo de volumen 0-1 con mangas no
    expect(canAppend([P('sudadera')], P('blazer'), 2)).toBe(true)
  })
  it('penaliza volumen interior mayor que el exterior', () => {
    const ok = scoreLayers({ tops: [P('camiseta'), P('blazer')], bottom: prepare(bottom('pantalon', '#111')), accessories: [] }).score!
    const worse = scoreLayers({ tops: [P('sudadera'), P('blazer')], bottom: prepare(bottom('pantalon', '#111')), accessories: [] }).score!
    expect(ok).toBeGreaterThan(worse)
  })
  it('equilibra siluetas: ancho arriba + recto abajo mejor que ancho + ancho', () => {
    const mk = (topFit: Fit, botFit: Fit) =>
      scoreLayers({ tops: [P('camiseta', { fit: topFit })], bottom: prepare(bottom('pantalon', '#111', { fit: botFit })), accessories: [] }).score!
    expect(mk('oversize', 'slim')).toBeGreaterThan(mk('oversize', 'wide'))
    expect(mk('slim', 'wide')).toBeGreaterThan(mk('wide', 'wide'))
  })
})
