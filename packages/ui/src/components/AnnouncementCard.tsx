import React from 'react'
import { Card } from './Card'

export type AnnouncementCardProps = {
  title: string
  body: string
  date?: string
  author?: string
  actions?: React.ReactNode
  role?: 'admin' | 'resident'
  className?: string
}

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({ title, body, date, author, actions, role, className }) => {
  return (
    <Card
      className={className}
      title={title}
      subtitle={[author, date].filter(Boolean).join(' • ')}
      actions={actions}
    >
      <p className="text-sm leading-6 whitespace-pre-wrap">{body}</p>
      {role === 'admin' ? (
        <div className="mt-4 text-xs text-[color:var(--color-muted)]">Visible to all residents</div>
      ) : null}
    </Card>
  )
}


