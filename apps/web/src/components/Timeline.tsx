import type { ReactNode } from 'react'
import { useScrollAnimation } from '../hooks/useScrollAnimation'

export interface TimelineItem {
  title: string
  date: string
  description: string | ReactNode
  icon?: ReactNode
  color?: 'ocean' | 'forest' | 'sunset' | 'purple'
}

export interface TimelineProps {
  items: TimelineItem[]
  className?: string
}

/**
 * Get color classes for timeline items
 */
function getColorClasses(color: TimelineItem['color'] = 'ocean') {
  const colors = {
    ocean: {
      dot: 'bg-sky-500',
      ring: 'ring-sky-200',
      icon: 'bg-sky-100 text-sky-600',
      line: 'bg-sky-300',
    },
    forest: {
      dot: 'bg-emerald-500',
      ring: 'ring-emerald-200',
      icon: 'bg-emerald-100 text-emerald-600',
      line: 'bg-emerald-300',
    },
    sunset: {
      dot: 'bg-amber-500',
      ring: 'ring-amber-200',
      icon: 'bg-amber-100 text-amber-600',
      line: 'bg-amber-300',
    },
    purple: {
      dot: 'bg-purple-500',
      ring: 'ring-purple-200',
      icon: 'bg-purple-100 text-purple-600',
      line: 'bg-purple-300',
    },
  }
  return colors[color]
}

/**
 * Desktop timeline item (alternating left/right)
 */
function TimelineItemDesktop({
  item,
  isLeft,
  colorClasses,
}: {
  item: TimelineItem
  isLeft: boolean
  colorClasses: ReturnType<typeof getColorClasses>
}) {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.3 })

  return (
    <div
      ref={ref}
      className={`grid grid-cols-[1fr_40px_1fr] gap-8 items-center transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      {/* Left side */}
      <div className={`${isLeft ? 'text-right' : ''}`}>
        {isLeft && (
          <div className="pr-8">
            <div className="inline-block text-left">
              <h3 className="text-xl font-semibold text-slate-900 mb-1">{item.title}</h3>
              <p className="text-sm font-medium text-slate-500 mb-3">{item.date}</p>
              <div className="text-slate-600 leading-relaxed">{item.description}</div>
            </div>
          </div>
        )}
      </div>

      {/* Center dot */}
      <div className="flex justify-center">
        <div className={`relative ${colorClasses.dot} w-6 h-6 rounded-full ring-4 ${colorClasses.ring}`}>
          {item.icon && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full ${colorClasses.icon} flex items-center justify-center shadow-md`}>
              {item.icon}
            </div>
          )}
        </div>
      </div>

      {/* Right side */}
      <div>
        {!isLeft && (
          <div className="pl-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-1">{item.title}</h3>
            <p className="text-sm font-medium text-slate-500 mb-3">{item.date}</p>
            <div className="text-slate-600 leading-relaxed">{item.description}</div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Mobile timeline item (left-aligned)
 */
function TimelineItemMobile({
  item,
  colorClasses,
}: {
  item: TimelineItem
  colorClasses: ReturnType<typeof getColorClasses>
}) {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.2 })

  return (
    <div
      ref={ref}
      className={`relative pl-12 transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      {/* Dot */}
      <div className={`absolute left-[13px] top-1 ${colorClasses.dot} w-4 h-4 rounded-full ring-4 ${colorClasses.ring}`} />

      {/* Content */}
      <div>
        {item.icon && (
          <div className={`w-10 h-10 rounded-full ${colorClasses.icon} flex items-center justify-center mb-3 shadow-sm`}>
            {item.icon}
          </div>
        )}
        <h3 className="text-lg font-semibold text-slate-900 mb-1">{item.title}</h3>
        <p className="text-sm font-medium text-slate-500 mb-2">{item.date}</p>
        <div className="text-slate-600 leading-relaxed text-sm">{item.description}</div>
      </div>
    </div>
  )
}

/**
 * Timeline component with scroll-triggered animations
 */
export default function Timeline({ items, className = '' }: TimelineProps) {

  return (
    <div className={`relative ${className}`}>
      {/* Desktop: Two-column layout with center line */}
      <div className="hidden md:block">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-200 transform -translate-x-1/2" />

        {/* Timeline items */}
        <div className="space-y-12">
          {items.map((item, index) => {
            const isLeft = index % 2 === 0
            return (
              <TimelineItemDesktop
                key={index}
                item={item}
                isLeft={isLeft}
                colorClasses={getColorClasses(item.color)}
              />
            )
          })}
        </div>
      </div>

      {/* Mobile: Single column with left line */}
      <div className="md:hidden">
        {/* Left line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

        {/* Timeline items */}
        <div className="space-y-8">
          {items.map((item, index) => (
            <TimelineItemMobile
              key={index}
              item={item}
              colorClasses={getColorClasses(item.color)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
