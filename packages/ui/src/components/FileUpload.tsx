import React from 'react'

export type FileUploadProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
  description?: string
  invalid?: boolean
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, description, className, invalid, ...props }) => {
  return (
    <div className={className}>
      {label ? <label className="block text-sm text-[color:var(--color-muted)] mb-1">{label}</label> : null}
      <input
        type="file"
        className={`w-full rounded-md border px-3 py-2 bg-[var(--color-card)] text-[var(--color-card-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${invalid ? 'border-red-500' : 'border-[var(--color-border)]'}`}
        {...props}
      />
      {description ? <p className="mt-1 text-xs text-[color:var(--color-muted)]">{description}</p> : null}
    </div>
  )
}


