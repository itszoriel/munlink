import React from 'react'

export type InputGroupProps = {
  children: React.ReactNode
  label?: string
  labelPosition?: 'top' | 'floating'
  hint?: string
  error?: string
  required?: boolean
  className?: string
  htmlFor?: string
}

export const InputGroup: React.FC<InputGroupProps> = ({
  children,
  label,
  labelPosition = 'top',
  hint,
  error,
  required,
  className,
  htmlFor,
}) => {
  const hasError = Boolean(error)

  if (labelPosition === 'floating') {
    return (
      <div className={`relative ${className || ''}`.trim()}>
        <div className="relative">
          {children}
          {label && (
            <label
              htmlFor={htmlFor}
              className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 transition-all duration-200 pointer-events-none
                peer-focus:-translate-y-[calc(100%+0.5rem)] peer-focus:left-3 peer-focus:top-0 peer-focus:text-xs peer-focus:text-sky-600 peer-focus:bg-white peer-focus:px-1
                peer-[:not(:placeholder-shown)]:-translate-y-[calc(100%+0.5rem)] peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:bg-white peer-[:not(:placeholder-shown)]:px-1
                ${hasError ? 'peer-focus:text-red-500 peer-[:not(:placeholder-shown)]:text-red-500' : ''}
              `}
            >
              {label}
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-1.5 ${className || ''}`.trim()}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-slate-700"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  )
}
