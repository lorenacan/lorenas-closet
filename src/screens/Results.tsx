import { useMemo } from 'react'
import { useNav } from '../lib/router'
import { dropFromResults, runGeneration, useGen } from '../lib/genStore'
import { setLookStatus, useLooks } from '../db/queries'
import { Collage } from '../ui/Collage'
import { TopBar, toast } from '../ui/components'
import { IconBookmark, IconHeart, IconRefresh, IconX } from '../ui/icons'
import { useWardrobeMaps } from './LooksCommon'
import { STYLE_LABELS } from '../engine'

export function Results() {
  const nav = useNav()
  const gen = useGen()
  const stored = useLooks()
  const maps = useWardrobeMaps()
  const status = useMemo(() => new Map((stored ?? []).map((l) => [l.signature, l.status])), [stored])
  const r = gen.request
  const params = { layers: r.layers, styles: r.styles, climate: r.climate, occasion: r.occasion }

  const summary = [`${r.layers} capa${r.layers > 1 ? 's' : ''}`, ...r.styles.map((s) => STYLE_LABELS[s] ?? s)].join(' · ')

  return (
    <div className="screen">
      <TopBar
        title="Tus looks"
        right={<button className="icon-btn solid" aria-label="Regenerar" disabled={gen.running} onClick={() => void runGeneration(true)}><IconRefresh /></button>}
      />
      <p className="small muted" style={{ marginBottom: 12 }}>{summary}</p>

      {gen.running && <div className="empty"><span className="spinner" /><p style={{ marginTop: 12 }}>Creando combinaciones…</p></div>}

      {!gen.running && gen.diagnostics.length > 0 && gen.diagnostics.map((d, i) => <div className="notice" key={i}>{d}</div>)}

      {!gen.running && gen.looks.length > 0 && (
        <div className="looks-grid">
          {gen.looks.map((l) => {
            const st = status.get(l.signature)
            return (
              <div className="lookcard" key={l.signature}>
                <div onClick={() => nav.push({ name: 'look', signature: l.signature, from: 'results' })} style={{ cursor: 'pointer' }}>
                  <Collage look={l} garments={maps.garments} categories={maps.categories} />
                  <span className="score">{Math.round(l.score)}</span>
                </div>
                <div className="acts">
                  <button className={`icon-btn ${st === 'favorite' ? 'on' : ''}`} aria-label="Favorito" onClick={() => { void setLookStatus(l, st === 'favorite' ? 'saved' : 'favorite', params); toast(st === 'favorite' ? 'Quitado de favoritos' : 'Añadido a favoritos') }}><IconHeart filled={st === 'favorite'} /></button>
                  <button className={`icon-btn ${st === 'saved' ? 'on' : ''}`} aria-label="Guardar" onClick={() => { void setLookStatus(l, 'saved', params); toast('Look guardado') }}><IconBookmark filled={st === 'saved'} /></button>
                  <button className="icon-btn" aria-label="Descartar" onClick={() => { void setLookStatus(l, 'discarded', params); dropFromResults(l.signature) }}><IconX /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!gen.running && gen.looks.length > 0 && (
        <button className="btn block" style={{ marginTop: 20 }} onClick={() => void runGeneration(true)}><span style={{ width: 18, height: 18, display: 'inline-flex' }}><IconRefresh /></span> Ver más propuestas</button>
      )}
      {!gen.running && gen.hasRun && gen.looks.length === 0 && (
        <button className="btn ghost block" style={{ marginTop: 12 }} onClick={nav.back}>Ajustar filtros</button>
      )}
    </div>
  )
}
