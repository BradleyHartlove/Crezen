import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { namespacesApi, Namespace } from '@/api/namespaces'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AdminNamespacesPage() {
  const [namespaces, setNamespaces] = useState<Namespace[]>([])
  const [loading, setLoading] = useState(true)

  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = () => {
    setLoading(true)
    namespacesApi.list().then(setNamespaces).finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await namespacesApi.create(newName.trim(), newDesc.trim())
      setNewName('')
      setNewDesc('')
      refresh()
    } catch {}
    setCreating(false)
  }

  const startEdit = (ns: Namespace) => {
    setEditId(ns.id)
    setEditName(ns.name)
    setEditDesc(ns.description)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditName('')
    setEditDesc('')
  }

  const handleSave = async (id: string) => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await namespacesApi.update(id, { name: editName.trim(), description: editDesc.trim() })
      cancelEdit()
      refresh()
    } catch {}
    setSaving(false)
  }

  const handleDelete = async (ns: Namespace) => {
    if (!confirm(`Delete namespace "${ns.name}"? Credentials in this namespace will lose their namespace association.`)) return
    await namespacesApi.delete(ns.id)
    refresh()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-base font-semibold text-foreground font-mono">Namespaces</h1>
        <p className="text-xs text-muted mt-0.5">Organize credentials by environment or team</p>
      </div>

      {/* Create form */}
      <div className="rounded-lg border border-border bg-surface p-4 mb-6">
        <h2 className="text-xs font-semibold text-muted font-mono mb-3 uppercase tracking-wider">New Namespace</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="ns-name">Name *</Label>
              <Input
                id="ns-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. production"
                required
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="ns-desc">Description</Label>
              <Input
                id="ns-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={creating || !newName.trim()}>
            <Plus size={14} />
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </form>
      </div>

      {/* List */}
      <div className="rounded-lg border border-border bg-surface">
        {loading && (
          <p className="text-xs text-muted p-4">Loading…</p>
        )}
        {!loading && namespaces.length === 0 && (
          <p className="text-xs text-muted p-4">No namespaces yet.</p>
        )}
        {namespaces.map((ns, i) => (
          <div
            key={ns.id}
            className={`px-4 py-3 flex items-center gap-3 ${i < namespaces.length - 1 ? 'border-b border-border' : ''}`}
          >
            {editId === ns.id ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-xs py-0"
                  placeholder="name"
                />
                <Input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="h-7 text-xs py-0"
                  placeholder="description"
                />
                <button
                  onClick={() => handleSave(ns.id)}
                  disabled={saving || !editName.trim()}
                  className="text-accent hover:text-accent/80 disabled:opacity-40 transition-colors"
                  title="Save"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-muted hover:text-foreground transition-colors"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-foreground">{ns.name}</p>
                  {ns.description && (
                    <p className="text-[10px] text-muted mt-0.5">{ns.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(ns)} title="Edit">
                    <Pencil size={12} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(ns)}
                    className="hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
