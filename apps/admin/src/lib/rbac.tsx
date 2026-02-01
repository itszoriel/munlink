import type { ReactNode } from 'react'

export const PERMISSIONS = {
  SUPER_ADMIN: ['*'],
  MUNICIPALITY_ADMIN: [
    'residents.view',
    'residents.edit',
    'documents.approve',
    'marketplace.moderate',
    'announcements.create',
  ],
  MODERATOR: ['marketplace.moderate', 'reports.view', 'issues.resolve'],
  SUPPORT_STAFF: ['residents.view', 'documents.view', 'support.respond'],
} as const

export function ProtectedAction({ permission, children }: { permission: string; children: ReactNode }) {
  // UI-only mock: grant all permissions
  const userPermissions = ['*']
  if (!(userPermissions.includes('*') || userPermissions.includes(permission))) return null
  return <>{children}</>
}


