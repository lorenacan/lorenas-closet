import type { Garment } from '../types'

let n = 0
export const g = (type: string, kind: Garment['kind'], colorHex: string, extra: Partial<Garment> = {}): Garment =>
  ({ id: `${type}-${++n}`, type, kind, colorHex, ...extra })

export const top = (type: string, hex: string, extra: Partial<Garment> = {}) => g(type, 'top', hex, extra)
export const bottom = (type: string, hex: string, extra: Partial<Garment> = {}) => g(type, 'bottom', hex, extra)
export const shoes = (type: string, hex: string, extra: Partial<Garment> = {}) => g(type, 'shoes', hex, extra)
export const acc = (type: string, hex: string, extra: Partial<Garment> = {}) => g(type, 'accessory', hex, extra)
export const one = (type: string, hex: string, extra: Partial<Garment> = {}) => g(type, 'onepiece', hex, extra)

/** Armario de prueba realista. */
export function wardrobe(): Garment[] {
  return [
    top('camiseta', '#ffffff', { id: 'tee-white' }),
    top('camiseta', '#111111', { id: 'tee-black' }),
    top('camiseta', '#d2691e', { id: 'tee-orange' }),
    top('camiseta', '#c8102e', { id: 'tee-red', intensity: 'vivid' }),
    top('camisa', '#a9c6e8', { id: 'shirt-blue' }),
    top('camisa', '#f4efe6', { id: 'shirt-ecru' }),
    top('jersey', '#1f2a44', { id: 'knit-navy' }),
    top('jersey', '#c19a6b', { id: 'knit-camel' }),
    top('sudadera', '#6b6b6b', { id: 'hoodie-grey' }),
    top('cardigan', '#e8dcc8', { id: 'cardi-cream' }),
    top('blazer', '#1f2a44', { id: 'blazer-navy' }),
    top('blazer', '#222222', { id: 'blazer-black' }),
    top('cazadora', '#3b5b8c', { id: 'jacket-denim' }),
    top('abrigo', '#c19a6b', { id: 'coat-camel' }),
    top('chaqueton', '#2a2a2a', { id: 'peacoat-black' }),
    bottom('pantalon', '#4f6d99', { id: 'jeans-blue', subtype: 'vaquero' }),
    bottom('pantalon', '#111111', { id: 'trousers-black', subtype: 'vestir' }),
    bottom('pantalon', '#d8c3a5', { id: 'chino-beige', subtype: 'chino' }),
    bottom('pantalon', '#5a5a3a', { id: 'cargo-green', subtype: 'cargo' }),
    bottom('falda', '#111111', { id: 'skirt-black', subtype: 'midi' }),
    bottom('pantalon_corto', '#4f6d99', { id: 'shorts-denim', subtype: 'vaquero' }),
    shoes('zapatilla_casual', '#ffffff', { id: 'sneakers-white' }),
    shoes('zapatilla_deportiva', '#222222', { id: 'trainers-black' }),
    shoes('zapato', '#3b2314', { id: 'shoes-brown' }),
    shoes('bota', '#111111', { id: 'boots-black' }),
    shoes('sandalia', '#c19a6b', { id: 'sandals-camel' }),
    acc('bolso', '#111111', { id: 'bag-black' }),
    acc('cinturon', '#3b2314', { id: 'belt-brown' }),
    acc('bufanda', '#c8102e', { id: 'scarf-red' }),
    one('vestido', '#111111', { id: 'dress-black', subtype: 'midi' }),
  ]
}
