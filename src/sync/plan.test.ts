import { describe, expect, it } from 'vitest'
import { planSync } from './plan'

const m = (o: Record<string, string>) => new Map(Object.entries(o))

describe('planSync (tres bandas)', () => {
  it('primera sincronización: sube lo local y baja lo remoto, sin borrar nada', () => {
    const p = planSync(m({ a: '1' }), m({ b: '2' }), {})
    expect(p.upload).toEqual(['a'])
    expect(p.pull).toEqual(['b'])
    expect(p.deleteLocal).toEqual([])
    expect(p.deleteRemote).toEqual([])
  })
  it('dispositivo nuevo y vacío: baja todo y no borra el remoto', () => {
    const p = planSync(m({}), m({ a: '1', b: '2' }), {})
    expect(p.pull.sort()).toEqual(['a', 'b'])
    expect(p.deleteRemote).toEqual([])
  })
  it('lo ya igual solo se anota', () => {
    expect(planSync(m({ a: '1' }), m({ a: '1' }), {}).same).toEqual(['a'])
  })
  it('cambio local propaga al remoto; cambio remoto baja', () => {
    expect(planSync(m({ a: '2' }), m({ a: '1' }), { a: '1' }).upload).toEqual(['a'])
    expect(planSync(m({ a: '1' }), m({ a: '2' }), { a: '1' }).pull).toEqual(['a'])
  })
  it('borrado local (estaba sincronizado) borra en remoto; borrado remoto borra en local', () => {
    expect(planSync(m({}), m({ a: '1' }), { a: '1' }).deleteRemote).toEqual(['a'])
    expect(planSync(m({ a: '1' }), m({}), { a: '1' }).deleteLocal).toEqual(['a'])
  })
  it('lo que nunca se sincronizó y falta en remoto se sube, no se borra', () => {
    const p = planSync(m({ a: '1' }), m({}), {})
    expect(p.upload).toEqual(['a'])
    expect(p.deleteLocal).toEqual([])
  })
  it('conflicto: ambos cambiaron', () => {
    expect(planSync(m({ a: '2' }), m({ a: '3' }), { a: '1' }).conflicts).toEqual(['a'])
  })
  it('borrado en un lado y edición en el otro: gana la edición', () => {
    expect(planSync(m({}), m({ a: '2' }), { a: '1' }).pull).toEqual(['a'])
    expect(planSync(m({ a: '2' }), m({}), { a: '1' }).upload).toEqual(['a'])
  })
})
