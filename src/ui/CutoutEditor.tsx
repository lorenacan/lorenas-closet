import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import { composeCutout } from '../lib/image'
import { bumpCutoutVersion, queueCutout } from '../lib/cutout'
import { toast } from './components'

type Mode = 'erase' | 'restore' | 'move'

interface Work { W: number; H: number; orig: ImageData; view: ImageData; mask: Uint8Array; original: Blob }

async function bitmap(blob: Blob): Promise<ImageBitmap> {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }) } catch { return createImageBitmap(blob) }
}

/** Retoque del recorte con pincel: borrar lo que sobra, restaurar lo que se ha comido. */
export function CutoutEditor({ photoId, onClose }: { photoId: string; onClose: () => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'nobox' | 'saving'>('loading')
  const [mode, setMode] = useState<Mode>('erase')
  const [size, setSize] = useState(24)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [showOrig, setShowOrig] = useState(false)
  const [undoCount, setUndoCount] = useState(0)
  const [fit, setFit] = useState({ w: 300, h: 300 })
  const [ring, setRing] = useState<{ x: number; y: number } | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const work = useRef<Work | null>(null)
  const undo = useRef<Uint8Array[]>([])
  const drag = useRef<{ kind: 'paint' | 'pan'; lx: number; ly: number; px: number; py: number } | null>(null)
  const dirty = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null)

  // Carga: foto original + máscara actual (a partir del recorte y su zona)
  useEffect(() => {
    let alive = true
    void (async () => {
      const p = await db.photos.get(photoId)
      if (!p?.cutout || !p.cutBox) { if (alive) setState('nobox'); return }
      const { W, H } = p.cutBox
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      const ob = await bitmap(p.original)
      ctx.drawImage(ob, 0, 0, W, H)
      ob.close()
      const orig = ctx.getImageData(0, 0, W, H)
      ctx.clearRect(0, 0, W, H)
      const cb = await bitmap(p.cutout)
      ctx.drawImage(cb, p.cutBox.x, p.cutBox.y, p.cutBox.w, p.cutBox.h)
      cb.close()
      const cut = ctx.getImageData(0, 0, W, H)
      const mask = new Uint8Array(W * H)
      for (let i = 0; i < mask.length; i++) mask[i] = cut.data[i * 4 + 3]
      const view = new ImageData(new Uint8ClampedArray(orig.data), W, H)
      for (let i = 0; i < mask.length; i++) view.data[i * 4 + 3] = mask[i]
      if (!alive) return
      work.current = { W, H, orig, view, mask, original: p.original }
      setState('ready')
    })()
    return () => { alive = false }
  }, [photoId])

  const redraw = useCallback(() => {
    const w = work.current, c = canvas.current
    if (!w || !c) return
    c.width = w.W; c.height = w.H
    c.getContext('2d')!.putImageData(showOrig ? w.orig : w.view, 0, 0)
  }, [showOrig])
  useEffect(() => { if (state === 'ready') redraw() }, [state, redraw])

  useEffect(() => {
    if (state !== 'ready') return
    const fitBox = () => {
      const w = work.current, el = stage.current
      if (!w || !el) return
      const k = Math.min((el.clientWidth - 24) / w.W, (el.clientHeight - 24) / w.H)
      setFit({ w: Math.floor(w.W * k), h: Math.floor(w.H * k) })
    }
    fitBox()
    window.addEventListener('resize', fitBox)
    return () => window.removeEventListener('resize', fitBox)
  }, [state])

  const toImage = (e: React.PointerEvent): { x: number; y: number } => {
    const r = canvas.current!.getBoundingClientRect()
    const w = work.current!
    return { x: ((e.clientX - r.left) / r.width) * w.W, y: ((e.clientY - r.top) / r.height) * w.H }
  }

  function dab(cx: number, cy: number) {
    const w = work.current!
    const r = size
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w.W - 1, Math.ceil(cx + r))
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(w.H - 1, Math.ceil(cy + r))
    const erase = mode === 'erase'
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d > r) continue
        const k = d <= r * 0.7 ? 1 : (r - d) / (r * 0.3)
        const i = y * w.W + x
        const a = erase ? Math.round(w.mask[i] * (1 - k)) : Math.max(w.mask[i], Math.round(255 * k))
        w.mask[i] = a
        w.view.data[i * 4 + 3] = a
      }
    }
    const d = dirty.current
    dirty.current = d
      ? { x0: Math.min(d.x0, x0), y0: Math.min(d.y0, y0), x1: Math.max(d.x1, x1), y1: Math.max(d.y1, y1) }
      : { x0, y0, x1, y1 }
  }

  function flush() {
    const d = dirty.current, w = work.current, c = canvas.current
    if (!d || !w || !c || showOrig) return
    c.getContext('2d')!.putImageData(w.view, 0, 0, d.x0, d.y0, d.x1 - d.x0 + 1, d.y1 - d.y0 + 1)
    dirty.current = null
  }

  function onDown(e: React.PointerEvent) {
    if (!work.current || showOrig) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (mode === 'move') {
      drag.current = { kind: 'pan', lx: e.clientX, ly: e.clientY, px: pan.x, py: pan.y }
      return
    }
    undo.current.push(new Uint8Array(work.current.mask))
    if (undo.current.length > 12) undo.current.shift()
    setUndoCount(undo.current.length)
    const p = toImage(e)
    drag.current = { kind: 'paint', lx: p.x, ly: p.y, px: 0, py: 0 }
    dab(p.x, p.y)
    flush()
  }

  function onMove(e: React.PointerEvent) {
    const r = stage.current!.getBoundingClientRect()
    setRing({ x: e.clientX - r.left, y: e.clientY - r.top })
    const d = drag.current
    if (!d || !work.current) return
    if (d.kind === 'pan') {
      setPan({ x: d.px + e.clientX - d.lx, y: d.py + e.clientY - d.ly })
      return
    }
    const p = toImage(e)
    const dist = Math.hypot(p.x - d.lx, p.y - d.ly)
    const step = Math.max(1, size * 0.3)
    const n = Math.max(1, Math.ceil(dist / step))
    for (let i = 1; i <= n; i++) dab(d.lx + ((p.x - d.lx) * i) / n, d.ly + ((p.y - d.ly) * i) / n)
    d.lx = p.x; d.ly = p.y
    flush()
  }

  const onUp = () => { drag.current = null }

  function doUndo() {
    const w = work.current, prev = undo.current.pop()
    if (!w || !prev) return
    w.mask.set(prev)
    for (let i = 0; i < prev.length; i++) w.view.data[i * 4 + 3] = prev[i]
    setUndoCount(undo.current.length)
    redraw()
  }

  function changeZoom(f: number) {
    const z = Math.min(6, Math.max(1, zoom * f))
    const el = stage.current
    if (el) {
      const cx = el.clientWidth / 2, cy = el.clientHeight / 2
      const k = z / zoom
      setPan(z === 1 ? { x: 0, y: 0 } : { x: cx - (cx - pan.x) * k, y: cy - (cy - pan.y) * k })
    }
    setZoom(z)
  }

  async function save() {
    const w = work.current
    if (!w) return
    setState('saving')
    try {
      const { cutout, thumb, box } = await composeCutout(w.original, w.mask, w.W, w.H)
      const prev = await db.thumbs.get(photoId)
      await db.transaction('rw', db.photos, db.thumbs, async () => {
        await db.photos.update(photoId, { cutout, cutBox: box })
        await db.thumbs.put({ id: photoId, blob: thumb, cutout: true, rev: (prev?.rev ?? 0) + 1 })
      })
      bumpCutoutVersion(photoId)
      toast('Recorte guardado')
      onClose()
    } catch (e) {
      console.error(e)
      toast('No se pudo guardar el recorte')
      setState('ready')
    }
  }

  const dark = { background: 'transparent', color: '#fff', borderColor: '#777' }
  const on = { background: '#fff', color: '#0a0a0a', borderColor: '#fff' }
  const ringPx = size * (fit.w / (work.current?.W ?? 1)) * zoom * 2

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#0a0a0a', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="row between" style={{ padding: '12px 16px', color: '#fff' }}>
        <button className="btn ghost sm" onClick={onClose}>Cancelar</button>
        <b>Retocar recorte</b>
        <button className="btn sm" style={on} disabled={state !== 'ready'} onClick={() => void save()}>{state === 'saving' ? 'Guardando…' : 'Listo'}</button>
      </div>

      {state === 'loading' && <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#fff' }}>Cargando…</div>}
      {state === 'nobox' && (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#fff', padding: 28, textAlign: 'center' }}>
          <div>
            <p style={{ marginBottom: 16, fontWeight: 400 }}>Este recorte se hizo antes de poder retocarlo. Rehazlo una vez (tarda unos segundos) y después podrás usar el pincel.</p>
            <button className="btn" style={on} onClick={() => { queueCutout(photoId, true); toast('Rehaciendo el recorte…'); onClose() }}>Rehacer el recorte</button>
          </div>
        </div>
      )}

      {(state === 'ready' || state === 'saving') && (
        <>
          <div
            ref={stage}
            style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', display: 'grid', placeItems: 'center', touchAction: 'none' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => setRing(null)}
          >
            <div style={{
              width: fit.w, height: fit.h, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center',
              background: 'repeating-conic-gradient(#d9d9d9 0% 25%, #f4f4f4 0% 50%) 50% / 20px 20px',
            }}>
              <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} />
            </div>
            {ring && mode !== 'move' && !showOrig && (
              <div style={{ position: 'absolute', left: ring.x - ringPx / 2, top: ring.y - ringPx / 2, width: ringPx, height: ringPx, borderRadius: '50%', border: `2px solid ${mode === 'erase' ? '#ff5a5a' : '#5aff8a'}`, pointerEvents: 'none' }} />
            )}
          </div>

          <div style={{ padding: '12px 16px calc(16px + env(safe-area-inset-bottom))', display: 'grid', gap: 12 }}>
            <div className="chips" style={{ justifyContent: 'center' }}>
              <button className="chip" style={mode === 'erase' ? on : dark} onClick={() => setMode('erase')}>Borrar</button>
              <button className="chip" style={mode === 'restore' ? on : dark} onClick={() => setMode('restore')}>Restaurar</button>
              <button className="chip" style={mode === 'move' ? on : dark} onClick={() => setMode('move')}>Mover</button>
            </div>
            <div className="row" style={{ color: '#fff', gap: 12 }}>
              <span className="small">Pincel</span>
              <input type="range" min={4} max={80} value={size} onChange={(e) => setSize(Number(e.target.value))} style={{ flex: 1, accentColor: '#fff' }} />
            </div>
            <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="chip" style={dark} aria-label="Acercar" onClick={() => changeZoom(1.5)}>＋</button>
              <button className="chip" style={dark} aria-label="Alejar" onClick={() => changeZoom(1 / 1.5)}>－</button>
              <button className="chip" style={{ ...dark, opacity: undoCount ? 1 : 0.4 }} disabled={!undoCount} onClick={doUndo}>↶ Deshacer</button>
              <button className="chip" style={showOrig ? on : dark} onClick={() => setShowOrig((v) => !v)}>Ver original</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
