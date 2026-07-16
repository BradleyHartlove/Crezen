import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { credentialsApi, Credential } from '@/api/credentials'
import { namespacesApi, Namespace } from '@/api/namespaces'
import { CredentialCard } from '@/components/credentials/CredentialCard'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function VaultPage() {
  const [creds, setCreds] = useState<Credential[]>([])
  const [namespaces, setNamespaces] = useState<Namespace[]>([])
  const [search, setSearch] = useState('')
  const [nsFilter, setNsFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [c, n] = await Promise.all([credentialsApi.list(), namespacesApi.list()])
    setCreds(c)
    setNamespaces(n)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    creds.forEach((c) => c.tags.forEach((t) => set.add(t)))
    return [...set].sort()
  }, [creds])

  const nsMap = useMemo(() => {
    const m: Record<string, Namespace> = {}
    namespaces.forEach((n) => (m[n.id] = n))
    return m
  }, [namespaces])

  const filtered = useMemo(() => {
    return creds.filter((c) => {
      if (nsFilter && c.namespace_id !== nsFilter) return false
      if (tagFilter && !c.tags.includes(tagFilter)) return false
      if (search) {
        const q = search.toLowerCase()
        return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
      }
      return true
    })
  }, [creds, nsFilter, tagFilter, search])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-base font-semibold text-foreground font-mono">Vault</h1>
          <p className="text-xs text-muted mt-0.5">{creds.length} credentials</p>
        </div>
        <Link to="/vault/new">
          <Button size="sm">
            <Plus size={14} />
            New
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            placeholder="Search credentials…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {namespaces.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setNsFilter(null)}
              className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                nsFilter === null ? 'border-accent text-accent bg-accent/10' : 'border-border text-muted hover:text-foreground'
              }`}
            >
              all namespaces
            </button>
            {namespaces.map((n) => (
              <button
                key={n.id}
                onClick={() => setNsFilter(nsFilter === n.id ? null : n.id)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                  nsFilter === n.id ? 'border-accent text-accent bg-accent/10' : 'border-border text-muted hover:text-foreground'
                }`}
              >
                {n.name}
              </button>
            ))}
          </div>
        )}

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.map((t) => (
              <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)}>
                <Badge variant={tagFilter === t ? 'accent' : 'muted'}>#{t}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-xs text-muted py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted font-mono">No credentials found.</p>
          <Link to="/vault/new" className="text-xs text-accent hover:underline mt-2 block">
            Add your first credential →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((c) => (
            <CredentialCard key={c.id} credential={c} namespace={c.namespace_id ? nsMap[c.namespace_id] : undefined} />
          ))}
        </div>
      )}
    </div>
  )
}
