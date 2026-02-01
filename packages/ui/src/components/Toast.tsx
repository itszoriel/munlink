import React, { useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

export type ToastProps = {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  onClose: () => void
}

export const Toast: React.FC<ToastProps> = ({ type, message, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  const colors: Record<string, string> = {
    success: 'from-forest-500 to-forest-600',
    error: 'from-red-500 to-red-600',
    warning: 'from-sunset-500 to-sunset-600',
    info: 'from-ocean-500 to-ocean-600',
  }

  return (
    <div className="fixed top-20 right-6 z-50 animate-slide-in-right">
      <div className={`flex items-center gap-3 bg-gradient-to-r ${colors[type]} text-white px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl`}>
        <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
          {type === 'success' && <CheckCircle className="w-5 h-5" aria-hidden="true" />}
          {type === 'error' && <XCircle className="w-5 h-5" aria-hidden="true" />}
          {type === 'warning' && <AlertTriangle className="w-5 h-5" aria-hidden="true" />}
          {type === 'info' && <Info className="w-5 h-5" aria-hidden="true" />}
        </div>
        <p className="font-medium">{message}</p>
        <button onClick={onClose} className="ml-2 hover:bg-white/20 p-1 rounded-lg" aria-label="Close notification">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}


