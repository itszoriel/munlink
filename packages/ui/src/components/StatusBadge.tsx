import React from 'react'

export type StatusBadgeProps = { status: string | undefined | null; className?: string; children?: React.ReactNode }

const colorFor = (s: string) => {
  const t = s.toLowerCase()
  if (t.includes('pending') || t.includes('submitted') || t.includes('under')) return 'bg-amber-50 text-amber-700 ring-amber-200'
  if (t.includes('approved') || t.includes('completed') || t.includes('resolved') || t.includes('success')) return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (t.includes('rejected') || t.includes('failed') || t.includes('closed') || t.includes('cancel')) return 'bg-rose-50 text-rose-700 ring-rose-200'
  if (t.includes('in_progress') || t.includes('progress')) return 'bg-blue-50 text-blue-700 ring-blue-200'
  return 'bg-gray-100 text-gray-700 ring-gray-200'
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', children }) => {
  const color = status ? colorFor(status) : 'bg-gray-100 text-gray-700 ring-gray-200'
  return (
    <span className={`px-2.5 py-1 text-xs rounded-full ring-1 whitespace-nowrap capitalize ${color} ${className}`.trim()}>
      {children || status}
    </span>
  )
}


