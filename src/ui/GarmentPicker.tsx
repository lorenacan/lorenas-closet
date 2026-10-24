import { useMemo, useState } from 'react'
import { Sheet, GarmentImg } from './components'
import { IconSearch } from './icons'
import type { GarmentRecord } from '../db/db'
import type { Category } from '../catalog/categories'

export function GarmentPickerSheet({ title, garments, byId, selected, onChange, onClose }: {
  title: string
  garments: GarmentRecord[]
  byId: Map<string, Category>
  selected: string[]
  onChange: (ids: string[]) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return garments.filter((g) => !n || `${g.name ?? ''} ${byId.get(g.categoryId)?.name ?? ''} ${g.colorName ?? ''}`.toLowerCase().includes(n))
  }, [garments, byId, q])
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="search" style={{ marginBottom: 12 }}><IconSearch /><input className="input" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {shown.map((g) => {
          const on = selected.includes(g.id)
          return (
            <button key={g.id} className="card" style={{ outline: on ? '3px solid var(--ink)' : 'none', outlineOffset: -3 }} onClick={() => toggle(g.id)}>
              <div className="ph" style={{ aspectRatio: '1 / 1', padding: 6 }}><GarmentImg g={g} label={byId.get(g.categoryId)?.name} /></div>
              <div className="meta" style={{ padding: '0 8px 8px' }}><b style={{ fontSize: 11.5 }}>{g.name || byId.get(g.categoryId)?.name}</b></div>
            </button>
          )
        })}
      </div>
      <button className="btn block" style={{ marginTop: 16 }} onClick={onClose}>Listo ({selected.length})</button>
    </Sheet>
  )
}
