import { useMemo, useRef, useState } from 'react'
import { useNav } from '../lib/router'
import { useCategories, useGarments } from '../db/queries'
import { db, type GarmentRecord } from '../db/db'
import { categoryPath } from '../catalog/categories'
import { GarmentImg, TopBar, toast } from '../ui/components'
import { FITS, FORMALITY, INSULATION, LENGTHS, PATTERNS, SEASONS, label } from '../catalog/labels'
import { FAMILY_LABELS, STYLE_LABELS, classifyColor } from '../engine'
import { usePhoto } from '../lib/photoUrl'
import { useCutout } from '../lib/cutout'
import { colorSummary } from '../ui/pickers'

function Facts({ g, path }: { g: GarmentRecord; path: string }) {
  const info = g.colorHex ? classifyColor(g.colorHex) : null
  const styles = Object.entries(g.styles).sort((a, b) => b[1] - a[1]).map(([s, v]) => `${STYLE_LABELS[s] ?? s}${v < 1 ? ' (sec.)' : ''}`).join(', ')
  const rows: [string, string | undefined][] = [
    ['Categoría', path],
    ['Color', g.colorHex ? `${colorSummary(g.colorHex, g.colorName)}${info ? ` · ${FAMILY_LABELS[info.family].toLowerCase()}` : ''}` : undefined],
    ['Estampado', g.pattern ? label(PATTERNS, g.pattern) : undefined],
    ['Colores secundarios', g.secondaryHex.length ? `${g.secondaryHex.length}` : undefined],
    ['Estilo', styles || undefined],
    ['Corte', label(FITS, g.fit) || undefined],
    ['Largo', label(LENGTHS, g.length) || undefined],
    ['Tejido', g.fabric],
    ['Abrigo', g.insulation !== undefined ? INSULATION[g.insulation] : undefined],
    ['Formalidad', g.formality !== undefined ? FORMALITY[g.formality] : undefined],
    ['Temporada', g.seasons.length ? g.seasons.map((s) => label(SEASONS, s)).join(', ') : undefined],
    ['Notas', g.notes],
  ]
  return (
    <dl className="kv" style={{ marginTop: 14 }}>
      {rows.filter(([, v]) => v).map(([k, v]) => (<div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>))}
    </dl>
  )
}

/** Total de la tanda de revisión en curso; sobrevive a abrir y cerrar el formulario de corrección. */
export const reviewSession = { total: 0 }

/** Revisión una a una de las prendas rellenadas automáticamente. */
export function Review() {
  const nav = useNav()
  const garments = useGarments()
  const cats = useCategories()
  const skipped = useRef<string[]>([])
  const [skipTick, setSkipTick] = useState(0)
  const [lastOk, setLastOk] = useState<string | null>(null)

  const queue = useMemo(() => {
    const pend = (garments ?? []).filter((g) => g.review === 'pending').sort((a, b) => a.createdAt - b.createdAt)
    const sk = skipped.current
    return [...pend.filter((g) => !sk.includes(g.id)), ...sk.map((id) => pend.find((g) => g.id === id)).filter((g): g is GarmentRecord => !!g)]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garments, skipTick])
  const current = queue[0]
  const { version } = useCutout(current?.photoId)
  const photo = usePhoto(current?.photoId, 'full', version)

  if (!garments || !cats.ready) return <div className="screen" />

  async function ok() {
    if (!current) return
    await db.garments.update(current.id, { review: 'ok' })
    setLastOk(current.id)
  }
  async function undo() {
    if (!lastOk) return
    await db.garments.update(lastOk, { review: 'pending' })
    skipped.current = skipped.current.filter((id) => id !== lastOk)
    setLastOk(null)
    toast('Deshecho')
  }
  function skip() {
    if (!current) return
    skipped.current = [...skipped.current.filter((id) => id !== current.id), current.id]
    setSkipTick((n) => n + 1)
  }

  if (queue.length > reviewSession.total) reviewSession.total = queue.length
  const total = reviewSession.total
  const doneCount = total - queue.length

  if (!current) {
    return (
      <div className="screen">
        <TopBar title="Revisión" />
        <div className="empty">
          <h2>¡Todo revisado!</h2>
          <p>Has confirmado {doneCount} {doneCount === 1 ? 'prenda' : 'prendas'}.</p>
          <button className="btn" onClick={() => nav.tab({ name: 'closet' })}>Ir al armario</button>
          {lastOk && <div><button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => void undo()}>Deshacer la última</button></div>}
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <TopBar title="Revisión" right={<span className="small muted">{doneCount + 1} de {total}</span>} />
      <div className="bar" style={{ marginBottom: 14 }}><i style={{ width: `${(doneCount / total) * 100}%` }} /></div>

      <div className="photo-box">
        {photo.url ? <img src={photo.url} alt="" className={photo.cutout ? '' : 'flat'} /> : <GarmentImg g={current} variant="full" label={current.name} />}
      </div>
      <h2 style={{ marginTop: 14 }}>{current.name || cats.byId.get(current.categoryId)?.name}</h2>
      <Facts g={current} path={categoryPath(current.categoryId, cats.byId).join(' › ')} />

      <div style={{ height: 18 }} />
      <button className="btn block" onClick={() => void ok()}>✓ Está bien</button>
      <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => nav.push({ name: 'edit', id: current.id, fromReview: true })}>✎ No está bien: corregir</button>
      <div className="row between" style={{ marginTop: 12 }}>
        <button className="btn ghost sm" disabled={!lastOk} onClick={() => void undo()}>↶ Deshacer</button>
        <button className="btn ghost sm" disabled={queue.length < 2} onClick={skip}>Saltar para después</button>
      </div>
    </div>
  )
}
