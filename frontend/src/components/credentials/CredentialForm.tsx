import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { CREDENTIAL_TYPE_LABELS } from '@/lib/utils'
import { CredentialType } from '@/api/credentials'
import { Namespace } from '@/api/namespaces'

export interface CredentialFormData {
  name: string
  description: string
  type: CredentialType
  namespace_id: string | null
  tags: string[]
  value: string
}

interface Props {
  initial?: Partial<CredentialFormData>
  namespaces: Namespace[]
  onSubmit: (data: CredentialFormData) => Promise<void>
  onCancel: () => void
  submitLabel?: string
  showValue?: boolean
}

export function CredentialForm({
  initial = {},
  namespaces,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  showValue = true,
}: Props) {
  const [name, setName] = useState(initial.name ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [type, setType] = useState<CredentialType>(initial.type ?? 'password')
  const [namespaceId, setNamespaceId] = useState<string>(initial.namespace_id ?? '')
  const [tags, setTags] = useState<string[]>(initial.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [value, setValue] = useState(initial.value ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (!description.trim()) { setError('Description is required'); return }
    if (showValue && !value.trim()) { setError('Value is required'); return }
    setLoading(true)
    setError('')
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        type,
        namespace_id: namespaceId || null,
        tags,
        value,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Production DB password" />
      </div>

      <div>
        <Label htmlFor="desc">Description *</Label>
        <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="PostgreSQL root password for prod" />
      </div>

      <div>
        <Label htmlFor="type">Type *</Label>
        <Select id="type" value={type} onChange={(e) => setType(e.target.value as CredentialType)}>
          {Object.entries(CREDENTIAL_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="ns">Namespace</Label>
        <Select id="ns" value={namespaceId} onChange={(e) => setNamespaceId(e.target.value)}>
          <option value="">— none —</option>
          {namespaces.map((n) => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder="Add tag and press Enter"
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((t) => (
              <Badge key={t} variant="muted" className="flex items-center gap-1">
                #{t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}>
                  <X size={10} />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {showValue && (
        <div>
          <Label htmlFor="val">Value *</Label>
          <Textarea
            id="val"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="The credential value (will be encrypted)"
            className="font-mono"
          />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
