import React, { type CSSProperties } from 'react'
import { useAnimatedCounter } from '../hooks/useAnimatedCounter'

export type StatCardProps = {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: { value: number; direction: 'up' | 'down'; label?: string }
  href?: string
  onClick?: () => void
  className?: string
  /**
   * Enable animated counter for numeric values (default: true)
   */
  animated?: boolean
  /**
   * Animation duration in milliseconds (default: 1000 for desktop, 500 for mobile)
   */
  animationDuration?: number
  /**
   * Format function for the value display
   */
  formatValue?: (value: number) => string
  /**
   * Optional sparkline data array for mini chart visualization
   */
  sparklineData?: number[]
  /**
   * Color for the sparkline (default: 'sky')
   */
  sparklineColor?: 'sky' | 'emerald' | 'amber' | 'red'
}

// Simple sparkline component
const Sparkline: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = ({
  data,
  color,
  width = 80,
  height = 24
}) => {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const colorMap = {
    sky: { stroke: '#0ea5e9', fill: '#e0f2fe' },
    emerald: { stroke: '#10b981', fill: '#ecfdf5' },
    amber: { stroke: '#f59e0b', fill: '#fffbeb' },
    red: { stroke: '#ef4444', fill: '#fef2f2' },
  }
  const colors = colorMap[color as keyof typeof colorMap] || colorMap.sky

  // Create area path
  const areaPath = `M0,${height} L${points} L${width},${height} Z`

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      {/* Area fill */}
      <path d={areaPath} fill={colors.fill} opacity="0.5" />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={colors.stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
        r="3"
        fill={colors.stroke}
      />
    </svg>
  )
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  href,
  onClick,
  className,
  animated = true,
  animationDuration,
  formatValue = (n) => n.toLocaleString(),
  sparklineData,
  sparklineColor = 'sky',
}) => {
  // Detect if value is numeric
  const numericValue = typeof value === 'number' ? value : parseFloat(value as string)
  const isNumeric = !isNaN(numericValue)

  // Determine animation duration (faster on mobile)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const duration = animationDuration ?? (isMobile ? 500 : 1000)

  // Use animated counter for numeric values
  const animatedValue = useAnimatedCounter({
    end: isNumeric ? numericValue : 0,
    duration,
    animateOnMount: animated && isNumeric,
  })

  // Display value
  const displayValue = isNumeric && animated ? formatValue(animatedValue) : value
  const iconStyle: CSSProperties = {
    backgroundColor: 'var(--admin-accent-100, #e0f2fe)',
    color: 'var(--admin-accent-600, #0ea5e9)',
  }

  const content = (
    <div className={`card-stat bg-white p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : ''} ${className || ''}`.trim()}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-3xl font-semibold text-slate-900 mt-1">{displayValue}</p>
          {trend ? (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className={`inline-flex items-center gap-1 font-medium ${
                trend.direction === 'up' ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {trend.direction === 'up' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                )}
                {Math.abs(trend.value)}%
              </span>
              {trend.label && (
                <span className="text-slate-500">{trend.label}</span>
              )}
            </div>
          ) : null}
          {sparklineData && sparklineData.length >= 2 && (
            <div className="mt-3">
              <Sparkline data={sparklineData} color={sparklineColor} />
            </div>
          )}
        </div>
        {icon ? (
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={iconStyle}>
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  )

  if (href) {
    return <a href={href} onClick={onClick} className="block">{content}</a>
  }
  return <div onClick={onClick}>{content}</div>
}


