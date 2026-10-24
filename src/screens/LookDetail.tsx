import { Fragment, useMemo } from 'react'
import { useNav } from '../lib/router'
import { dropFromResults, useGen } from '../lib/genStore'
import { markWorn, removeLook, setLookStatus, useLooks } from '../db/queries'
import { Collage } from '../ui/Collage'
import { GarmentImg, TopBar, toast } from '../ui/components'
import { IconBookmark, IconHeart, IconX } from '../ui/icons'
import { useWardrobeMaps } from './LooksCommon'
import { DEFAULT_WEIGHTS } from '../engine'
import type { LookRecord } from '../db/db'

interface View {
  signature: string
  tops: string[]
  bottom?: string
  onepiece?: string
  shoes?: string
  accessories: string[]
  score: number
  notes: string[]
  modules: Record<string, number | null>
  params?: LookRecord['params']
}

const MODULES: [keyof typeof DEFAULT_WEIGHTS, string][] = [
  ['color', 'Color'], ['style', 'Estilo'], ['silhouette', 'Capas y silueta'], ['occasion', 'Ocasión y temporada'],
]

export function LookDetail({ signature, from }: { signature: string; from: 'results' | 'saved' }) {
  const nav = useNav()
  const gen = useGen()
  const stored = useLooks()
  const maps = useWardrobeMaps()
  const rec = stored?.find((l) => l.signature === signature)

  const view = useMemo<View | null>(() => {
    if (from === 'results') {
      const l = gen.looks.find((x) => x.signature === signature)
      if (l) {
        const m: Record<string, number | null> = {}
        for (const [k, v] of Object.entries(l.modules)) m[k] = v.score
        return { ...l, modules: m }
      }
    }
    return rec ?? null
  }, [from, gen.looks, signature, rec])

  if (!view || !maps.ready) return <div className="screen"><TopBar title="Look" /></div>
  const status = rec?.status
  const params = { layers: gen.request.layers, styles: gen.request.styles, climate: gen.request.climate, occasion: gen.request.occasion }
  const persist = (st: 'saved' | 'favorite') => setLookStatus(view, st, view.params ?? params)

  const layers: [string, string][] = [
    ...(view.onepiece ? [['Vestido / mono', view.onepiece] as [string, string]] : []),
    ...view.tops.map((id, i) => [`Capa ${i + (view.onepiece ? 2 : 1)}${i === view.tops.length - 1 && view.tops.length + (view.onepiece ? 1 : 0) > 1 ? ' (exterior)' : ''}`, id] as [string, string]),
    ...(view.bottom ? [['Parte inferior', view.bottom] as [string, string]] : []),
    ...(view.shoes ? [['Calzado', view.shoes] as [string, string]] : []),
    ...view.accessories.map((id) => ['Accesorio', id] as [string, string]),
  ]

  return (
    <div className="screen">
      <TopBar title="Look" />
      <Collage look={view} garments={maps.garments} categories={maps.categories} />

      <div className="row between" style={{ margin: '16px 0 8px' }}>
        <div><div className="scorebig">{Math.round(view.score)}</div><div className="small muted">compatibilidad sobre 100</div></div>
        <div className="row">
          <button className={`icon-btn ${status === 'favorite' ? 'solid' : ''}`} aria-label="Favorito" onClick={() => { void persist(status === 'favorite' ? 'saved' : 'favorite'); toast(status === 'favorite' ? 'Quitado de favoritos' : 'Añadido a favoritos') }}><IconHeart filled={status === 'favorite'} /></button>
          <button className={`icon-btn ${status === 'saved' ? 'solid' : ''}`} aria-label="Guardar" onClick={() => { void persist('saved'); toast('Look guardado') }}><IconBookmark filled={status === 'saved'} /></button>
          <button className="icon-btn" aria-label={rec ? 'Eliminar' : 'Descartar'} onClick={async () => {
            if (from === 'results') { await setLookStatus(view, 'discarded', params); dropFromResults(view.signature) }
            else await removeLook(view.signature)
            nav.back()
          }}><IconX /></button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, margin: '14px 0' }}>
        {MODULES.map(([k, l]) => {
          const v = view.modules[k]
          return (
            <div key={k}>
              <div className="row between small"><span>{l} <span className="muted">· {Math.round(DEFAULT_WEIGHTS[k] * 100)} %</span></span><b>{v === null || v === undefined ? '—' : Math.round(v * 100)}</b></div>
              <div className="bar"><i style={{ width: `${v == null ? 0 : Math.round(v * 100)}%` }} /></div>
            </div>
          )
        })}
      </div>

      {view.notes.length > 0 && (
        <>
          <h4 style={{ margin: '18px 0 6px' }}>Por qué funciona</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }} className="small">
            {view.notes.map((n, i) => <li key={i} style={{ marginBottom: 3, fontWeight: 400 }}>{n}</li>)}
          </ul>
        </>
      )}

      <h4 style={{ margin: '22px 0 4px' }}>Prendas</h4>
      {layers.map(([lbl, id], i) => {
        const g = maps.garments.get(id)
        if (!g) return <Fragment key={i} />
        return (
          <button className="list-item" key={i} onClick={() => nav.push({ name: 'garment', id })}>
            <span className="th"><GarmentImg g={g} label="" /></span>
            <span style={{ flex: 1 }}><b style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{g.name || maps.categories.get(g.categoryId)?.name}</b><span className="small muted">{lbl}</span></span>
          </button>
        )
      })}

      <button
        className="btn block" style={{ marginTop: 20 }}
        onClick={async () => { if (!rec) await persist('saved'); await markWorn(view); toast('Anotado: te lo has puesto') }}
      >Me lo pongo hoy</button>
    </div>
  )
}
