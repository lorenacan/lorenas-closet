/** Mientras `suspended > 0` los cambios en la base de datos no disparan una sincronización (restauraciones, aplicar datos remotos). */
export const syncGuard = { suspended: 0 }

export async function withoutSync<T>(fn: () => Promise<T>): Promise<T> {
  syncGuard.suspended++
  try { return await fn() } finally { syncGuard.suspended-- }
}
