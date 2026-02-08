import React from 'react'

export type ButtonProps = {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient' | 'outline' | 'success'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  isLoading?: boolean
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm md:text-base',
  lg: 'h-12 px-5 text-base',
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:brightness-95',
  secondary: 'bg-[var(--color-card)] text-[var(--color-card-foreground)] border border-[var(--color-border)] hover:bg-[var(--color-surface)]',
  ghost: 'bg-transparent text-[var(--color-surface-foreground)] hover:bg-[var(--color-card)]',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  gradient: 'bg-ocean-gradient text-white hover:scale-105 transition-transform shadow-lg',
  outline: 'bg-transparent border-2 border-[color:var(--color-primary)] text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-light)] hover:border-[color:var(--color-primary-hover)]',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md hover:shadow-lg hover:shadow-emerald-500/20',
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
  isLoading,
  onClick,
  className,
  disabled,
  type = 'button',
  leadingIcon,
  trailingIcon,
}) => {
  const widthClass = fullWidth ? 'w-full' : ''
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${widthClass} ${className || ''}`.trim()}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-4 w-4 mr-2"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : leadingIcon ? (
        <span className="mr-2 inline-flex items-center">{leadingIcon}</span>
      ) : null}
      <span>{isLoading ? 'Processing...' : children}</span>
      {!isLoading && trailingIcon ? <span className="ml-2 inline-flex items-center">{trailingIcon}</span> : null}
    </button>
  )
}


