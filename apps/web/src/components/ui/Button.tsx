import type { ReactNode } from 'react'

type Props = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  iconLeft?: ReactNode
  iconRight?: ReactNode
  loading?: boolean
  className?: string
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}

export default function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  loading = false,
  className = '',
  children,
  onClick,
  disabled,
}: Props) {
  const variants: Record<string, string> = {
    primary: 'bg-ocean-gradient text-white shadow-card hover:scale-105',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
    ghost: 'bg-transparent text-ocean-600 hover:bg-ocean-50',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:scale-105',
  }
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${variants[variant]} ${sizes[size]} rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 justify-center min-h-[44px] whitespace-normal break-words ${className}`}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          {iconLeft && <span>{iconLeft}</span>}
          <span>{children}</span>
          {iconRight && <span>{iconRight}</span>}
        </>
      )}
    </button>
  )
}


