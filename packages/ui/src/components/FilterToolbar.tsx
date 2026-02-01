import * as React from 'react'

export interface FilterToolbarProps {
  /** Optional children for custom filter content */
  children?: React.ReactNode
  /** Optional className override */
  className?: string
}

/**
 * FilterToolbar - Unified filter bar component for consistent page layouts
 * Provides a glassmorphism card style for filter controls
 */
export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  children,
  className,
}) => {
  return (
    <div
      className={`bg-white/70 backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-lg border border-white/50 mb-6 ${className || ''}`.trim()}
    >
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch lg:items-center">
        {children}
      </div>
    </div>
  )
}

export interface FilterGroupProps {
  /** Label for the filter group */
  label?: string
  /** Filter control (select, input, etc) */
  children: React.ReactNode
  /** Optional className override */
  className?: string
}

/**
 * FilterGroup - A labeled filter control wrapper
 */
export const FilterGroup: React.FC<FilterGroupProps> = ({
  label,
  children,
  className,
}) => {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`.trim()}>
      {label && (
        <label className="text-sm text-[color:var(--color-muted)] whitespace-nowrap">
          {label}
        </label>
      )}
      {children}
    </div>
  )
}

export interface FilterActionsProps {
  /** Action buttons */
  children: React.ReactNode
  /** Optional className override */
  className?: string
}

/**
 * FilterActions - Right-aligned action buttons in toolbar
 */
export const FilterActions: React.FC<FilterActionsProps> = ({
  children,
  className,
}) => {
  return (
    <div className={`flex items-center gap-2 lg:ml-auto ${className || ''}`.trim()}>
      {children}
    </div>
  )
}

export default FilterToolbar

