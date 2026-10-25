import { Fragment } from 'react'
import { useNav } from '../lib/router'
import { useCategories, useGarment } from '../db/queries'
import { db } from '../db/db'
import { categoryPath } from '../catalog/categories'
import { TopBar, toast } from '../ui/components'
import { IconEdit, IconHeart } from '../ui/icons'
import { usePhoto } from '../lib/photoUrl'
import { cutoutError, queueCutout, useCutout } from '../lib/cutout'
import { FITS, FORMALITY, INSULATION, LENGTHS, PATTERNS, SEASONS, STATUSES, label } from '../catalog/labels'
import { STYLE_LABELS, classifyColor, FAMILY_LABELS } from '../engine'
import { colorSummary } from '../ui/pickers'
import { setRequest } from '../lib/genStore'
import { RetouchButton } from '../ui/RetouchButton'

export function GarmentDetail({ id }: { id: string }) {
  const nav = useNav()
  const g = useGarment(id)
  const cats = useCategories()
  const { version, state } = useCutout(g?.photoId)
  const photo = usePhoto(g?.photoId, 'full', version)
  if (!g || !cats.ready) return <div className="screen" />
  const info = g.colorHex ? classifyColor(g.colorHex) : null
  const styles = Object.entries(g.styles).sort((a, b) => b[1] - a[1]).map(([s, v]) => `${STYLE_LABELS[s] ?? s}${v < 1 ? ' (sec.)' : ''}`).join(', ')
  const rows: [string, string | undefined][] = [
    ['Categoría', categoryPath(g.categoryId, cats.byId).join(' › ')],
    ['Color', g.colorHex ? `${colorSummary(g.colorHex, g.colorName)}${info ? ` · familia ${FAMILY_LABELS[info.family].toLowerCase()}` : ''}` : undefined],
    ['Estampado', g.pattern && g.pattern !== 'solid' ? label(PATTERNS, g.pattern) : g.pattern === 'solid' ? 'Liso' : undefined],
    ['Estilo', styles || undefined],
    ['Corte', label(FITS, g.fit) || undefined],
    ['Largo', label(LENGTHS, g.length) || undefined],
    ['Tejido', g.fabric],
    ['Abrigo', g.insulation !== undefined ? INSULATION[g.insulation] : undefined],
    ['Formalidad', g.formality !== undefined ? FORMALITY[g.formality] : undefined],
    ['Temporada', g.seasons.length ? g.seasons.map((s) => label(SEASONS, s)).join(', ') : undefined],
    ['Disponibilidad', label(STATUSES, g.status)],
    ['Usos', `${g.wearCount}${g.lastWornAt ? ` · último: ${new Date(g.lastWornAt).toLocaleDateString('es-ES')}` : ''}`],
    ['Notas', g.notes],
  ]
  return (
    <div className="screen">
      <TopBar
        title={g.name || cats.byId.get(g.categoryId)?.name || 'Prenda'}
        right={
          <>
            <button className="icon-btn" aria-label="Favorito" onClick={() => void db.garments.update(g.id, { favorite: !g.favorite })}><IconHeart filled={g.favorite} /></button>
            <button className="icon-btn" aria-label="Editar" onClick={() => nav.push({ name: 'edit', id: g.id })}><IconEdit /></button>
          </>
        }
      />
      <div className="photo-box">
        {photo.url ? <img src={photo.url} alt="" className={photo.cutout ? '' : 'flat'} /> : <div className="tile" style={{ width: '70%', height: '70%', background: g.colorHex ?? '#e6e6e6' }} />}
        {state === 'pending' && <div className="ov"><span className="spinner" /> Quitando fondo…</div>}
      </div>
      {g.photoId && photo.cutout && state !== 'pending' && (
        <div style={{ marginTop: 10 }}><RetouchButton photoId={g.photoId} /></div>
      )}
      {g.photoId && !photo.cutout && state !== 'pending' && (
        <div style={{ marginTop: 10 }}>
          <button className="btn ghost sm" onClick={() => { queueCutout(g.photoId!); toast('Quitando el fondo…') }}>Quitar el fondo</button>
          {state === 'failed' && <p className="small muted" style={{ marginTop: 6 }}>No se pudo quitar el fondo ({cutoutError(g.photoId)}). Comprueba la conexión: el modelo se descarga una vez.</p>}
        </div>
      )}
      <dl className="kv" style={{ marginTop: 18 }}>
        {rows.filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
      </dl>
      <div style={{ height: 20 }} />
      <button
        className="btn block"
        onClick={() => { setRequest({ mustInclude: [g.id] }); nav.tab({ name: 'generate' }) }}
      >Crear looks con esta prenda</button>
    </div>
  )
}
