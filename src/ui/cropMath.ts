/** Geometría del recorte. Todo en fracciones (0..1) de la imagen mostrada. */
export interface Rect { x: number; y: number; w: number; h: number }
export type Handle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const MIN_SIZE = 0.08

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Mayor rectángulo centrado con esa proporción (ancho/alto en píxeles) dentro de una imagen de dw x dh. */
export function fitAspect(aspect: number, dw: number, dh: number): Rect {
  let w = 1
  let h = (w * dw) / (aspect * dh)
  if (h > 1) { h = 1; w = (h * aspect * dh) / dw }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

/** Nuevo rectángulo al arrastrar `handle` (dx, dy en fracciones). Con `aspect` solo se redimensiona por las esquinas. */
export function dragRect(handle: Handle, start: Rect, dx: number, dy: number, dw: number, dh: number, aspect: number | null): Rect {
  if (handle === 'move') {
    return { ...start, x: clamp(start.x + dx, 0, 1 - start.w), y: clamp(start.y + dy, 0, 1 - start.h) }
  }
  if (aspect && handle.length === 1) return start
  let l = start.x, r = start.x + start.w, t = start.y, b = start.y + start.h
  if (handle.includes('w')) l = clamp(l + dx, 0, r - MIN_SIZE)
  if (handle.includes('e')) r = clamp(r + dx, l + MIN_SIZE, 1)
  if (handle.includes('n')) t = clamp(t + dy, 0, b - MIN_SIZE)
  if (handle.includes('s')) b = clamp(b + dy, t + MIN_SIZE, 1)
  if (!aspect) return { x: l, y: t, w: r - l, h: b - t }

  // Proporción fija: manda el ancho; la esquina opuesta queda anclada
  const anchoredLeft = handle.includes('e')
  const anchoredTop = handle.includes('s')
  const maxW = anchoredLeft ? 1 - l : r
  const maxH = anchoredTop ? 1 - t : b
  let w = Math.max(MIN_SIZE, r - l)
  let h = (w * dw) / (aspect * dh)
  if (h > maxH) { h = maxH; w = (h * aspect * dh) / dw }
  if (w > maxW) { w = maxW; h = (w * dw) / (aspect * dh) }
  const x = anchoredLeft ? l : r - w
  const y = anchoredTop ? t : b - h
  return { x, y, w, h }
}
