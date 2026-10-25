import { GarmentImg } from './components'
import { IconHeart } from './icons'
import { db, type GarmentRecord } from '../db/db'
import { label, STATUSES } from '../catalog/labels'

export function GarmentCard({ g, subtitle, onOpen }: { g: GarmentRecord; subtitle: string; onOpen: () => void }) {
  return (
    <div className="card" style={{ cursor: 'pointer' }} onClick={onOpen} role="button">
      <div className="ph">
        <GarmentImg g={g} label={subtitle} />
        {g.status !== 'closet' ? <span className="badge">{label(STATUSES, g.status)}</span> : g.review === 'pending' && <span className="badge" style={{ background: '#fff', color: '#0a0a0a', border: '1px solid #0a0a0a' }}>Por revisar</span>}
        <button
          className="fav" aria-label="Favorito"
          onClick={(e) => { e.stopPropagation(); void db.garments.update(g.id, { favorite: !g.favorite }) }}
        ><IconHeart filled={g.favorite} /></button>
      </div>
      <div className="meta"><b>{g.name || subtitle}</b><span>{g.name ? subtitle : ' '}</span></div>
    </div>
  )
}
