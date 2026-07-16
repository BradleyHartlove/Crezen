import { Link } from 'react-router-dom'
import {
  User, KeyRound, Zap, ShieldCheck, Key, Lock, FileText
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime, CREDENTIAL_TYPE_LABELS } from '@/lib/utils'
import { Credential } from '@/api/credentials'
import { Namespace } from '@/api/namespaces'

const TYPE_ICONS: Record<string, React.ElementType> = {
  username: User,
  password: Lock,
  api_token: Zap,
  ca_cert: ShieldCheck,
  public_key: Key,
  private_key: KeyRound,
  cert: FileText,
}

interface Props {
  credential: Credential
  namespace?: Namespace
}

export function CredentialCard({ credential, namespace }: Props) {
  const Icon = TYPE_ICONS[credential.type] ?? KeyRound

  return (
    <Link
      to={`/vault/${credential.id}`}
      className="block rounded-lg border border-border bg-surface p-4 hover:border-accent/50 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-accent">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground font-mono truncate group-hover:text-accent transition-colors">
              {credential.name}
            </span>
            <Badge variant="muted">{CREDENTIAL_TYPE_LABELS[credential.type]}</Badge>
            {namespace && <Badge variant="accent">{namespace.name}</Badge>}
          </div>
          {credential.description && (
            <p className="text-xs text-muted mt-1 line-clamp-1">{credential.description}</p>
          )}
          {credential.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {credential.tags.map((t) => (
                <span key={t} className="text-[10px] text-muted font-mono">#{t}</span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted mt-2">
            updated {formatRelativeTime(credential.updated_at)}
          </p>
        </div>
      </div>
    </Link>
  )
}
