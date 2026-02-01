import React from 'react'

export type IconButtonProps = {
  children: React.ReactNode
  variant?: 'default' | 'primary' | 'danger' | 'success' | 'warning'
  size?: 'sm' | 'md' | 'lg'
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  'aria-label': string
}

const sizeClasses: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-10 w-10',
}

const variantClasses: Record<NonNullable<IconButtonProps['variant']>, string> = {
  default: 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border-slate-200 hover:border-slate-300',
  primary: 'bg-sky-100 text-sky-600 hover:bg-sky-200 hover:text-sky-700 border-sky-200 hover:border-sky-300',
  danger: 'bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700 border-red-200 hover:border-red-300',
  success: 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 hover:text-emerald-700 border-emerald-200 hover:border-emerald-300',
  warning: 'bg-amber-100 text-amber-600 hover:bg-amber-200 hover:text-amber-700 border-amber-200 hover:border-amber-300',
}

const baseClasses = 'inline-flex items-center justify-center rounded-lg border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  variant = 'default',
  size = 'md',
  onClick,
  className,
  disabled,
  type = 'button',
  'aria-label': ariaLabel,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className || ''}`.trim()}
    >
      {children}
    </button>
  )
}
