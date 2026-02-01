import React from 'react'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref
) {
  const base = 'w-full rounded-md border px-3 py-2 bg-[var(--color-card)] text-[var(--color-card-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'
  const border = invalid ? 'border-red-500' : 'border-[var(--color-border)]'
  return (
    <select ref={ref} className={`${base} ${border} ${className || ''}`.trim()} {...props}>
      {children}
    </select>
  )
})


