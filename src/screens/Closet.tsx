import { useMemo, useState } from 'react'
import { useNav } from '../lib/router'
import { useCategories, useGarments } from '../db/queries'
import { KIND_ROOTS, descendantIds } from '../catalog/categories'
import { GarmentCard } from '../ui/GarmentCard'
import { Chip, Sheet, toast } from '../ui/components'
import { IconPlus, IconSearch, IconSliders } from '../ui/icons'
import { classifyColor, FAMILY_LABELS, STYLE_LABELS, STYLES } from '../engine'
import { SEASONS, STATUSES } from '../catalog/labels'
import { loadSampleWardrobe } from '../catalog/sample'

interface Filters { colors: string[]; styles: string[]; seasons: string[]; statuses: string[]; favOnly: boolean; sort: 'recent' | 'least' }
const NO_FILTERS: Filters = { colors: [], styles: [], seasons: [], statuses: [], favOnly: false, sort: 'recent' }

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

export function Closet() {
  const nav = useNav()
  const garments = useGarments()
  const cats = useCategories()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [f, setF] = useState<Filters>(NO_FILTERS)

  const roots = useMemo(() => cats.list.filter((c) => c.parentId === null), [cats.list])
  const activeRoot = useMemo(() => {
    let n = cat ? cats.byId.get(cat) : undefined
    while (n && n.parentId) n = cats.byId.get(n.parentId)
    return n
  }, [cat, cats.byId])
  const children = activeRoot ? cats.list.filter((c) => c.parentId === activeRoot.id) : []

  const shown = useMemo(() => {
    if (!garments) return []
    const ids = cat ? new Set(descendantIds(cat, cats.list)) : null
    const needle = q.trim().toLowerCase()
    let out = garments.filter((g) => {
      if (ids && !ids.has(g.categoryId)) return false
      if (f.favOnly && !g.favorite) return false
      if (f.statuses.length && !f.statuses.includes(g.status)) return false
      if (f.seasons.length && !f.seasons.some((s) => g.seasons.includes(s as never))) return false
      if (f.styles.length && !f.styles.some((s) => (g.styles[s] ?? 0) > 0)) return false
      if (f.colors.length && !(g.colorHex && f.colors.includes(classifyColor(g.colorHex).family))) return false
      if (needle) {
        const hay = `${g.name ?? ''} ${cats.byId.get(g.categoryId)?.name ?? ''} ${g.colorName ?? ''} ${g.fabric ?? ''} ${g.notes ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    if (f.sort === 'least') out = [...out].sort((a, b) => a.wearCount - b.wearCount || (a.lastWornAt ?? 0) - (b.lastWornAt ?? 0))
    return out
  }, [garments, cats.list, cats.byId, cat, q, f])

  const activeCount = f.colors.length + f.styles.length + f.seasons.length + f.statuses.length + (f.favOnly ? 1 : 0) + (f.sort !== 'recent' ? 1 : 0)

  if (!garments || !cats.ready) return <div className="screen" />

  return (
    <div className="screen">
      <div className="topbar">
        <div className="logo grow">Lorena’s Closet<small>{garments.length} prendas</small></div>
      </div>

      {garments.length === 0 ? (
        <div className="empty">
          <h2>Tu armario está vacío</h2>
          <p>Fotografía tu primera prenda: solo necesitas la foto, la categoría y el color.</p>
          <div><button className="btn" onClick={() => nav.push({ name: 'edit' })}>Añadir prenda</button></div>
          <div><button className="btn ghost" onClick={async () => { const n = await loadSampleWardrobe(); toast(`${n} prendas de ejemplo añadidas`) }}>Probar con prendas de ejemplo</button></div>
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="search grow" style={{ flex: 1 }}>
              <IconSearch />
              <input className="input" placeholder="Buscar en tu armario" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className={`icon-btn ${activeCount ? 'solid' : ''}`} onClick={() => setShowFilters(true)} aria-label="Filtros"><IconSliders /></button>
          </div>
          <div className="chips scroll">
            <Chip on={cat === null} onClick={() => setCat(null)}>Todo</Chip>
            {roots.map((r) => <Chip key={r.id} on={activeRoot?.id === r.id} onClick={() => setCat(r.id)}>{KIND_ROOTS.find((k) => k.id === r.id)?.short ?? r.name}</Chip>)}
          </div>
          {children.length > 0 && (
            <div className="chips scroll" style={{ marginTop: 4 }}>
              {children.map((c) => <Chip key={c.id} className="soft" on={cat === c.id} onClick={() => setCat(cat === c.id ? activeRoot!.id : c.id)}>{c.name}</Chip>)}
            </div>
          )}
          <div style={{ height: 8 }} />
          {shown.length === 0 ? (
            <div className="empty"><p>No hay prendas con esos filtros.</p></div>
          ) : (
            <div className="grid">
              {shown.map((g) => (
                <GarmentCard key={g.id} g={g} subtitle={cats.byId.get(g.categoryId)?.name ?? ''} onOpen={() => nav.push({ name: 'garment', id: g.id })} />
              ))}
            </div>
          )}
          <button className="fab" aria-label="Añadir prenda" onClick={() => nav.push({ name: 'edit', categoryId: cat ?? undefined })}><IconPlus /></button>
        </>
      )}

      {showFilters && (
        <Sheet title="Filtros" onClose={() => setShowFilters(false)}>
          <div className="field"><label>Orden</label>
            <div className="chips">
              <Chip on={f.sort === 'recent'} onClick={() => setF({ ...f, sort: 'recent' })}>Recientes</Chip>
              <Chip on={f.sort === 'least'} onClick={() => setF({ ...f, sort: 'least' })}>Menos usadas primero</Chip>
            </div>
          </div>
          <div className="field"><label>Color</label>
            <div className="chips">{Object.entries(FAMILY_LABELS).map(([k, l]) => <Chip key={k} on={f.colors.includes(k)} onClick={() => setF({ ...f, colors: toggle(f.colors, k) })}>{l}</Chip>)}</div>
          </div>
          <div className="field"><label>Estilo</label>
            <div className="chips">{STYLES.map((s) => <Chip key={s} on={f.styles.includes(s)} onClick={() => setF({ ...f, styles: toggle(f.styles, s) })}>{STYLE_LABELS[s]}</Chip>)}</div>
          </div>
          <div className="field"><label>Temporada</label>
            <div className="chips">{SEASONS.map(([k, l]) => <Chip key={k} on={f.seasons.includes(k)} onClick={() => setF({ ...f, seasons: toggle(f.seasons, k) })}>{l}</Chip>)}</div>
          </div>
          <div className="field"><label>Disponibilidad</label>
            <div className="chips">{STATUSES.map(([k, l]) => <Chip key={k} on={f.statuses.includes(k)} onClick={() => setF({ ...f, statuses: toggle(f.statuses, k) })}>{l}</Chip>)}</div>
          </div>
          <div className="switch"><span>Solo favoritas</span><input type="checkbox" checked={f.favOnly} onChange={(e) => setF({ ...f, favOnly: e.target.checked })} /></div>
          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn ghost grow" style={{ flex: 1 }} onClick={() => setF(NO_FILTERS)}>Limpiar</button>
            <button className="btn grow" style={{ flex: 1 }} onClick={() => setShowFilters(false)}>Ver {shown.length}</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
