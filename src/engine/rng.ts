/** PRNG determinista (mulberry32): mismo seed => misma secuencia. */
export type Rng = () => number

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Muestrea hasta n elementos sin repetición (Fisher-Yates parcial). */
export function sample<T>(arr: readonly T[], n: number, rng: Rng): T[] {
  if (arr.length <= n) return [...arr]
  const a = [...arr]
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (a.length - i))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}
