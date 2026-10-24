import { useState } from 'react'
import { SWATCH_GROUPS } from '../catalog/colors'
import { nearestSwatch } from '../lib/colorMatch'
import { Chip } from './components'
import { classifyColor } from '../engine'
import type { Category } from '../catalog/categories'

export function ColorPicker({ hex, onPick, multi }: { hex?: string; onPick: (hex: string, name: string) => void; multi?: string[] }) {
  const [open, setOpen] = useState(!hex)
  const selected = (h: string) => (multi ? multi.includes(h) : hex === h)
  const groups = open ? SWATCH_GROUPS : SWATCH_GROUPS.map((g) => ({ ...g, colors: g.colors.filter((c) => c.hex === hex) })).filter((g) => g.colors.length)
  return (
    <div>
      {groups.map((g) => (
        <div key={g.label}>
          <div className="small muted group-title" style={{ marginTop: 10 }}>{g.label}</div>
          <div className="swatches">
            {g.colors.map((c) => (
              <button type="button" key={c.hex} className={`sw ${selected(c.hex) ? 'on' : ''}`} style={{ background: c.hex }} title={c.name} aria-label={c.name} onClick={() => { onPick(c.hex, c.name); if (!multi) setOpen(false) }} />
            ))}
          </div>
        </div>
      ))}
      <div className="row" style={{ marginTop: 12 }}>
        {!open && <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>Cambiar color</button>}
        <label className="btn ghost sm" style={{ position: 'relative' }}>
          Otro color
          <input
            type="color" value={hex ?? '#808080'}
            onChange={(e) => { const n = nearestSwatch(e.target.value); onPick(e.target.value, `${n.name}`) }}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%' }}
          />
        </label>
      </div>
    </div>
  )
}

export function colorSummary(hex?: string, name?: string): string {
  if (!hex) return 'Sin color'
  const c = classifyColor(hex)
  const t = { warm: 'cálido', cool: 'frío', neutral: 'neutro' }[c.temp]
  const i = { muted: 'apagado', medium: 'medio', vivid: 'intenso' }[c.intensity]
  const l = { light: 'claro', medium: 'tono medio', dark: 'oscuro' }[c.lightness]
  return `${name ?? ''} · ${t}, ${i}, ${l}`.replace(/^ · /, '')
}

/** Selector jerárquico: categoría > subcategoría > tipo. */
export function CategoryPicker({ value, cats, byId, onChange }: { value?: string; cats: Category[]; byId: Map<string, Category>; onChange: (id: string) => void }) {
  const chain: Category[] = []
  let n = value ? byId.get(value) : undefined
  while (n) { chain.unshift(n); n = n.parentId ? byId.get(n.parentId) : undefined }
  const levels: Category[][] = [cats.filter((c) => c.parentId === null)]
  for (const node of chain) {
    const ch = cats.filter((c) => c.parentId === node.id)
    if (ch.length) levels.push(ch)
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {levels.map((lvl, i) => (
        <div className="chips" key={i}>
          {lvl.map((c) => {
            const on = chain.some((x) => x.id === c.id)
            return <Chip key={c.id} on={on} className={i > 0 ? 'soft' : ''} onClick={() => onChange(c.id)}>{c.name}</Chip>
          })}
        </div>
      ))}
    </div>
  )
}
