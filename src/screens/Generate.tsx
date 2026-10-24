import { useState } from 'react'
import { useNav } from '../lib/router'
import { useCategories, useGarments } from '../db/queries'
import { runGeneration, setRequest, useGen } from '../lib/genStore'
import { Accordion, Chip, Segmented } from '../ui/components'
import { GarmentPickerSheet } from '../ui/GarmentPicker'
import { CLIMATES, FORMALITY, OCCASIONS, RISKS } from '../catalog/labels'
import { CHROMATIC_FAMILIES, FAMILY_LABELS, NEUTRAL_FAMILIES, STYLES, STYLE_LABELS } from '../engine'

const LAYER_HINTS: Record<number, string> = { 1: 'Solo base', 2: '+ chaqueta', 3: '+ camisa', 4: '+ abrigo' }
const FAMILY_DOT: Record<string, string> = {
  negro: '#111', blanco: '#fff', gris: '#8a8a8a', beige: '#e0d2b8', camel: '#c19a6b', marron: '#4a2c1a', caqui: '#8a8456',
  marino: '#1f2a44', denim: '#4f6d99', rojo: '#c8102e', naranja: '#f08a1c', amarillo: '#f2d024', verde: '#0f8a5f',
  turquesa: '#1fb5ae', azul: '#2a5db0', violeta: '#6a3fa0', rosa: '#f08bb0',
}
const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

export function Generate() {
  const nav = useNav()
  const gen = useGen()
  const r = gen.request
  const garments = useGarments()
  const cats = useCategories()
  const [picker, setPicker] = useState<'must' | 'exclude' | null>(null)
  const available = (garments ?? []).filter((g) => g.status === 'closet')

  async function go() {
    nav.push({ name: 'results' })
    await runGeneration(false)
  }

  return (
    <div className="screen">
      <div className="topbar"><h1 className="page-title grow">Crear looks</h1></div>
      {garments && available.length < 3 && (
        <div className="notice">Necesitas al menos una prenda superior, una inferior y unos zapatos disponibles. Ahora tienes {available.length}.</div>
      )}

      <div className="field"><label>Capas en la parte superior</label>
        <div className="stepper">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} className={r.layers === n ? 'on' : ''} onClick={() => setRequest({ layers: n })}><b>{n}</b><span>{LAYER_HINTS[n]}</span></button>
          ))}
        </div>
      </div>

      <div className="field"><label>Estilo <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(opcional, puedes elegir varios)</span></label>
        <div className="chips">{STYLES.map((s) => <Chip key={s} on={r.styles.includes(s)} onClick={() => setRequest({ styles: toggle(r.styles, s) })}>{STYLE_LABELS[s]}</Chip>)}</div>
      </div>

      <Accordion title="Más opciones">
        <div className="field" style={{ marginTop: 6 }}><label>Clima</label>
          <div className="chips">{CLIMATES.map(([k, l]) => <Chip key={k} on={r.climate === k} onClick={() => setRequest({ climate: r.climate === k ? undefined : k })}>{l}</Chip>)}</div>
        </div>
        <div className="field"><label>Ocasión</label>
          <div className="chips">{OCCASIONS.map(([k, l]) => <Chip key={k} on={r.occasion === k} onClick={() => setRequest({ occasion: r.occasion === k ? undefined : k })}>{l}</Chip>)}</div>
        </div>
        <div className="field"><label>Formalidad exacta</label>
          <Segmented value={r.formality} options={FORMALITY.map((l, i) => [i, l] as [number, string])} onChange={(v) => setRequest({ formality: r.formality === v ? undefined : v })} />
        </div>
        <div className="field"><label>Tipo de look</label>
          <Segmented value={r.risk} options={RISKS} onChange={(v) => setRequest({ risk: v })} />
        </div>
        <div className="field"><label>Colores que quiero llevar</label>
          <div className="chips">
            {[...CHROMATIC_FAMILIES, ...NEUTRAL_FAMILIES].map((k) => (
              <Chip key={k} on={r.preferColors.includes(k)} onClick={() => setRequest({ preferColors: toggle(r.preferColors, k), avoidColors: r.avoidColors.filter((x) => x !== k) })}>
                <span className="sw mini" style={{ background: FAMILY_DOT[k], marginRight: 6, width: 12, height: 12, verticalAlign: 'middle' }} />{FAMILY_LABELS[k]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="field"><label>Colores que quiero evitar</label>
          <div className="chips">
            {[...CHROMATIC_FAMILIES, ...NEUTRAL_FAMILIES].map((k) => (
              <Chip key={k} on={r.avoidColors.includes(k)} onClick={() => setRequest({ avoidColors: toggle(r.avoidColors, k), preferColors: r.preferColors.filter((x) => x !== k) })}>
                <span className="sw mini" style={{ background: FAMILY_DOT[k], marginRight: 6, width: 12, height: 12, verticalAlign: 'middle' }} />{FAMILY_LABELS[k]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="field"><label>Prendas obligatorias</label>
          <button className="btn ghost sm" onClick={() => setPicker('must')}>{r.mustInclude.length ? `${r.mustInclude.length} elegidas` : 'Elegir prendas'}</button>
          {r.mustInclude.length > 0 && <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => setRequest({ mustInclude: [] })}>Quitar</button>}
        </div>
        <div className="field"><label>Prendas que no quiero usar</label>
          <button className="btn ghost sm" onClick={() => setPicker('exclude')}>{r.exclude.length ? `${r.exclude.length} excluidas` : 'Elegir prendas'}</button>
          {r.exclude.length > 0 && <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => setRequest({ exclude: [] })}>Quitar</button>}
        </div>
        <div className="field"><label>Accesorios</label>
          <Segmented value={r.accessories} options={[[0, 'Ninguno'], [1, '1'], [2, '2'], [3, '3']]} onChange={(v) => setRequest({ accessories: v })} />
        </div>
        <div className="switch"><span>Priorizar prendas poco usadas</span><input type="checkbox" checked={r.prioritizeUnderused} onChange={(e) => setRequest({ prioritizeUnderused: e.target.checked })} /></div>
        <div className="switch"><span>Incluir vestidos y monos</span><input type="checkbox" checked={r.allowOnePieces} onChange={(e) => setRequest({ allowOnePieces: e.target.checked })} /></div>
      </Accordion>

      <div style={{ height: 16 }} />
      <button className="btn block" disabled={gen.running || available.length === 0} onClick={() => void go()}>{gen.running ? 'Creando…' : 'Crear looks'}</button>

      {picker && garments && (
        <GarmentPickerSheet
          title={picker === 'must' ? 'Prendas obligatorias' : 'Prendas que no quiero usar'}
          garments={available}
          byId={cats.byId}
          selected={picker === 'must' ? r.mustInclude : r.exclude}
          onChange={(ids) => setRequest(picker === 'must' ? { mustInclude: ids, exclude: r.exclude.filter((x) => !ids.includes(x)) } : { exclude: ids, mustInclude: r.mustInclude.filter((x) => !ids.includes(x)) })}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}
