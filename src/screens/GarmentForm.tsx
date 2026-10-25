import { useEffect, useRef, useState } from 'react'
import { Cropper } from '../ui/Cropper'
import { RetouchButton } from '../ui/RetouchButton'
import { useNav } from '../lib/router'
import { blankGarment, deleteGarment, looksUsing, saveGarment, useCategories } from '../db/queries'
import { db, type GarmentRecord } from '../db/db'
import { Accordion, Chip, Segmented, TopBar, toast } from '../ui/components'
import { CategoryPicker, ColorPicker, colorSummary } from '../ui/pickers'
import { IconCamera, IconImage } from '../ui/icons'
import { dominantColor } from '../lib/image'
import { nearestSwatch } from '../lib/colorMatch'
import { usePhoto } from '../lib/photoUrl'
import { useCutout } from '../lib/cutout'
import { FITS, FORMALITY, INSULATION, INTENSITIES, LENGTHS, LIGHTNESS, PATTERNS, SEASONS, STATUSES, TEMPS } from '../catalog/labels'
import { STYLE_LABELS, STYLES, classifyColor, type Fit, type Intensity, type LengthLevel, type Lightness, type Pattern, type Season, type Temp } from '../engine'

export function GarmentForm({ id, categoryId, fromReview }: { id?: string; categoryId?: string; fromReview?: boolean }) {
  const nav = useNav()
  const cats = useCategories()
  const [g, setG] = useState<GarmentRecord | null>(null)
  const [file, setFile] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string>()
  const [removeBg, setRemoveBg] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoColor, setAutoColor] = useState(false)
  const [cropSrc, setCropSrc] = useState<Blob | null>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (id) void db.garments.get(id).then((r) => r && setG(r))
    else setG(blankGarment(categoryId ?? ''))
  }, [id, categoryId])

  const existing = usePhoto(id ? g?.photoId : undefined, 'full')
  const { state: cutState } = useCutout(g?.photoId)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  if (!g || !cats.ready) return <div className="screen" />
  const set = (patch: Partial<GarmentRecord>) => setG({ ...g, ...patch })

  async function applyFile(f: Blob) {
    setCropSrc(null)
    setFile(f)
    setPreview(URL.createObjectURL(f))
    if (!g!.colorHex) {
      const hex = await dominantColor(f).catch(() => null)
      if (hex) {
        const n = nearestSwatch(hex)
        setG((cur) => (cur && !cur.colorHex ? { ...cur, colorHex: n.hex, colorName: n.name } : cur))
        setAutoColor(true)
      }
    }
  }

  async function recropExisting() {
    const p = g!.photoId ? await db.photos.get(g!.photoId) : undefined
    if (p) setCropSrc(p.original)
  }

  const cinfo = g.colorHex ? classifyColor(g.colorHex) : null

  async function save() {
    if (!g!.categoryId) { toast('Elige una categoría'); return }
    setSaving(true)
    try {
      await saveGarment(fromReview ? { ...g!, review: 'ok' } : g!, file ?? undefined, removeBg)
      toast(id ? 'Prenda actualizada' : 'Prenda guardada')
      nav.back()
    } catch (e) {
      toast('No se pudo guardar la prenda')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    const used = await looksUsing(g!.id)
    const msg = used.length
      ? `¿Eliminar esta prenda? También se eliminarán ${used.length} look${used.length > 1 ? 's' : ''} guardado${used.length > 1 ? 's' : ''} que la incluyen.`
      : '¿Eliminar esta prenda?'
    if (!confirm(msg)) return
    await deleteGarment(g!.id)
    toast('Prenda eliminada')
    nav.tab({ name: 'closet' })
  }

  const cycleStyle = (s: string) => {
    const cur = g.styles[s]
    const next = { ...g.styles }
    if (cur === undefined) next[s] = 1
    else if (cur === 1) next[s] = 0.6
    else delete next[s]
    set({ styles: next })
  }
  const toggleSeason = (s: Season) => set({ seasons: g.seasons.includes(s) ? g.seasons.filter((x) => x !== s) : [...g.seasons, s] })

  const img = preview ?? existing.url
  const flat = preview ? true : !existing.cutout

  return (
    <div className="screen">
      {cropSrc && <Cropper file={cropSrc} onDone={(b) => void applyFile(b)} onSkip={() => void applyFile(cropSrc)} onCancel={() => setCropSrc(null)} />}
      <TopBar title={id ? 'Editar prenda' : 'Nueva prenda'} />

      <div className="photo-box">
        {img ? <img src={img} alt="" className={flat ? 'flat' : ''} /> : <span className="muted small">Añade una foto de la prenda</span>}
        {(cutState === 'pending') && <div className="ov"><span className="spinner" /> Quitando fondo…</div>}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button type="button" className="btn ghost sm" style={{ flex: 1 }} onClick={() => camRef.current?.click()}><span style={{ width: 18, height: 18, display: 'inline-flex' }}><IconCamera /></span> Hacer foto</button>
        <button type="button" className="btn ghost sm" style={{ flex: 1 }} onClick={() => galRef.current?.click()}><span style={{ width: 18, height: 18, display: 'inline-flex' }}><IconImage /></span> Galería</button>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropSrc(f); e.target.value = '' }} />
        <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropSrc(f); e.target.value = '' }} />
      </div>
      {id && g.photoId && !file && existing.cutout && <div style={{ marginTop: 10 }}><RetouchButton photoId={g.photoId} /></div>}
      {(file || (id && g.photoId)) && (
        <button type="button" className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => (file ? setCropSrc(file) : void recropExisting())}>Recortar o girar la foto</button>
      )}
      {(file || (id && !existing.cutout && g.photoId)) && (
        <div className="switch">
          <span className="small">Quitar el fondo (en tu móvil, sin enviar la foto)</span>
          <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} />
        </div>
      )}

      <div style={{ height: 18 }} />
      <div className="field"><label>Categoría</label>
        <CategoryPicker value={g.categoryId} cats={cats.list} byId={cats.byId} onChange={(cid) => set({ categoryId: cid })} />
      </div>

      <div className="field"><label>Color principal</label>
        <ColorPicker hex={g.colorHex} onPick={(hex, name) => { set({ colorHex: hex, colorName: name }); setAutoColor(false) }} />
        {g.colorHex && <p className="small muted" style={{ marginTop: 8 }}>{autoColor ? 'Detectado en la foto: ' : ''}{colorSummary(g.colorHex, g.colorName)}</p>}
      </div>

      <div className="field"><label>Nombre (opcional)</label>
        <input className="input" placeholder="Ej.: Camisa de lino azul" value={g.name ?? ''} onChange={(e) => set({ name: e.target.value || undefined })} />
      </div>

      <Accordion title="Más detalles (opcional)">
        <div className="field" style={{ marginTop: 6 }}><label>Estampado</label>
          <div className="chips">{PATTERNS.map(([k, l]) => <Chip key={k} on={(g.pattern ?? 'solid') === k} onClick={() => set({ pattern: k as Pattern })}>{l}</Chip>)}</div>
        </div>
        <div className="field"><label>Colores secundarios</label>
          <ColorPicker multi={g.secondaryHex} onPick={(hex) => set({ secondaryHex: g.secondaryHex.includes(hex) ? g.secondaryHex.filter((h) => h !== hex) : [...g.secondaryHex, hex] })} />
        </div>
        <div className="field"><label>Estilo <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(toca: principal → secundario → quitar)</span></label>
          <div className="chips">
            {STYLES.map((s) => {
              const v = g.styles[s]
              return <Chip key={s} on={v === 1} className={v === 0.6 ? 'sec' : ''} onClick={() => cycleStyle(s)}>{STYLE_LABELS[s]}{v === 0.6 ? ' ·' : ''}</Chip>
            })}
          </div>
          <p className="tiny muted" style={{ marginTop: 6 }}>Si lo dejas vacío, se usa el estilo habitual de ese tipo de prenda.</p>
        </div>
        <div className="field"><label>Corte y silueta</label>
          <div className="chips">{FITS.map(([k, l]) => <Chip key={k} on={g.fit === k} onClick={() => set({ fit: g.fit === k ? undefined : (k as Fit) })}>{l}</Chip>)}</div>
        </div>
        <div className="field"><label>Largo</label>
          <div className="chips">{LENGTHS.map(([k, l]) => <Chip key={k} on={g.length === k} onClick={() => set({ length: g.length === k ? undefined : (k as LengthLevel) })}>{l}</Chip>)}</div>
        </div>
        <div className="field"><label>Tejido y textura</label>
          <input className="input" placeholder="Algodón, lino, punto, cuero…" value={g.fabric ?? ''} onChange={(e) => set({ fabric: e.target.value || undefined })} />
        </div>
        <div className="field"><label>Abrigo</label>
          <Segmented value={g.insulation} options={INSULATION.map((l, i) => [i, l] as [number, string])} onChange={(v) => set({ insulation: g.insulation === v ? undefined : v })} />
        </div>
        <div className="field"><label>Formalidad</label>
          <Segmented value={g.formality} options={FORMALITY.map((l, i) => [i, l] as [number, string])} onChange={(v) => set({ formality: g.formality === v ? undefined : v })} />
        </div>
        <div className="field"><label>Temporada recomendada</label>
          <div className="chips">{SEASONS.map(([k, l]) => <Chip key={k} on={g.seasons.includes(k)} onClick={() => toggleSeason(k)}>{l}</Chip>)}</div>
        </div>
        {cinfo && (
          <>
            <div className="field"><label>Temperatura del color</label>
              <div className="chips">{TEMPS.map(([k, l]) => <Chip key={k} on={(g.colorTemp ?? cinfo.temp) === k} onClick={() => set({ colorTemp: k as Temp })}>{l}</Chip>)}</div>
            </div>
            <div className="field"><label>Intensidad</label>
              <div className="chips">{INTENSITIES.map(([k, l]) => <Chip key={k} on={(g.intensity ?? cinfo.intensity) === k} onClick={() => set({ intensity: k as Intensity })}>{l}</Chip>)}</div>
            </div>
            <div className="field"><label>Claridad</label>
              <div className="chips">{LIGHTNESS.map(([k, l]) => <Chip key={k} on={(g.lightness ?? cinfo.lightness) === k} onClick={() => set({ lightness: k as Lightness })}>{l}</Chip>)}</div>
            </div>
          </>
        )}
        <div className="field"><label>Disponibilidad</label>
          <div className="chips">{STATUSES.map(([k, l]) => <Chip key={k} on={g.status === k} onClick={() => set({ status: k })}>{l}</Chip>)}</div>
        </div>
        <div className="field"><label>Notas</label>
          <textarea className="input" rows={3} value={g.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} />
        </div>
      </Accordion>

      <div style={{ height: 16 }} />
      <button className="btn block" disabled={saving} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar prenda'}</button>
      {id && <button className="btn danger block" style={{ marginTop: 10 }} onClick={() => void remove()}>Eliminar prenda</button>}
    </div>
  )
}
