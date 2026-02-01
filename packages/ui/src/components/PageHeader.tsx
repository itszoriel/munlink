import * as React from 'react'

export interface PageHeaderProps {
  /** Page title - displayed prominently */
  title: string
  /** Optional subtitle description */
  subtitle?: string
  /** Optional action buttons aligned right */
  actions?: React.ReactNode
  /** Optional className override */
  className?: string
}

/**
 * PageHeader - Unified page header component for consistent page layouts
 * Uses serif font for titles per SerbisyoZambaleño design system
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className,
}) => {
  return (
    <div className={`mb-6 md:mb-8 ${className || ''}`.trim()}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-[var(--color-surface-foreground)]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm sm:text-base text-[color:var(--color-muted)]">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export default PageHeader

