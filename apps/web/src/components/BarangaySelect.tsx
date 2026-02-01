import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { getBarangaysByMunicipalityId } from '@/lib/locations'

// Custom event to close other location dropdowns (same as Province/MunicipalitySelect)
const CLOSE_LOCATION_DROPDOWNS = 'munlink:closeLocationDropdowns'

export default function BarangaySelect() {
  const selected = useAppStore((s) => s.selectedBarangay)
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const setBarangay = useAppStore((s) => s.setBarangay)

  // Load barangays from static data based on selected municipality
  const barangays = useMemo(
    () => selectedMunicipality?.id ? getBarangaysByMunicipalityId(selectedMunicipality.id) : [],
    [selectedMunicipality?.id]
  )

  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('munlink:selectedBarangay')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Validate that parsed barangay matches current municipality
        if (parsed && typeof parsed === 'object' && parsed.municipality_id === selectedMunicipality?.id) {
          setBarangay(parsed)
        } else {
          // Stale data - clear it
          localStorage.removeItem('munlink:selectedBarangay')
        }
      } catch {}
    }
  }, [setBarangay, selectedMunicipality?.id])

  // Close this dropdown when another location dropdown opens
  useEffect(() => {
    const handleCloseOthers = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.source !== 'barangay') {
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
      window.dispatchEvent(new CustomEvent(CLOSE_LOCATION_DROPDOWNS, { detail: { source: 'barangay' } }))
    }
    setIsOpen(newState)
  }, [isOpen])

  const handleSelect = useCallback((b: typeof barangays[0]) => {
    setBarangay(b)
    setIsOpen(false)
  }, [setBarangay])

  const handleClear = useCallback(() => {
    setBarangay(undefined)
    localStorage.removeItem('munlink:selectedBarangay')
    setIsOpen(false)
  }, [setBarangay])

  const filtered = useMemo(() =>
    barangays.filter(b => b.name.toLowerCase().includes(query.toLowerCase())),
    [barangays, query]
  )

  if (!selectedMunicipality) {
    return <span className="text-sm text-gray-400 font-serif cursor-not-allowed" title="Select a municipality first">Barangay ▾</span>
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
          {selected ? selected.name : 'Barangay'} ▾
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-3 w-64 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 p-2 z-50">
          <input
            type="text"
            placeholder="Search barangay..."
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
            {filtered.map(b => (
              <li key={b.id} role="option" aria-selected={selected?.id === b.id}>
                <button
                  onClick={() => handleSelect(b)}
                  className={`w-full text-left px-3 py-2 rounded hover:bg-ocean-50 ${
                    selected?.id === b.id ? 'bg-ocean-100 font-medium' : ''
                  }`}
                >
                  {b.name}
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
