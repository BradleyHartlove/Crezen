import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { namespacesApi, Namespace } from '@/api/namespaces'
import { credentialsApi } from '@/api/credentials'
import { wasm } from '@/wasm'
import { CredentialForm, CredentialFormData } from '@/components/credentials/CredentialForm'

export function NewCredentialPage() {
  const navigate = useNavigate()
  const [namespaces, setNamespaces] = useState<Namespace[]>([])

  useEffect(() => {
    namespacesApi.list().then(setNamespaces)
  }, [])

  const handleSubmit = async (data: CredentialFormData) => {
    const encryptedData = wasm.encryptCredential(data.value)
    await credentialsApi.create({
      name: data.name,
      description: data.description,
      type: data.type,
      namespace_id: data.namespace_id,
      tags: data.tags,
      encrypted_data: encryptedData,
    })
    navigate('/vault')
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-base font-semibold text-foreground font-mono mb-6">New Credential</h1>
      <div className="border border-border bg-surface rounded-lg p-5">
        <CredentialForm
          namespaces={namespaces}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/vault')}
          submitLabel="Save Credential"
        />
      </div>
    </div>
  )
}
