import { hexToOklch } from '../engine'
import { ALL_SWATCHES, type Swatch } from '../catalog/colors'

function lab(hex: string): [number, number, number] {
  const { L, C, h } = hexToOklch(hex)
  const r = (h * Math.PI) / 180
  return [L, C * Math.cos(r), C * Math.sin(r)]
}

const swLab = ALL_SWATCHES.map((s) => ({ s, l: lab(s.hex) }))

/** Color con nombre del catálogo más cercano a un hex cualquiera. */
export function nearestSwatch(hex: string): Swatch {
  const [L, a, b] = lab(hex)
  let best = swLab[0]
  let bd = Infinity
  for (const e of swLab) {
    const d = (e.l[0] - L) ** 2 * 1.5 + (e.l[1] - a) ** 2 + (e.l[2] - b) ** 2
    if (d < bd) { bd = d; best = e }
  }
  return best.s
}
