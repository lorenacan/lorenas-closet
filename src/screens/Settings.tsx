import { useEffect, useRef, useState } from 'react'
import { useNav } from '../lib/router'
import { DEFAULT_WEIGHTS, type Weights } from '../engine'
import { getSetting, setSetting, WEIGHTS_KEY } from '../db/db'
import { exportBackup, importBackup, wipeAll } from '../db/backup'
import { loadSampleWardrobe } from '../catalog/sample'
import { toast } from '../ui/components'

const LABELS: Record<keyof Weights, string> = {
  color: 'Compatibilidad cromática', style: 'Coherencia de estilo', silhouette: 'Capas y silueta', occasion: 'Ocasión y temporada',
}

export function Settings() {
  const nav = useNav()
  const [w, setW] = useState<Weights>(DEFAULT_WEIGHTS)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getSetting<Weights>(WEIGHTS_KEY, DEFAULT_WEIGHTS).then(setW)
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1
  const change = (k: keyof Weights, v: number) => {
    const next = { ...w, [k]: v }
    setW(next)
    void setSetting(WEIGHTS_KEY, next)
  }

  async function doExport() {
    setBusy(true)
    try {
      const blob = await exportBackup()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lorenas-closet-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) {
      toast('No se pudo crear la copia')
      console.error(e)
    } finally { setBusy(false) }
  }

  async function doImport(f: File | undefined) {
    if (!f) return
    if (!confirm('Restaurar esta copia sustituirá todo lo que tienes ahora. ¿Continuar?')) return
    setBusy(true)
    try {
      const n = await importBackup(f)
      toast(`Copia restaurada: ${n} prendas`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo restaurar')
    } finally { setBusy(false) }
  }

  return (
    <div className="screen">
      <div className="topbar"><h1 className="page-title grow">Ajustes</h1></div>

      <h3>Motor de combinaciones</h3>
      <p className="small muted" style={{ margin: '4px 0 14px' }}>Cuánto pesa cada criterio al puntuar un look. Se normalizan automáticamente.</p>
      {(Object.keys(LABELS) as (keyof Weights)[]).map((k) => (
        <div className="field" key={k}>
          <div className="row between small"><span>{LABELS[k]}</span><b>{Math.round((w[k] / total) * 100)} %</b></div>
          <input type="range" min={0} max={100} value={Math.round(w[k] * 100)} onChange={(e) => change(k, Number(e.target.value) / 100)} style={{ width: '100%', accentColor: '#0a0a0a' }} />
        </div>
      ))}
      <button className="btn ghost sm" onClick={() => { setW(DEFAULT_WEIGHTS); void setSetting(WEIGHTS_KEY, DEFAULT_WEIGHTS) }}>Restablecer pesos</button>

      <hr className="sep" />
      <h3>Armario</h3>
      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        <button className="btn ghost" onClick={() => nav.push({ name: 'categories' })}>Editar categorías</button>
        <button className="btn ghost" onClick={async () => { const n = await loadSampleWardrobe(); toast(`${n} prendas de ejemplo añadidas`) }}>Añadir prendas de ejemplo</button>
      </div>

      <hr className="sep" />
      <h3>Copia de seguridad</h3>
      <p className="small muted" style={{ margin: '4px 0 12px' }}>
        Tus datos viven solo en este móvil. Descarga una copia de vez en cuando (sobre todo en iPhone, donde Safari puede borrar los datos de webs que no se usan).
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        <button className="btn" disabled={busy} onClick={() => void doExport()}>{busy ? 'Trabajando…' : 'Descargar copia'}</button>
        <button className="btn ghost" disabled={busy} onClick={() => fileRef.current?.click()}>Restaurar copia</button>
        <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = '' }} />
        {persisted === false && (
          <button className="btn ghost sm" onClick={async () => { const ok = await navigator.storage.persist(); setPersisted(ok); toast(ok ? 'Almacenamiento protegido' : 'El navegador no lo ha permitido') }}>
            Proteger el almacenamiento
          </button>
        )}
        {persisted && <p className="small muted">Almacenamiento protegido frente a borrados automáticos.</p>}
      </div>

      <hr className="sep" />
      <button className="btn danger block" onClick={async () => { if (confirm('Se borrarán todas tus prendas, fotos y looks de este dispositivo. ¿Seguro?')) { await wipeAll(); toast('Datos borrados'); nav.tab({ name: 'closet' }) } }}>Borrar todos los datos</button>
      <p className="tiny muted" style={{ marginTop: 16, textAlign: 'center' }}>Lorena’s Closet · todo se procesa en tu dispositivo, sin IA externa.</p>
    </div>
  )
}
