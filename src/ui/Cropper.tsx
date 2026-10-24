import { useEffect, useMemo, useRef, useState } from 'react'
import { dragRect, fitAspect, type Handle, type Rect } from './cropMath'

const MAX_SIDE = 2400
const ASPECTS: [string, number | null][] = [['Libre', null], ['1:1', 1], ['4:5', 4 / 5], ['3:4', 3 / 4]]
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 }

async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }) } catch { return createImageBitmap(blob) }
}

/** Dibuja el bitmap girado `quarters` cuartos de vuelta, con un máximo de MAX_SIDE por lado. */
function rotated(src: ImageBitmap, quarters: number): HTMLCanvasElement {
  const swap = quarters % 2 === 1
  const sw = swap ? src.height : src.width
  const sh = swap ? src.width : src.height
  const k = Math.min(1, MAX_SIDE / Math.max(sw, sh))
  const c = document.createElement('canvas')
  c.width = Math.round(sw * k)
  c.height = Math.round(sh * k)
  const ctx = c.getContext('2d')!
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate((quarters * Math.PI) / 2)
  const w = src.width * k, h = src.height * k
  ctx.drawImage(src, -w / 2, -h / 2, w, h)
  return c
}

interface Props { file: Blob; onDone: (cropped: Blob) => void; onSkip: () => void; onCancel: () => void }

/** Recortar y girar una foto antes de guardarla (todo en el dispositivo). */
export function Cropper({ file, onDone, onSkip, onCancel }: Props) {
  const [bmp, setBmp] = useState<ImageBitmap | null>(null)
  const [quarters, setQuarters] = useState(0)
  const [aspect, setAspect] = useState<number | null>(null)
  const [rect, setRect] = useState<Rect>(FULL)
  const [box, setBox] = useState({ w: 300, h: 300 })
  const stage = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Rect } | null>(null)

  useEffect(() => {
    let alive = true
    void loadBitmap(file).then((b) => { if (alive) setBmp(b) })
    return () => { alive = false }
  }, [file])

  const work = useMemo(() => (bmp ? rotated(bmp, quarters) : null), [bmp, quarters])

  // Tamaño con el que se muestra la imagen dentro del espacio disponible
  useEffect(() => {
    if (!work) return
    const fitBox = () => {
      const el = stage.current
      if (!el) return
      const maxW = el.clientWidth - 44, maxH = el.clientHeight - 44
      const k = Math.min(maxW / work.width, maxH / work.height)
      setBox({ w: Math.floor(work.width * k), h: Math.floor(work.height * k) })
    }
    fitBox()
    window.addEventListener('resize', fitBox)
    return () => window.removeEventListener('resize', fitBox)
  }, [work])

  useEffect(() => {
    if (!work || !canvasRef.current) return
    const c = canvasRef.current
    c.width = work.width
    c.height = work.height
    c.getContext('2d')!.drawImage(work, 0, 0)
    setRect(aspect ? fitAspect(aspect, work.width, work.height) : FULL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work])

  function chooseAspect(a: number | null) {
    setAspect(a)
    if (work) setRect(a ? fitAspect(a, box.w, box.h) : FULL)
  }

  function onDown(e: React.PointerEvent, handle: Handle) {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { handle, x: e.clientX, y: e.clientY, start: rect }
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    setRect(dragRect(d.handle, d.start, (e.clientX - d.x) / box.w, (e.clientY - d.y) / box.h, box.w, box.h, aspect))
  }
  const onUp = () => { drag.current = null }

  function confirm() {
    if (!work) return
    const sx = Math.round(rect.x * work.width), sy = Math.round(rect.y * work.height)
    const sw = Math.max(1, Math.round(rect.w * work.width)), sh = Math.max(1, Math.round(rect.h * work.height))
    const out = document.createElement('canvas')
    out.width = sw
    out.height = sh
    const ctx = out.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, sw, sh)
    ctx.drawImage(work, sx, sy, sw, sh, 0, 0, sw, sh)
    out.toBlob((b) => { if (b) onDone(b) }, 'image/jpeg', 0.92)
  }

  const pos = (h: Handle): React.CSSProperties => {
    const s: React.CSSProperties = { position: 'absolute', width: 44, height: 44, marginLeft: -22, marginTop: -22, touchAction: 'none', display: 'grid', placeItems: 'center' }
    s.left = h.includes('w') ? '0%' : h.includes('e') ? '100%' : '50%'
    s.top = h.includes('n') ? '0%' : h.includes('s') ? '100%' : '50%'
    return s
  }
  const visible = HANDLES.filter((h) => !aspect || h.length === 2)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#0a0a0a', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="row between" style={{ padding: '12px 16px', color: '#fff' }}>
        <button className="btn ghost sm" onClick={onCancel}>Cancelar</button>
        <b>Recortar foto</b>
        <button className="btn sm" style={{ background: '#fff', color: '#0a0a0a', borderColor: '#fff' }} disabled={!work} onClick={confirm}>Listo</button>
      </div>

      <div ref={stage} style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', padding: 22, overflow: 'hidden', position: 'relative' }}>
        {work && (
          <div style={{ position: 'relative', width: box.w, height: box.h, touchAction: 'none' }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            <div
              onPointerDown={(e) => onDown(e, 'move')}
              style={{
                position: 'absolute', left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%`,
                boxShadow: '0 0 0 9999px rgba(0,0,0,.6)', border: '2px solid #fff', touchAction: 'none', cursor: 'move',
                backgroundImage: 'linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)',
                backgroundSize: '33.333% 33.333%',
              }}
            >
              {visible.map((h) => (
                <div key={h} style={pos(h)} onPointerDown={(e) => onDown(e, h)}>
                  <span style={{ width: h.length === 2 ? 16 : 10, height: h.length === 2 ? 16 : 10, background: '#fff', borderRadius: h.length === 2 ? 4 : 5, boxShadow: '0 0 0 1px rgba(0,0,0,.4)' }} />
                </div>
              ))}
            </div>
          </div>
        )}
        {!work && <span style={{ color: '#fff' }}>Cargando foto…</span>}
      </div>

      <div style={{ padding: '12px 16px calc(16px + env(safe-area-inset-bottom))', display: 'grid', gap: 12 }}>
        <div className="chips" style={{ justifyContent: 'center' }}>
          {ASPECTS.map(([l, a]) => (
            <button key={l} className={`chip ${aspect === a ? 'on' : ''}`} style={aspect === a ? { background: '#fff', color: '#0a0a0a', borderColor: '#fff' } : { background: 'transparent', color: '#fff', borderColor: '#777' }} onClick={() => chooseAspect(a)}>{l}</button>
          ))}
          <button className="chip" style={{ background: 'transparent', color: '#fff', borderColor: '#777' }} onClick={() => setQuarters((q) => (q + 1) % 4)}>↻ Girar</button>
        </div>
        <button className="btn ghost sm" style={{ background: 'transparent', color: '#fff', borderColor: '#777' }} onClick={onSkip}>Usar la foto sin recortar</button>
      </div>
    </div>
  )
}
