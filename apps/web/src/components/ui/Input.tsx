import type { ReactNode } from 'react'

type Props = {
  label: string
  type?: string
  value?: string
  placeholder?: string
  error?: string
  icon?: ReactNode
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function Input({ label, type = 'text', value, placeholder, error, icon, onChange }: Props) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder || ' '}
        className={`peer w-full px-4 pt-6 pb-2 ${icon ? 'pl-12' : ''} border-2 rounded-xl transition-all outline-none ${error ? 'border-red-500 focus:ring-red-500/10' : 'border-gray-300 focus:ring-2 focus:ring-ocean-500 focus:border-transparent'}`}
      />
      <label className={`absolute ${icon ? 'left-12' : 'left-4'} top-2 text-xs transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs ${error ? 'text-red-500' : 'text-gray-500 peer-focus:text-ocean-600'}`}>
        {label}
      </label>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}


