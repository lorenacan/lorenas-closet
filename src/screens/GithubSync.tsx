import { useState } from 'react'
import { connectSync, disconnectSync, setSyncEnabled, syncNow, useSyncState } from '../sync/store'
import { Accordion, toast } from '../ui/components'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

export function GithubSync() {
  const s = useSyncState()
  const [repo, setRepo] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()

  async function connect() {
    setBusy(true)
    setErr(undefined)
    try {
      await connectSync(repo, token)
      setToken('')
      toast('Conectado. Sincronizando…')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo conectar')
    } finally { setBusy(false) }
  }

  if (!s.config) {
    return (
      <div>
        <h3>Copia automática en GitHub</h3>
        <p className="small muted" style={{ margin: '4px 0 12px' }}>
          Guarda tus prendas, fotos y looks en un repositorio <b>privado</b> tuyo cada vez que cambies algo. Si pierdes el móvil o borras los datos, los recuperas conectando de nuevo.
          Tus fotos se guardarán en GitHub (privadas, solo con tu token).
        </p>
        <Accordion title="Cómo conseguir el token">
          <ol className="small" style={{ paddingLeft: 18, margin: '4px 0 8px', fontWeight: 400 }}>
            <li style={{ marginBottom: 6 }}>Crea un repositorio <b>privado</b> vacío para los datos (por ejemplo <code>lorenas-closet-datos</code>).</li>
            <li style={{ marginBottom: 6 }}>Abre <a href={TOKEN_URL} target="_blank" rel="noreferrer">github.com/settings/personal-access-tokens/new</a>.</li>
            <li style={{ marginBottom: 6 }}>En “Repository access” elige <b>Only select repositories</b> y marca solo ese repositorio.</li>
            <li style={{ marginBottom: 6 }}>En “Repository permissions” pon <b>Contents: Read and write</b>.</li>
            <li style={{ marginBottom: 6 }}>Elige una caducidad (hasta 1 año), pulsa “Generate token” y copia el token (empieza por <code>github_pat_</code>).</li>
            <li>Pégalo abajo. Se guarda solo en este móvil.</li>
          </ol>
        </Accordion>
        <div className="field" style={{ marginTop: 12 }}><label>Repositorio</label>
          <input className="input" placeholder="usuario/lorenas-closet-datos" value={repo} autoCapitalize="none" autoCorrect="off" onChange={(e) => setRepo(e.target.value)} />
        </div>
        <div className="field"><label>Token</label>
          <input className="input" type="password" placeholder="github_pat_…" value={token} autoComplete="off" onChange={(e) => setToken(e.target.value)} />
        </div>
        {err && <div className="notice" style={{ color: 'var(--danger)' }}>{err}</div>}
        <button className="btn block" disabled={busy || !repo || !token} onClick={() => void connect()}>{busy ? 'Comprobando…' : 'Conectar'}</button>
      </div>
    )
  }

  const last = s.config.lastSync ? new Date(s.config.lastSync).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'aún no'
  return (
    <div>
      <h3>Copia automática en GitHub</h3>
      <p className="small" style={{ margin: '6px 0', fontWeight: 400 }}>Repositorio: <b>{s.config.repo}</b></p>
      <p className="small muted" style={{ marginBottom: 10 }}>
        {s.status === 'syncing'
          ? `${s.message}${s.total ? ` (${s.done ?? 0}/${s.total})` : ''}`
          : s.status === 'error' ? '' : s.config.enabled ? `Última copia: ${last}` : 'Pausada'}
      </p>
      {s.status === 'syncing' && <div className="bar" style={{ marginBottom: 12 }}><i style={{ width: s.total ? `${Math.round(((s.done ?? 0) / s.total) * 100)}%` : '15%' }} /></div>}
      {s.status === 'error' && <div className="notice" style={{ color: 'var(--danger)' }}>{s.error}</div>}
      <div className="switch"><span>Copia automática al hacer cambios</span><input type="checkbox" checked={s.config.enabled} onChange={(e) => void setSyncEnabled(e.target.checked)} /></div>
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <button className="btn ghost" disabled={s.status === 'syncing' || !s.config.enabled} onClick={() => void syncNow()}>Sincronizar ahora</button>
        <button className="btn ghost sm" onClick={async () => { if (confirm('Se quitará el token de este móvil. Tus datos en GitHub se mantienen. ¿Desconectar?')) { await disconnectSync(); toast('Desconectado') } }}>Desconectar</button>
      </div>
    </div>
  )
}
