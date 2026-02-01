import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { mediaUrl } from '@/lib/api'
import { isRead, markRead } from '@/utils/unread'
import Card from '@/components/ui/Card'

type Priority = 'high' | 'medium' | 'low'

type Props = {
  id: number
  title: string
  content: string
  municipality?: string
  barangay?: string
  scope?: 'PROVINCE' | 'MUNICIPALITY' | 'BARANGAY'
  priority: Priority
  createdAt?: string
  images?: string[]
  pinned?: boolean
  href?: string
  onClick?: () => void
}

export default function AnnouncementCard({ id, title, content, municipality, barangay, scope, priority, createdAt, images, pinned, href, onClick }: Props) {
  const [read, setRead] = useState<boolean>(isRead(id))
  const scopeLabel = useMemo(() => {
    const sc = (scope || '').toUpperCase()
    if (sc === 'PROVINCE') return 'Province-wide'
    if (sc === 'BARANGAY') return barangay || 'Barangay'
    return municipality || 'Municipality'
  }, [scope, municipality, barangay])

  useEffect(() => {
    setRead(isRead(id))
  }, [id])

  const priorityStyles = useMemo(() => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700'
      case 'medium':
        return 'bg-sunset-100 text-sunset-700'
      default:
        return 'bg-forest-100 text-forest-700'
    }
  }, [priority])

  const handleClick = () => {
    if (!read) {
      markRead(id)
      setRead(true)
    }
    onClick?.()
  }

  const Inner = (
    <Card variant="elevated" hover className={`overflow-hidden group animate-fade-in-up`}>
      <article onClick={handleClick}>
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          {Array.isArray(images) && images[0] ? (
            <img src={mediaUrl(images[0]) || undefined} alt="announcement" loading="lazy" className="h-full w-full object-cover transform transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <div className="h-full w-full bg-neutral-100" />
          )}
          {/* Top-left badges */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            {scopeLabel && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-white/90 text-neutral-800 shadow">{scopeLabel}</span>
            )}
            {pinned ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-ocean-600 text-white shadow">Pinned</span>
            ) : null}
          </div>
          {/* Top-right priority */}
          <div className="absolute top-3 right-3">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide shadow ${priorityStyles}`}>{priority}</span>
          </div>
          {/* Unread dot */}
          {!read && (
            <div className="absolute -left-1 -top-1">
              <span className="inline-block h-3 w-3 rounded-full bg-ocean-500 ring-4 ring-white" />
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-neutral-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{content}</p>
          {createdAt && (
            <div className="mt-3 text-xs text-neutral-500">{new Date(createdAt).toLocaleDateString()}</div>
          )}
        </div>
      </article>
    </Card>
  )

  if (href) {
    return (
      <Link to={href} className="block" onClick={handleClick}>
        {Inner}
      </Link>
    )
  }
  return Inner
}


