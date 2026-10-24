import { describe, expect, it } from 'vitest'
import { classifyColor, pairHarmony } from '../color'
import { scoreColor } from '../score/color'
import type { Parts } from '../prepare'
import { prepare } from '../prepare'
import { bottom, shoes, top } from './fixtures'

const parts = (t: string, tHex: string, b: string, bHex: string, s: string, sHex: string): Parts => ({
  tops: [prepare(top(t, tHex))], bottom: prepare(bottom(b, bHex)), shoes: prepare(shoes(s, sHex)), accessories: [],
})
const ctx = { risk: 'balanced' as const, preferColors: [] }

describe('clasificación de color', () => {
  it('distingue azul marino, azul cielo, azul eléctrico y azul petróleo', () => {
    expect(classifyColor('#1f2a44').family).toBe('marino')
    expect(classifyColor('#87ceeb').family).toBe('azul')
    expect(classifyColor('#0047ff').intensity).toBe('vivid')
    expect(classifyColor('#0f5e6e').family).toBe('turquesa')
  })
  it('distingue beige, camel, marrón chocolate', () => {
    expect(classifyColor('#e8dcc8').family).toBe('beige')
    expect(classifyColor('#c19a6b').family).toBe('camel')
    expect(classifyColor('#4a2c1a').family).toBe('marron')
    for (const h of ['#e8dcc8', '#c19a6b', '#4a2c1a']) expect(classifyColor(h).neutral).toBe(true)
  })
  it('asigna temperatura, luminosidad e intensidad', () => {
    expect(classifyColor('#c8102e')).toMatchObject({ temp: 'warm', intensity: 'vivid' })
    expect(classifyColor('#111111')).toMatchObject({ lightness: 'dark', neutral: true, family: 'negro' })
    expect(classifyColor('#ffffff').lightness).toBe('light')
  })
})

describe('armonía de pares', () => {
  it('detecta esquemas por diferencia de tono', () => {
    expect(pairHarmony(classifyColor('#2a5db0'), classifyColor('#d2691e')).scheme).toBe('complementario')
    expect(pairHarmony(classifyColor('#2a5db0'), classifyColor('#2aa7b0')).scheme).toBe('analogo')
  })
  it('no es absoluta: complementarios vivos puntúan menos que apagados', () => {
    const vivid = pairHarmony(classifyColor('#0033ff'), classifyColor('#ff8000')).score
    const muted = pairHarmony(classifyColor('#4f6d99'), classifyColor('#c19a6b')).score
    expect(muted).toBeGreaterThan(vivid)
  })
})

describe('puntuación de color del look', () => {
  it('neutros clásicos puntúan alto', () => {
    const r = scoreColor(parts('camiseta', '#ffffff', 'pantalon', '#1f2a44', 'zapatilla_casual', '#c19a6b'), ctx)
    expect(r.score!).toBeGreaterThan(0.8)
  })
  it('un color protagonista con neutros es mejor que tres colores vivos', () => {
    const good = scoreColor(parts('camiseta', '#c8102e', 'pantalon', '#111111', 'zapatilla_casual', '#ffffff'), ctx).score!
    const bad = scoreColor(parts('camiseta', '#ff2a2a', 'pantalon', '#00c853', 'zapatilla_casual', '#ffd600'), ctx).score!
    expect(good).toBeGreaterThan(bad + 0.15)
  })
  it('todo en negro es válido y coherente', () => {
    const r = scoreColor(parts('camiseta', '#111111', 'pantalon', '#111111', 'bota', '#111111'), ctx)
    expect(r.score!).toBeGreaterThan(0.75)
  })
  it('marino + beige/camel es mejor que marino + negro', () => {
    const a = scoreColor(parts('camiseta', '#1f2a44', 'pantalon', '#d8c3a5', 'zapato', '#ffffff'), ctx).score!
    const b = scoreColor(parts('camiseta', '#1f2a44', 'pantalon', '#111111', 'zapato', '#111111'), ctx).score!
    expect(a).toBeGreaterThan(b)
  })
  it('sin color registrado el módulo no aplica', () => {
    const p: Parts = { tops: [prepare({ id: 'x', kind: 'top', type: 'camiseta' })], accessories: [] }
    expect(scoreColor(p, ctx).score).toBeNull()
  })
})
