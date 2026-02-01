import React from 'react'

export type FormProps = React.FormHTMLAttributes<HTMLFormElement> & {
  columns?: 1 | 2 | 3
}

export const Form: React.FC<FormProps> = ({ children, className, columns = 1, ...props }) => {
  const grid = columns === 1 ? 'grid-cols-1' : columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
  return (
    <form className={`${className || ''}`.trim()} {...props}>
      <div className={`grid gap-4 ${grid}`}>{children}</div>
    </form>
  )
}


