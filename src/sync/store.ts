import { useSyncExternalStore } from 'react'
import { db, getSetting, setSetting } from '../db/db'
import { GitHubApi, GitHubError } from './github'
import { MANIFEST_KEY, syncOnce } from './engine'
import { syncGuard } from './guard'
import { processPhoto, thumbFromCutout } from '../lib/image'

const CONFIG_KEY = 'sync'
const DEBOUNCE_MS = 8000

export interface SyncConfig { repo: string; token: string; enabled: boolean; lastSync?: number }
interface State {
  config: SyncConfig | null
  status: 'off' | 'idle' | 'syncing' | 'error'
  message: string
  done?: number
  total?: number
  error?: string
}

let state: State = { config: null, status: 'off', message: '' }
const listeners = new Set<() => void>()
const emit = (p: Partial<State>) => { state = { ...state, ...p }; listeners.forEach((l) => l()) }
export const useSyncState = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => state)

let timer: number | undefined
let running = false
let rerun = false
let started = false

/** Acepta "usuario/repo" o la URL completa del repositorio. */
export function parseRepo(input: string): string | null {
  const m = /^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(input.trim())
  return m ? `${m[1]}/${m[2]}` : null
}

const makeApi = (c: SyncConfig) => new GitHubApi(c.repo, c.token, { postGapMs: 800 })

export async function syncNow(): Promise<void> {
  const config = state.config
  if (!config?.enabled) return
  if (running) { rerun = true; return }
  running = true
  window.clearTimeout(timer)
  emit({ status: 'syncing', message: 'Sincronizando…', error: undefined, done: undefined, total: undefined })
  try {
    await syncOnce({
      api: makeApi(config),
      makeThumb: async (blob, isCutout) => (isCutout ? thumbFromCutout(blob) : (await processPhoto(blob)).thumb),
      onProgress: (message, done, total) => emit({ message, done, total }),
    })
    const next = { ...config, lastSync: Date.now() }
    await setSetting(CONFIG_KEY, next)
    emit({ config: next, status: 'idle', message: '', done: undefined, total: undefined })
  } catch (e) {
    const msg = e instanceof GitHubError ? e.message : e instanceof TypeError ? 'Sin conexión con GitHub' : e instanceof Error ? e.message : String(e)
    emit({ status: 'error', error: msg, message: '' })
  } finally {
    running = false
    if (rerun) { rerun = false; scheduleSync(1500) }
  }
}

export function scheduleSync(delay = DEBOUNCE_MS): void {
  if (!state.config?.enabled || syncGuard.suspended > 0) return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => { void syncNow() }, delay)
}

export async function connectSync(repoInput: string, token: string): Promise<void> {
  const repo = parseRepo(repoInput)
  if (!repo) throw new Error('Escribe el repositorio como usuario/nombre')
  const config: SyncConfig = { repo, token: token.trim(), enabled: true }
  const info = await makeApi(config).getRepo()
  if (info.permissions && info.permissions.push === false) throw new Error('El token no tiene permiso de escritura (Contents: Read and write)')
  if (!info.private) throw new Error('Ese repositorio es público: usa uno privado para tus fotos')
  await setSetting(CONFIG_KEY, config)
  emit({ config, status: 'idle', error: undefined })
  void syncNow()
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  if (!state.config) return
  const config = { ...state.config, enabled }
  await setSetting(CONFIG_KEY, config)
  emit({ config, status: enabled ? 'idle' : 'off', error: undefined })
  if (enabled) void syncNow()
}

export async function disconnectSync(): Promise<void> {
  window.clearTimeout(timer)
  await db.settings.bulkDelete([CONFIG_KEY, MANIFEST_KEY])
  emit({ config: null, status: 'off', message: '', error: undefined })
}

/** Carga la configuración, engancha los cambios de la base de datos y sincroniza al abrir la app. */
export async function initSync(): Promise<void> {
  if (started) return
  started = true
  const config = await getSetting<SyncConfig | null>(CONFIG_KEY, null)
  if (config) emit({ config, status: config.enabled ? 'idle' : 'off' })

  const touch = () => scheduleSync()
  for (const t of [db.garments, db.looks, db.categories, db.photos]) {
    t.hook('creating', () => { touch() })
    t.hook('updating', () => { touch() })
    t.hook('deleting', () => { touch() })
  }
  db.settings.hook('creating', (key) => { if (key === 'weights') touch() })
  db.settings.hook('updating', (_m, key) => { if (key === 'weights') touch() })

  window.addEventListener('online', () => scheduleSync(2000))
  if (config?.enabled) scheduleSync(2500)
}
