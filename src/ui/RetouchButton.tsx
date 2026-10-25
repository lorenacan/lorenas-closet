import { useState } from 'react'
import { CutoutEditor } from './CutoutEditor'

/** Botón "Retocar recorte" + el editor a pantalla completa. */
export function RetouchButton({ photoId }: { photoId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>Retocar el recorte</button>
      {open && <CutoutEditor photoId={photoId} onClose={() => setOpen(false)} />}
    </>
  )
}
