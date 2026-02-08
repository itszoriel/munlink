import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { mediaUrl } from '@/lib/api'
import { isRead, markRead } from '@/utils/unread'

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

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const Inner = (
    <article
      onClick={handleClick}
      className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-ocean-200 transition-all duration-300 cursor-pointer"
    >
      {/* Image section */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-100">
        {Array.isArray(images) && images[0] ? (
          <img
            src={mediaUrl(images[0]) || undefined}
            alt="announcement"
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Top-left badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap">
          {scopeLabel && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-white/95 backdrop-blur-sm text-gray-800 shadow-sm">
              {scopeLabel}
            </span>
          )}
          {pinned && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-ocean-600 text-white shadow-sm">
              📌 Pinned
            </span>
          )}
        </div>

        {/* Top-right priority badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur-sm ${priorityStyles}`}>
            {priority}
          </span>
        </div>

        {/* Unread indicator */}
        {!read && (
          <div className="absolute top-2 left-2">
            <span className="inline-block h-3 w-3 rounded-full bg-ocean-500 ring-2 ring-white shadow-sm animate-pulse" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Content section */}
      <div className="p-4 space-y-2">
        <h3 className="font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-ocean-600 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
          {content}
        </p>
        {createdAt && (
          <div className="flex items-center gap-1.5 pt-1">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-gray-500 font-medium">
              {getTimeAgo(createdAt)}
            </span>
          </div>
        )}
      </div>
    </article>
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


