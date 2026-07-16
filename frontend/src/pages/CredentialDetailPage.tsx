import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { credentialsApi, Credential } from '@/api/credentials'
import { namespacesApi, Namespace } from '@/api/namespaces'
import { wasm } from '@/wasm'
import { RevealButton } from '@/components/credentials/RevealButton'
import { CopyButton } from '@/components/credentials/CopyButton'
import { CredentialForm, CredentialFormData } from '@/components/credentials/CredentialForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { CREDENTIAL_TYPE_LABELS, formatRelativeTime } from '@/lib/utils'

export function CredentialDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [cred, setCred] = useState<Credential | null>(null)
  const [namespaces, setNamespaces] = useState<Namespace[]>([])
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(true)

  const nsMap = Object.fromEntries(namespaces.map((n) => [n.id, n]))

  useEffect(() => {
    if (!id) return
    Promise.all([credentialsApi.get(id), namespacesApi.list()]).then(([c, ns]) => {
      setCred(c)
      setNamespaces(ns)
      setLoading(false)
    })
  }, [id])

  const handleUpdate = async (data: CredentialFormData) => {
    if (!cred) return
    const encryptedData = data.value ? wasm.encryptCredential(data.value) : undefined
    const updated = await credentialsApi.update(cred.id, {
      name: data.name,
      description: data.description,
      namespace_id: data.namespace_id,
      tags: data.tags,
      encrypted_data: encryptedData,
    })
    setCred(updated)
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!cred) return
    await credentialsApi.delete(cred.id)
    navigate('/vault')
  }

  if (loading) return <div className="p-6 text-xs text-muted">Loading…</div>
  if (!cred) return <div className="p-6 text-xs text-destructive">Not found</div>

  const namespace = cred.namespace_id ? nsMap[cred.namespace_id] : null

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to="/vault" className="flex items-center gap-1 text-xs text-muted hover:text-foreground mb-6 transition-colors">
        <ArrowLeft size={12} />
        Back to vault
      </Link>

      {!editing ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-base font-semibold text-foreground font-mono">{cred.name}</h1>
              <p className="text-xs text-muted mt-1">{cred.description}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil size={12} />
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={12} />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">{CREDENTIAL_TYPE_LABELS[cred.type]}</Badge>
            {namespace && <Badge variant="accent">{namespace.name}</Badge>}
            {cred.tags.map((t) => (
              <span key={t} className="text-[10px] text-muted font-mono">#{t}</span>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <p className="text-xs text-muted font-mono">Encrypted value</p>
            <div className="flex gap-2 flex-wrap">
              <RevealButton
                encryptedData={cred.encrypted_data!}
                credType={cred.type}
              />
              <CopyButton encryptedData={cred.encrypted_data!} />
            </div>
          </div>

          <div className="text-[10px] text-muted font-mono space-y-1">
            <p>created {formatRelativeTime(cred.created_at)}</p>
            <p>updated {formatRelativeTime(cred.updated_at)}</p>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-base font-semibold text-foreground font-mono mb-6">Edit Credential</h1>
          <div className="border border-border bg-surface rounded-lg p-5">
            <CredentialForm
              initial={{
                name: cred.name,
                description: cred.description,
                type: cred.type,
                namespace_id: cred.namespace_id,
                tags: cred.tags,
                value: '',
              }}
              namespaces={namespaces}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(false)}
              submitLabel="Update"
              showValue={true}
            />
            <p className="text-[10px] text-muted mt-2">Leave value empty to keep the existing encrypted value.</p>
          </div>
        </div>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{cred.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted">This cannot be undone.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
