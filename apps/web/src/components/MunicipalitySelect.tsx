import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { getMunicipalities } from '@/lib/locations'

// Custom event to close other location dropdowns (same as ProvinceSelect)
const CLOSE_LOCATION_DROPDOWNS = 'munlink:closeLocationDropdowns'

export default function MunicipalitySelect() {
  const selected = useAppStore((s) => s.selectedMunicipality)
  const selectedProvince = useAppStore((s) => s.selectedProvince)
  const setMunicipality = useAppStore((s) => s.setMunicipality)
  const setBarangay = useAppStore((s) => s.setBarangay)
  // Use static data - no API call needed, instant load
  const municipalities = useMemo(
    () => getMunicipalities(selectedProvince?.id),
    [selectedProvince?.id]
  )
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('munlink:selectedMunicipality')
    if (saved) {
      try {
        setMunicipality(JSON.parse(saved))
      } catch {}
    }
  }, [setMunicipality])

  // Close this dropdown when another location dropdown opens
  useEffect(() => {
    const handleCloseOthers = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.source !== 'municipality') {
        setIsOpen(false)
      }
    }
    window.addEventListener(CLOSE_LOCATION_DROPDOWNS, handleCloseOthers)
    return () => window.removeEventListener(CLOSE_LOCATION_DROPDOWNS, handleCloseOthers)
  }, [])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const handleToggle = useCallback(() => {
    const newState = !isOpen
    if (newState) {
      // Dispatch event to close other dropdowns
      window.dispatchEvent(new CustomEvent(CLOSE_LOCATION_DROPDOWNS, { detail: { source: 'municipality' } }))
    }
    setIsOpen(newState)
  }, [isOpen])

  const handleSelect = useCallback((m: typeof municipalities[0]) => {
    setMunicipality(m)
    setIsOpen(false)
  }, [setMunicipality])

  const handleClear = useCallback(() => {
    setMunicipality(undefined)
    setBarangay(undefined)
    localStorage.removeItem('munlink:selectedMunicipality')
    localStorage.removeItem('munlink:selectedBarangay')
    setIsOpen(false)
  }, [setMunicipality, setBarangay])

  const filtered = useMemo(() =>
    municipalities.filter(m => m.name.toLowerCase().includes(query.toLowerCase())),
    [municipalities, query]
  )

  if (!selectedProvince) {
    return <span className="text-sm text-gray-400 font-serif cursor-not-allowed" title="Select a province first">Municipality ▾</span>
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="cursor-pointer select-none hover:text-ocean-700 font-serif whitespace-nowrap"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
          {selected ? selected.name : 'Municipality'} ▾
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-3 w-64 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 p-2 z-50">
          <input
            type="text"
            placeholder="Search municipality..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-field mb-2"
            autoFocus
          />
          {/* Clear selection option */}
          {selected && (
            <button
              onClick={handleClear}
              className="w-full text-left px-3 py-2 rounded hover:bg-red-50 text-red-600 text-sm mb-1 border-b"
            >
              ✕ Clear selection
            </button>
          )}
          <ul className="max-h-64 overflow-auto" role="listbox">
            {filtered.map(m => (
              <li key={m.id} role="option" aria-selected={selected?.id === m.id}>
                <button
                  onClick={() => handleSelect(m)}
                  className={`w-full text-left px-3 py-2 rounded hover:bg-ocean-50 ${
                    selected?.id === m.id ? 'bg-ocean-100 font-medium' : ''
                  }`}
                >
                  {m.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="text-sm text-gray-500 px-3 py-2">No results</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
