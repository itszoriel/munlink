import React from 'react'

export type AvatarProps = {
  src?: string
  alt?: string
  fallback?: string
  size?: number
  className?: string
}

export const Avatar: React.FC<AvatarProps> = ({ src, alt, fallback, size = 48, className }) => {
  const dimension = { width: size, height: size }
  if (src) {
    return <img src={src} alt={alt || ''} style={dimension} className={`rounded-full object-cover border border-[var(--color-border)] ${className || ''}`.trim()} />
  }
  return (
    <div style={dimension} className={`rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)] border border-[var(--color-border)] flex items-center justify-center font-semibold ${className || ''}`.trim()}>
      {fallback ? fallback.slice(0, 2).toUpperCase() : ''}
    </div>
  )
}


