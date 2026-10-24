/** Planificación de la sincronización a tres bandas: local, remoto y la última versión sincronizada (manifiesto). */
export interface Plan {
  upload: string[]
  deleteRemote: string[]
  pull: string[]
  deleteLocal: string[]
  /** Ambos lados cambiaron: hay que decidir cuál gana. */
  conflicts: string[]
  /** Ya iguales: solo se anota en el manifiesto. */
  same: string[]
}

export function planSync(local: Map<string, string>, remote: Map<string, string>, manifest: Record<string, string>): Plan {
  const plan: Plan = { upload: [], deleteRemote: [], pull: [], deleteLocal: [], conflicts: [], same: [] }
  const paths = new Set([...local.keys(), ...remote.keys(), ...Object.keys(manifest)])
  for (const p of paths) {
    const L = local.get(p), R = remote.get(p), M = manifest[p]
    if (L === R) { if (L !== undefined) plan.same.push(p); continue }
    if (M === undefined) {
      if (L !== undefined && R === undefined) plan.upload.push(p)
      else if (R !== undefined && L === undefined) plan.pull.push(p)
      else plan.conflicts.push(p)
      continue
    }
    const localChanged = L !== M
    const remoteChanged = R !== M
    if (!localChanged && remoteChanged) (R === undefined ? plan.deleteLocal : plan.pull).push(p)
    else if (localChanged && !remoteChanged) (L === undefined ? plan.deleteRemote : plan.upload).push(p)
    else if (L === undefined) plan.pull.push(p) // borrado aquí pero editado en otro dispositivo: gana la edición
    else if (R === undefined) plan.upload.push(p) // borrado en otro dispositivo pero editado aquí: gana la edición
    else plan.conflicts.push(p)
  }
  return plan
}
