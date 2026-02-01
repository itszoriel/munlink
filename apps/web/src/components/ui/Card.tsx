import type { ReactNode } from 'react'

type Props = {
  variant?: 'default' | 'glass' | 'gradient' | 'elevated'
  hover?: boolean
  className?: string
  children: ReactNode
}

export default function Card({ variant = 'default', hover = false, className = '', children }: Props) {
  const variants: Record<string, string> = {
    default: 'bg-white border border-slate-200/60 shadow-sm',
    glass: 'bg-white/70 backdrop-blur-xl shadow-lg border border-white/50',
    gradient: 'bg-ocean-gradient text-white shadow-xl',
    elevated: 'bg-white border border-slate-200/60 shadow-md',
  }
  const hoverStyles = hover 
    ? 'hover:shadow-lg hover:border-slate-300/60 hover:-translate-y-0.5 transition-all duration-200' 
    : ''
  
  return (
    <div className={`${variants[variant]} rounded-2xl ${hoverStyles} ${className}`}>
      {children}
    </div>
  )
}


