import React from 'react'

export type FormFieldProps = {
  label?: string
  description?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export const FormField: React.FC<FormFieldProps> = ({ label, description, error, required, children, className }) => {
  return (
    <div className={className}>
      {label ? (
        <label className="block text-sm text-[color:var(--color-muted)] mb-1">
          {label}
          {required ? <span className="ml-0.5 text-red-600">*</span> : null}
        </label>
      ) : null}
      {children}
      {description ? <p className="mt-1 text-xs text-[color:var(--color-muted)]">{description}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}


