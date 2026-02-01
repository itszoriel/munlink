import React from 'react'

export type Column<R> = {
  key: string
  header: string
  className?: string
  render?: (row: R) => React.ReactNode
}

export type Pagination = {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export type DataTableProps<R = any> = {
  columns: Array<Column<R>>
  data: R[]
  emptyState?: React.ReactNode
  onRowClick?: (row: R) => void
  pagination?: Pagination
  className?: string
}

export function DataTable<R = any>({ columns, data, emptyState, onRowClick, pagination, className }: DataTableProps<R>) {
  return (
    <div className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-card-foreground)] overflow-hidden ${className || ''}`.trim()}>
      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 border-b border-[var(--color-border)] text-sm font-semibold">
        {columns.map((c, idx) => (
          <div key={c.key} className={c.className || (idx === columns.length - 1 ? 'text-right' : '')}>{c.header}</div>
        ))}
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {data.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[color:var(--color-muted)]">{emptyState || 'No records found'}</div>
        ) : (
          data.map((row: any, i) => (
            <div key={i} className={`px-4 py-3 ${onRowClick ? 'cursor-pointer hover:bg-[var(--color-surface)]' : ''}`} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {/* Mobile stacked */}
              <div className="md:hidden space-y-2">
                {columns.map((c) => (
                  <div key={c.key} className={`text-sm ${c.key === 'actions' ? 'flex justify-end' : ''}`}>
                    {c.key === 'actions' ? (
                      <span>{c.render ? c.render(row) : String(row[c.key] ?? '')}</span>
                    ) : (
                      <>
                        <span className="text-[color:var(--color-muted)] mr-2">{c.header}:</span>
                        <span>{c.render ? c.render(row) : String(row[c.key] ?? '')}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {/* Desktop grid */}
              <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                {columns.map((c, idx) => (
                  <div key={c.key} className={c.className || (idx === columns.length - 1 ? 'text-right' : '')}>
                    {c.render ? c.render(row) : String(row[c.key] ?? '')}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      {pagination ? (
        <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between text-sm">
          <div>Showing {Math.min(pagination.pageSize, Math.max(0, pagination.total - (pagination.page - 1) * pagination.pageSize))} of {pagination.total}</div>
          <div className="flex gap-2">
            <button disabled={pagination.page <= 1} onClick={() => pagination.onChange(pagination.page - 1)} className="px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-50">Previous</button>
            <button disabled={pagination.page * pagination.pageSize >= pagination.total} onClick={() => pagination.onChange(pagination.page + 1)} className="px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-50">Next</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}


