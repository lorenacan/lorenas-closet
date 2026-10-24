/** Composición tipo moodboard en una caja de 100 x 125 (formato 4:5). */
export interface Cell { id: string; x: number; y: number; w: number; h: number }
export interface Zone { x: number; y: number; w: number; h: number }
export interface LookIds { onepiece?: string; tops: string[]; bottom?: string; shoes?: string; accessories: string[] }

export const BOX_W = 100
export const BOX_H = 125
const GAP = 2

function grid(zone: Zone, ids: string[], tall: boolean): Cell[] {
  const n = ids.length
  const { x, y, w, h } = zone
  const mk = (id: string, cx: number, cy: number, cw: number, ch: number): Cell => ({ id, x: cx, y: cy, w: cw, h: ch })
  if (n === 0) return []
  if (n === 1) return [mk(ids[0], x, y, w, h)]
  if (n === 2) {
    return tall
      ? [mk(ids[0], x, y, w, (h - GAP) / 2), mk(ids[1], x, y + (h + GAP) / 2, w, (h - GAP) / 2)]
      : [mk(ids[0], x, y, (w - GAP) / 2, h), mk(ids[1], x + (w + GAP) / 2, y, (w - GAP) / 2, h)]
  }
  if (n === 3) {
    if (tall) {
      const hh = (h - GAP) / 2, ww = (w - GAP) / 2
      return [mk(ids[0], x, y, w, hh), mk(ids[1], x, y + hh + GAP, ww, hh), mk(ids[2], x + ww + GAP, y + hh + GAP, ww, hh)]
    }
    const lw = w * 0.55, rw = w - lw - GAP, hh = (h - GAP) / 2
    return [mk(ids[0], x, y, lw, h), mk(ids[1], x + lw + GAP, y, rw, hh), mk(ids[2], x + lw + GAP, y + hh + GAP, rw, hh)]
  }
  const cols = n === 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const cw = (w - GAP * (cols - 1)) / cols, ch = (h - GAP * (rows - 1)) / rows
  return ids.map((id, i) => mk(id, x + (i % cols) * (cw + GAP), y + Math.floor(i / cols) * (ch + GAP), cw, ch))
}

/** Reparte las prendas de un look en celdas sin solaparse: capas arriba (la exterior primero), parte inferior debajo, calzado y accesorios a la derecha. */
export function collageCells(look: LookIds): Cell[] {
  const upper = [...look.tops].reverse()
  if (look.onepiece) upper.push(look.onepiece)
  const right = [...(look.shoes ? [look.shoes] : []), ...look.accessories]
  const leftW = right.length ? 63 : 94
  const cells: Cell[] = []
  if (look.bottom) {
    cells.push(...grid({ x: 3, y: 3, w: leftW, h: 57 }, upper, false))
    cells.push(...grid({ x: 3, y: 62, w: leftW, h: 60 }, [look.bottom], false))
  } else {
    cells.push(...grid({ x: 3, y: 3, w: leftW, h: 119 }, upper, true))
  }
  if (right.length) {
    const k = right.length
    const h = Math.min(36, (119 - GAP * (k - 1)) / k)
    const total = k * h + (k - 1) * GAP
    const y0 = 3 + (119 - total) / 2
    right.forEach((id, i) => cells.push({ id, x: 69, y: y0 + i * (h + GAP), w: 28, h }))
  }
  return cells
}
