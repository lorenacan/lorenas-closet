import { useMemo } from 'react'
import { BOX_H, collageCells, type LookIds } from './collageLayout'
import { GarmentImg } from './components'
import type { GarmentRecord } from '../db/db'
import type { Category } from '../catalog/categories'

interface Props {
  look: LookIds
  garments: Map<string, GarmentRecord>
  categories: Map<string, Category>
}

/** Moodboard del look: las prendas juntas sobre fondo neutro, organizadas por capas y categorías. */
export function Collage({ look, garments, categories }: Props) {
  const cells = useMemo(() => collageCells(look), [look])
  return (
    <div className="collage">
      {cells.map((c) => {
        const g = garments.get(c.id)
        return (
          <div key={c.id} className="cell" style={{ left: `${c.x}%`, top: `${(c.y / BOX_H) * 100}%`, width: `${c.w}%`, height: `${(c.h / BOX_H) * 100}%`, padding: '1.5%' }}>
            {g ? <GarmentImg g={g} label={categories.get(g.categoryId)?.name} /> : null}
          </div>
        )
      })}
    </div>
  )
}
