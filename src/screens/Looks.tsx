import { useState } from 'react'
import { useNav } from '../lib/router'
import { useLooks } from '../db/queries'
import { Collage } from '../ui/Collage'
import { Segmented } from '../ui/components'
import { useWardrobeMaps } from './LooksCommon'

export function Looks() {
  const nav = useNav()
  const looks = useLooks()
  const maps = useWardrobeMaps()
  const [tab, setTab] = useState<'favorite' | 'saved'>('favorite')
  const shown = (looks ?? []).filter((l) => (tab === 'favorite' ? l.status === 'favorite' : l.status === 'saved' || l.status === 'favorite'))
  return (
    <div className="screen">
      <div className="topbar"><h1 className="page-title grow">Mis looks</h1></div>
      <Segmented value={tab} options={[['favorite', 'Favoritos'], ['saved', 'Guardados']]} onChange={setTab} />
      <div style={{ height: 14 }} />
      {shown.length === 0 ? (
        <div className="empty">
          <h2>Aún no hay looks aquí</h2>
          <p>Genera combinaciones y guarda las que más te gusten.</p>
          <button className="btn" onClick={() => nav.tab({ name: 'generate' })}>Crear looks</button>
        </div>
      ) : (
        <div className="looks-grid">
          {shown.map((l) => (
            <div className="lookcard" key={l.signature} style={{ cursor: 'pointer' }} onClick={() => nav.push({ name: 'look', signature: l.signature, from: 'saved' })}>
              <Collage look={l} garments={maps.garments} categories={maps.categories} />
              <span className="score">{Math.round(l.score)}</span>
              {l.wornCount > 0 && <p className="tiny muted" style={{ marginTop: 6 }}>Puesto {l.wornCount} {l.wornCount === 1 ? 'vez' : 'veces'}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
