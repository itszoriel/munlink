import React from 'react'

// Base skeleton styles
const baseClass = 'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-shimmer rounded'

export type SkeletonProps = {
  className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div className={`${baseClass} ${className || ''}`.trim()} />
)

// Skeleton line for text content
export type SkeletonLineProps = {
  width?: 'full' | '3/4' | '1/2' | '1/3' | '1/4'
  className?: string
}

export const SkeletonLine: React.FC<SkeletonLineProps> = ({ width = 'full', className }) => {
  const widthClass = {
    'full': 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
    '1/4': 'w-1/4',
  }[width]

  return <div className={`${baseClass} h-4 ${widthClass} ${className || ''}`.trim()} />
}

// Skeleton text (smaller than line)
export type SkeletonTextProps = {
  width?: 'full' | '3/4' | '1/2' | '1/3' | '1/4'
  className?: string
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ width = '3/4', className }) => {
  const widthClass = {
    'full': 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
    '1/4': 'w-1/4',
  }[width]

  return <div className={`${baseClass} h-3 ${widthClass} ${className || ''}`.trim()} />
}

// Skeleton heading
export type SkeletonHeadingProps = {
  width?: 'full' | '3/4' | '1/2' | '1/3' | '1/4'
  className?: string
}

export const SkeletonHeading: React.FC<SkeletonHeadingProps> = ({ width = '1/2', className }) => {
  const widthClass = {
    'full': 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
    '1/4': 'w-1/4',
  }[width]

  return <div className={`${baseClass} h-6 ${widthClass} ${className || ''}`.trim()} />
}

// Skeleton avatar
export type SkeletonAvatarProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({ size = 'md', className }) => {
  const sizeClass = {
    'sm': 'h-8 w-8',
    'md': 'h-10 w-10',
    'lg': 'h-12 w-12',
    'xl': 'h-16 w-16',
  }[size]

  return <div className={`${baseClass} rounded-full ${sizeClass} ${className || ''}`.trim()} />
}

// Skeleton card
export type SkeletonCardProps = {
  lines?: number
  showAvatar?: boolean
  showImage?: boolean
  className?: string
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  lines = 3,
  showAvatar = false,
  showImage = false,
  className,
}) => (
  <div className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden ${className || ''}`.trim()}>
    {showImage && (
      <div className={`${baseClass} h-40 rounded-none`} />
    )}
    <div className="p-6">
      {showAvatar && (
        <div className="flex items-center gap-3 mb-4">
          <SkeletonAvatar />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="1/3" />
            <SkeletonText width="1/4" />
          </div>
        </div>
      )}
      <div className="space-y-3">
        <SkeletonHeading />
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonText key={i} width={i === lines - 1 ? '1/2' : '3/4'} />
        ))}
      </div>
    </div>
  </div>
)

// Skeleton table
export type SkeletonTableProps = {
  rows?: number
  columns?: number
  className?: string
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  className,
}) => (
  <div className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden ${className || ''}`.trim()}>
    {/* Header */}
    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonLine key={i} width="3/4" />
        ))}
      </div>
    </div>
    {/* Rows */}
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="px-4 py-3">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <SkeletonText key={colIndex} width={colIndex === 0 ? '3/4' : '1/2'} />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)

// Skeleton stat card
export type SkeletonStatCardProps = {
  className?: string
}

export const SkeletonStatCard: React.FC<SkeletonStatCardProps> = ({ className }) => (
  <div className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 ${className || ''}`.trim()}>
    <div className="flex items-center justify-between">
      <div className="flex-1 space-y-2">
        <SkeletonText width="1/2" />
        <SkeletonHeading width="1/3" />
      </div>
      <div className={`${baseClass} w-12 h-12 rounded-xl`} />
    </div>
  </div>
)
