import { useEffect, useState } from 'react'
import { db } from '../db/db'

interface Entry { url: string; cutout: boolean }
const MAX = 400
const cache = new Map<string, Entry>()

function remember(key: string, e: Entry) {
  cache.delete(key)
  cache.set(key, e)
  if (cache.size > MAX) {
    const oldest = cache.keys().next().value as string
    URL.revokeObjectURL(cache.get(oldest)!.url)
    cache.delete(oldest)
  }
}

export type Variant = 'thumb' | 'full'

async function fetchEntry(id: string, variant: Variant): Promise<Entry | null> {
  if (variant === 'thumb') {
    const t = await db.thumbs.get(id)
    return t ? { url: URL.createObjectURL(t.blob), cutout: t.cutout } : null
  }
  const p = await db.photos.get(id)
  return p ? { url: URL.createObjectURL(p.cutout ?? p.original), cutout: !!p.cutout } : null
}

/**
 * Foto de una prenda (miniatura o grande). `cutout` indica si ya no tiene fondo.
 * `version` fuerza a recargar (p. ej. cuando termina el recorte).
 */
export function usePhoto(photoId: string | undefined, variant: Variant = 'thumb', version = 0): { url?: string; cutout: boolean } {
  const [state, setState] = useState<{ url?: string; cutout: boolean }>({ cutout: false })
  useEffect(() => {
    let alive = true
    if (!photoId) { setState({ cutout: false }); return }
    const key = `${photoId}:${variant}:${version}`
    const hit = cache.get(key)
    if (hit) { setState(hit); return }
    fetchEntry(photoId, variant).then((e) => {
      if (!alive || !e) return
      remember(key, e)
      setState(e)
    })
    return () => { alive = false }
  }, [photoId, variant, version])
  return state
}
