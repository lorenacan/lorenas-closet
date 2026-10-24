import { useState } from 'react'
import { db, uid } from '../db/db'
import { countGarmentsIn, useCategories } from '../db/queries'
import { Sheet, TopBar, toast } from '../ui/components'
import type { Category } from '../catalog/categories'

export function Categories() {
  const { list } = useCategories()
  const [edit, setEdit] = useState<{ cat?: Category; parent?: Category; name: string } | null>(null)

  const render = (parentId: string | null, depth: number): React.ReactNode =>
    list.filter((c) => c.parentId === parentId).map((c) => (
      <div key={c.id}>
        <div className="tree-item" style={{ paddingLeft: depth * 16 }}>
          <span className="name" style={{ fontWeight: depth === 0 ? 700 : 400 }}>{c.name}</span>
          <button className="btn ghost sm" onClick={() => setEdit({ parent: c, name: '' })}>+ Sub</button>
          <button className="btn ghost sm" onClick={() => setEdit({ cat: c, name: c.name })}>Editar</button>
        </div>
        {render(c.id, depth + 1)}
      </div>
    ))

  async function save() {
    if (!edit || !edit.name.trim()) return
    const name = edit.name.trim()
    if (edit.cat) await db.categories.update(edit.cat.id, { name })
    else if (edit.parent) {
      const siblings = list.filter((c) => c.parentId === edit.parent!.id)
      await db.categories.put({
        id: uid(), parentId: edit.parent.id, name, kind: edit.parent.kind, order: Math.max(0, ...list.map((c) => c.order)) + 1 + siblings.length,
      })
    }
    setEdit(null)
    toast('Categoría guardada')
  }

  async function remove(c: Category) {
    const hasChildren = list.some((x) => x.parentId === c.id)
    const n = await countGarmentsIn(c.id)
    if (hasChildren || n > 0) { toast(hasChildren ? 'Elimina antes sus subcategorías' : `Tiene ${n} prendas: muévelas antes`); return }
    if (c.parentId === null) { toast('Las categorías principales no se pueden eliminar'); return }
    if (!confirm(`¿Eliminar "${c.name}"?`)) return
    await db.categories.delete(c.id)
    setEdit(null)
  }

  return (
    <div className="screen">
      <TopBar title="Categorías" />
      <p className="small muted" style={{ marginBottom: 8 }}>
        Añade subcategorías debajo de cualquier categoría. Las nuevas heredan el comportamiento de su tipo (por ejemplo, un “Palazzo” bajo Pantalón se trata como pantalón).
      </p>
      {render(null, 0)}
      {edit && (
        <Sheet title={edit.cat ? 'Renombrar categoría' : `Nueva subcategoría en ${edit.parent?.name}`} onClose={() => setEdit(null)}>
          <input className="input" autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Nombre" />
          <button className="btn block" style={{ marginTop: 14 }} onClick={() => void save()}>Guardar</button>
          {edit.cat && <button className="btn danger block" style={{ marginTop: 10 }} onClick={() => void remove(edit.cat!)}>Eliminar</button>}
        </Sheet>
      )}
    </div>
  )
}
