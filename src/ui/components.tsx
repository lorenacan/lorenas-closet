import { useEffect, useState, type ReactNode } from 'react'
import { IconBack, IconChevron } from './icons'
import { useNav } from '../lib/router'
import { usePhoto } from '../lib/photoUrl'
import { useCutout } from '../lib/cutout'
import { classifyColor } from '../engine'
import type { GarmentRecord } from '../db/db'

export function Chip({ on, children, onClick, className = '' }: { on?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return <button type="button" className={`chip ${on ? 'on' : ''} ${className}`} onClick={onClick}>{children}</button>
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T | undefined; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([k, l]) => <button type="button" key={String(k)} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  )
}

export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  )
}

export function TopBar({ title, right, back = true }: { title: string; right?: ReactNode; back?: boolean }) {
  const nav = useNav()
  return (
    <div className="topbar">
      {back && nav.depth > 1 && <button className="icon-btn" onClick={nav.back} aria-label="Volver"><IconBack /></button>}
      <h1 className="page-title grow">{title}</h1>
      {right}
    </div>
  )
}

export function Accordion({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="acc">
      <button type="button" onClick={() => setOpen(!open)}>{title}<IconChevron open={open} /></button>
      {open && <div style={{ paddingBottom: 8 }}>{children}</div>}
    </div>
  )
}

let toastTimer: number | undefined
let setToastGlobal: ((m: string | null) => void) | null = null
export function toast(msg: string) {
  setToastGlobal?.(msg)
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => setToastGlobal?.(null), 2200)
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { setToastGlobal = setMsg; return () => { setToastGlobal = null } }, [])
  return msg ? <div className="toast" role="status">{msg}</div> : null
}

function textOn(hex: string): string {
  return classifyColor(hex).L > 0.65 ? '#111' : '#fff'
}

/** Foto de la prenda (recorte si lo hay); sin foto, una ficha del color de la prenda. */
export function GarmentImg({ g, variant = 'thumb', label }: { g: Pick<GarmentRecord, 'photoId' | 'colorHex' | 'name'>; variant?: 'thumb' | 'full'; label?: string }) {
  const { version } = useCutout(g.photoId)
  const { url, cutout } = usePhoto(g.photoId, variant, version)
  if (url) return <img src={url} alt={g.name ?? ''} className={cutout ? '' : 'flat'} loading="lazy" draggable={false} />
  const bg = g.colorHex ?? '#e6e6e6'
  return <div className="tile" style={{ background: bg, color: textOn(bg) }}>{label ?? g.name ?? ''}</div>
}
