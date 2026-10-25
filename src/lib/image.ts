import { cleanMask, type CleanOptions } from './cutoutClean'

/** Procesado de imágenes en el propio dispositivo (nada sale del móvil). */

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo codificar la imagen'))), type, quality))
}

async function load(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    return await createImageBitmap(blob)
  }
}

function fit(w: number, h: number, max: number): [number, number] {
  const s = Math.min(1, max / Math.max(w, h))
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))]
}

async function resize(src: ImageBitmap, max: number, type: string, quality?: number, flatten = false): Promise<Blob> {
  const [w, h] = fit(src.width, src.height, max)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  if (flatten) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h) }
  ctx.drawImage(src, 0, 0, w, h)
  return toBlob(c, type, quality)
}

export interface ProcessedPhoto { original: Blob; thumb: Blob; width: number; height: number }

/** Ganancia de exposición (>= 1): lleva el 98 % de la luz de la foto hacia casi blanco. Las fotos ya bien expuestas no cambian. */
export function exposureGain(luma: ArrayLike<number>): number {
  if (luma.length === 0) return 1
  const hist = new Uint32Array(256)
  for (let i = 0; i < luma.length; i++) hist[Math.max(0, Math.min(255, luma[i] | 0))]++
  const goal = luma.length * 0.98
  let acc = 0
  let p98 = 255
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= goal) { p98 = v; break }
  }
  return Math.min(1.3, Math.max(1, 248 / Math.max(p98, 1)))
}

export function exposureLut(gain: number, gamma = 0.92): Uint8Array {
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) lut[i] = Math.min(255, Math.round(255 * Math.pow((i / 255) * gain, gamma)))
  return lut
}

/** Corrige la exposición de un canvas (si hace falta) estimándola a partir de una versión pequeña. */
function autoExposure(canvas: HTMLCanvasElement): void {
  const k = 240 / Math.max(canvas.width, canvas.height)
  const small = document.createElement('canvas')
  small.width = Math.max(1, Math.round(canvas.width * k))
  small.height = Math.max(1, Math.round(canvas.height * k))
  const sctx = small.getContext('2d', { willReadFrequently: true })!
  sctx.drawImage(canvas, 0, 0, small.width, small.height)
  const d = sctx.getImageData(0, 0, small.width, small.height).data
  const luma = new Uint8Array(d.length / 4)
  for (let i = 0; i < luma.length; i++) luma[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]
  const gain = exposureGain(luma)
  if (gain < 1.02) return
  const lut = exposureLut(gain)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = img.data
  for (let i = 0; i < px.length; i += 4) { px[i] = lut[px[i]]; px[i + 1] = lut[px[i + 1]]; px[i + 2] = lut[px[i + 2]] }
  ctx.putImageData(img, 0, 0)
}

/** Reduce la foto original (máx. 1400 px), corrige la exposición y genera la miniatura (360 px). */
export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  const bmp = await load(file)
  const [w, h] = fit(bmp.width, bmp.height, 1400)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  autoExposure(c)
  const original = await toBlob(c, 'image/jpeg', 0.88)
  const thumbBmp = await createImageBitmap(c)
  const thumb = await resize(thumbBmp, 360, 'image/jpeg', 0.8, true)
  thumbBmp.close()
  const out = { original, thumb, width: bmp.width, height: bmp.height }
  bmp.close()
  return out
}

export interface CutBox { x: number; y: number; w: number; h: number; W: number; H: number }

/** Alfa de una imagen (p. ej. la que devuelve el modelo de recorte) como máscara 0..255. */
export async function maskFromBlob(blob: Blob): Promise<{ mask: Uint8Array; w: number; h: number }> {
  const bmp = await load(blob)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3]
  return { mask, w: width, h: height }
}

/**
 * Compone la prenda recortada: colores de la foto original + máscara. Recorta los bordes vacíos y reduce el tamaño.
 * `box` es la zona recortada en coordenadas de la foto original (sirve para retocar después).
 */
export async function composeCutout(original: Blob, mask: Uint8Array, W: number, H: number): Promise<{ cutout: Blob; thumb: Blob; box: CutBox }> {
  const bmp = await load(original)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, W, H)
  bmp.close()
  const img = ctx.getImageData(0, 0, W, H)
  let minX = W, minY = H, maxX = 0, maxY = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = mask[y * W + x]
      img.data[(y * W + x) * 4 + 3] = a
      if (a > 16) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX <= minX || maxY <= minY) { minX = 0; minY = 0; maxX = W - 1; maxY = H - 1 }
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02)
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
  maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad)
  const box: CutBox = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, W, H }
  ctx.putImageData(img, 0, 0)
  const crop = await createImageBitmap(c, box.x, box.y, box.w, box.h)
  const cutout = await resize(crop, 900, 'image/png')
  const thumb = await resize(crop, 360, 'image/png')
  crop.close()
  return { cutout, thumb, box }
}

/** Resultado del modelo de recorte -> máscara limpia -> prenda recortada. */
export async function processCutout(modelOutput: Blob, original: Blob, clean?: CleanOptions): Promise<{ cutout: Blob; thumb: Blob; box: CutBox }> {
  const { mask, w, h } = await maskFromBlob(modelOutput)
  return composeCutout(original, cleanMask(mask, w, h, clean), w, h)
}

/** Miniatura PNG (con transparencia) de una imagen ya recortada. */
export async function thumbFromCutout(png: Blob): Promise<Blob> {
  const bmp = await load(png)
  const t = await resize(bmp, 360, 'image/png')
  bmp.close()
  return t
}

/** Color dominante aproximado (hex) del centro de la imagen, ignorando píxeles transparentes. */
export async function dominantColor(blob: Blob): Promise<string | null> {
  const bmp = await load(blob)
  const S = 64
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const cropW = bmp.width * 0.6, cropH = bmp.height * 0.6
  ctx.drawImage(bmp, (bmp.width - cropW) / 2, (bmp.height - cropH) / 2, cropW, cropH, 0, 0, S, S)
  bmp.close()
  const { data } = ctx.getImageData(0, 0, S, S)
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
    const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    e.n++; e.r += data[i]; e.g += data[i + 1]; e.b += data[i + 2]
    bins.set(key, e)
  }
  let best: { n: number; r: number; g: number; b: number } | null = null
  for (const e of bins.values()) if (!best || e.n > best.n) best = e
  if (!best) return null
  const h = (v: number) => Math.round(v / best!.n).toString(16).padStart(2, '0')
  return `#${h(best.r)}${h(best.g)}${h(best.b)}`
}
