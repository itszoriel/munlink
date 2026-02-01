import React, { useState } from 'react'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
  valid?: boolean
  /** Optional icon to show at the start of the input */
  leadingIcon?: React.ReactNode
  /** Optional icon to show at the end of the input */
  trailingIcon?: React.ReactNode
  /** Show inline validation feedback (checkmark for valid, x for invalid) */
  showValidationIcon?: boolean
  /** Floating label text (activates floating label mode) */
  floatingLabel?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, valid, leadingIcon, trailingIcon, showValidationIcon, floatingLabel, ...props },
  ref
) {
  const [isFocused, setIsFocused] = useState(false)
  const [hasValue, setHasValue] = useState(!!props.value || !!props.defaultValue)

  const base = 'w-full rounded-md border bg-[var(--color-card)] text-[var(--color-card-foreground)] placeholder:text-[color:var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all'
  const border = invalid ? 'border-red-500 focus:ring-red-500' : valid ? 'border-emerald-500 focus:ring-emerald-500' : 'border-[var(--color-border)]'

  // Padding adjustments
  const paddingY = floatingLabel ? 'pt-6 pb-2' : 'py-2'
  const paddingLeft = leadingIcon ? 'pl-10' : 'px-3'
  const paddingRight = (trailingIcon || showValidationIcon) ? 'pr-10' : 'px-3'

  // Validation icon (auto-show when valid or invalid)
  const validationIcon = showValidationIcon && (
    invalid ? (
      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ) : valid ? (
      <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ) : null
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasValue(!!e.target.value)
    if (props.onChange) {
      props.onChange(e)
    }
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    if (props.onFocus) {
      props.onFocus(e)
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    if (props.onBlur) {
      props.onBlur(e)
    }
  }

  const inputClasses = `${base} ${border} ${paddingY} ${paddingLeft} ${paddingRight} ${className || ''}`.trim()
  const inputElement = (
    <input
      ref={ref}
      className={inputClasses}
      {...props}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  )

  // Floating label mode
  if (floatingLabel) {
    const isLabelFloating = isFocused || hasValue
    return (
      <div className="relative">
        <label
          className={`absolute left-3 transition-all duration-200 pointer-events-none
            ${isLabelFloating
              ? 'top-1.5 text-xs text-sky-600'
              : 'top-1/2 -translate-y-1/2 text-sm text-slate-500'
            }
            ${invalid ? 'text-red-500' : valid ? 'text-emerald-600' : ''}
          `}
        >
          {floatingLabel}
        </label>
        {leadingIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[color:var(--color-muted)]">
            {leadingIcon}
          </div>
        )}
        {inputElement}
        {(validationIcon || trailingIcon) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {validationIcon || trailingIcon}
          </div>
        )}
      </div>
    )
  }

  // Regular mode with icons
  if (leadingIcon || trailingIcon || validationIcon) {
    return (
      <div className="relative">
        {leadingIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[color:var(--color-muted)]">
            {leadingIcon}
          </div>
        )}
        {inputElement}
        {(validationIcon || trailingIcon) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {validationIcon || trailingIcon}
          </div>
        )}
      </div>
    )
  }

  return inputElement
})


