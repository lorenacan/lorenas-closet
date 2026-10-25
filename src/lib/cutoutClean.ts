/**
 * Limpieza de la máscara (canal alfa) que devuelve el modelo de recorte de fondo:
 * quita motas sueltas, rellena huecos pequeños y suaviza el borde (sin halos).
 * Trabaja solo sobre la máscara; los colores se toman de la foto original.
 */
export interface CleanOptions {
  /** Un trozo se descarta si mide menos que esta fracción del trozo más grande. */
  minComponentRatio?: number
  /** Un hueco interior se rellena si mide menos que esta fracción de la prenda. */
  maxHoleRatio?: number
  /** Píxeles que se encoge el borde para quitar el halo del fondo. */
  erode?: number
}

interface Labels { labels: Int32Array; sizes: number[]; border: boolean[] }

/** Componentes conexos (4 vecinos) de los píxeles cuyo valor binario coincide con `value`. */
function components(bin: Uint8Array, w: number, h: number, value: number): Labels {
  const labels = new Int32Array(w * h).fill(-1)
  const sizes: number[] = []
  const border: boolean[] = []
  const stack = new Int32Array(w * h)
  for (let start = 0; start < bin.length; start++) {
    if (bin[start] !== value || labels[start] !== -1) continue
    const id = sizes.length
    let size = 0
    let touches = false
    let sp = 0
    stack[sp++] = start
    labels[start] = id
    while (sp > 0) {
      const p = stack[--sp]
      size++
      const x = p % w, y = (p - x) / w
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches = true
      if (x > 0 && bin[p - 1] === value && labels[p - 1] === -1) { labels[p - 1] = id; stack[sp++] = p - 1 }
      if (x < w - 1 && bin[p + 1] === value && labels[p + 1] === -1) { labels[p + 1] = id; stack[sp++] = p + 1 }
      if (y > 0 && bin[p - w] === value && labels[p - w] === -1) { labels[p - w] = id; stack[sp++] = p - w }
      if (y < h - 1 && bin[p + w] === value && labels[p + w] === -1) { labels[p + w] = id; stack[sp++] = p + w }
    }
    sizes.push(size)
    border.push(touches)
  }
  return { labels, sizes, border }
}

function erode4(a: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(a.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      let v = a[p]
      if (x > 0 && a[p - 1] < v) v = a[p - 1]
      if (x < w - 1 && a[p + 1] < v) v = a[p + 1]
      if (y > 0 && a[p - w] < v) v = a[p - w]
      if (y < h - 1 && a[p + w] < v) v = a[p + w]
      out[p] = v
    }
  }
  return out
}

/** Desenfoque [1 2 1]/4 en ambos ejes: da un borde suave de ~1 px. */
function feather(a: Uint8Array, w: number, h: number): Uint8Array {
  const tmp = new Uint8Array(a.length)
  const out = new Uint8Array(a.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      const l = x > 0 ? a[p - 1] : a[p], r = x < w - 1 ? a[p + 1] : a[p]
      tmp[p] = (l + 2 * a[p] + r + 2) >> 2
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      const u = y > 0 ? tmp[p - w] : tmp[p], d = y < h - 1 ? tmp[p + w] : tmp[p]
      out[p] = (u + 2 * tmp[p] + d + 2) >> 2
    }
  }
  return out
}

export function cleanMask(alpha: Uint8Array, w: number, h: number, opts: CleanOptions = {}): Uint8Array {
  const { minComponentRatio = 0.02, maxHoleRatio = 0.004, erode = 1 } = opts
  let a: Uint8Array = Uint8Array.from(alpha, (v) => (v < 40 ? 0 : v > 235 ? 255 : v))

  // 1) Quitar motas: trozos muy pequeños comparados con el mayor
  let bin: Uint8Array = Uint8Array.from(a, (v) => (v >= 128 ? 1 : 0))
  const fg = components(bin, w, h, 1)
  if (fg.sizes.length > 0) {
    const largest = Math.max(...fg.sizes)
    const keep = fg.sizes.map((s) => s >= Math.max(30, largest * minComponentRatio))
    for (let p = 0; p < a.length; p++) {
      if (bin[p] === 1 && !keep[fg.labels[p]]) a[p] = 0
    }
    bin = Uint8Array.from(a, (v) => (v >= 128 ? 1 : 0))
  }

  // 2) Rellenar huecos pequeños dentro de la prenda (no los del fondo, ni los grandes como el asa de un bolso)
  const bg = components(bin, w, h, 0)
  let area = 0
  for (let p = 0; p < bin.length; p++) area += bin[p]
  const maxHole = Math.max(4, area * maxHoleRatio)
  for (let p = 0; p < a.length; p++) {
    if (bin[p] === 0) {
      const id = bg.labels[p]
      if (!bg.border[id] && bg.sizes[id] <= maxHole) a[p] = 255
    }
  }

  // 3) Encoger el borde (quita el halo del fondo) y suavizarlo
  for (let i = 0; i < erode; i++) a = erode4(a, w, h)
  return feather(a, w, h)
}
