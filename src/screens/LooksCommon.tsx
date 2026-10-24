import { useMemo } from 'react'
import { useCategories, useGarments } from '../db/queries'
import type { GarmentRecord } from '../db/db'
import type { Category } from '../catalog/categories'

/** Mapas de prendas y categorías para pintar collages. */
export function useWardrobeMaps(): { garments: Map<string, GarmentRecord>; categories: Map<string, Category>; ready: boolean } {
  const list = useGarments()
  const cats = useCategories()
  const garments = useMemo(() => new Map((list ?? []).map((g) => [g.id, g])), [list])
  return { garments, categories: cats.byId, ready: !!list && cats.ready }
}
