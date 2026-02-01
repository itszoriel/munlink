import React from 'react'
import { Avatar } from './Avatar'
import { Button } from './Button'

export type ProfileCardProps = {
  role: 'admin' | 'resident'
  avatarUrl?: string
  name: string
  email?: string
  phone?: string
  fields?: Array<{ label: string; value: React.ReactNode; key: string }>
  editable?: boolean
  onEdit?: () => void
  actions?: React.ReactNode
  className?: string
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  role,
  avatarUrl,
  name,
  email,
  phone,
  fields,
  editable,
  onEdit,
  actions,
  className,
}) => {
  const roleChip = (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-card)] border border-[var(--color-border)] text-[color:var(--color-muted)]">
      {role === 'admin' ? 'Admin' : 'Resident'}
    </span>
  )

  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-card-foreground)] shadow-sm ${className || ''}`.trim()}>
      <div className="p-4 sm:p-6 flex items-start gap-4">
        <Avatar src={avatarUrl} alt={name} fallback={name} size={64} className="flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold truncate">{name}</h2>
              <div className="mt-1 flex items-center gap-2 text-sm text-[color:var(--color-muted)]">
                {email ? <span className="truncate">{email}</span> : null}
                {phone ? <span className="truncate">• {phone}</span> : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {roleChip}
              {editable ? (
                <Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button>
              ) : null}
              {actions}
            </div>
          </div>
          {fields && fields.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map((f) => (
                <div key={f.key} className="min-w-0">
                  <p className="text-xs text-[color:var(--color-muted)]">{f.label}</p>
                  <div className="text-sm truncate">{f.value}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {role === 'admin' ? (
        <div className="px-4 sm:px-6 pb-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost">Impersonate</Button>
            <Button size="sm" variant="ghost">View Logs</Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}


