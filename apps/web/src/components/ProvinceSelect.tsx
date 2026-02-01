import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { getProvinces } from '@/lib/locations'

// Province seal mapping (use absolute paths from public folder)
const provinceSealMap: Record<string, string> = {
  'aurora': '/logos/provinces/aurora.png',
  'bataan': '/logos/provinces/bataan.png',
  'bulacan': '/logos/provinces/bulacan.png',
  'nueva-ecija': '/logos/provinces/nueva-ecija.png',
  'pampanga': '/logos/provinces/pampanga.png',
  'tarlac': '/logos/provinces/tarlac.png',
  'zambales': '/logos/provinces/zambales.png',
}

function getProvinceSeal(slug?: string): string | undefined {
  if (!slug) return undefined
  return provinceSealMap[slug.toLowerCase()]
}

// Custom event to close other location dropdowns
const CLOSE_LOCATION_DROPDOWNS = 'munlink:closeLocationDropdowns'

export default function ProvinceSelect() {
  const selected = useAppStore((s) => s.selectedProvince)
  const setProvince = useAppStore((s) => s.setProvince)
  const setMunicipality = useAppStore((s) => s.setMunicipality)
  // Use static data - no API call needed, instant load
  const provinces = useMemo(() => getProvinces(), [])
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('munlink:selectedProvince')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Guard against older/invalid stored values (e.g. {slug:"zambales"} or plain strings)
        if (parsed && typeof parsed === 'object' && typeof parsed.id === 'number' && typeof parsed.name === 'string') {
          setProvince(parsed)
        } else {
          localStorage.removeItem('munlink:selectedProvince')
        }
      } catch {}
    }
  }, [setProvince])

  // Close this dropdown when another location dropdown opens
  useEffect(() => {
    const handleCloseOthers = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.source !== 'province') {
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
      window.dispatchEvent(new CustomEvent(CLOSE_LOCATION_DROPDOWNS, { detail: { source: 'province' } }))
    }
    setIsOpen(newState)
  }, [isOpen])

  const handleSelect = useCallback((p: typeof provinces[0]) => {
    setProvince(p)
    setMunicipality(undefined) // Clear municipality when province changes
    localStorage.removeItem('munlink:selectedMunicipality')
    setIsOpen(false)
  }, [setProvince, setMunicipality])

  const handleClear = useCallback(() => {
    setProvince(undefined)
    setMunicipality(undefined)
    localStorage.removeItem('munlink:selectedProvince')
    localStorage.removeItem('munlink:selectedMunicipality')
    setIsOpen(false)
  }, [setProvince, setMunicipality])

  const filtered = useMemo(() =>
    provinces.filter(p => p.name.toLowerCase().includes(query.toLowerCase())),
    [provinces, query]
  )

  const selectedSeal = getProvinceSeal(selected?.slug)

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="cursor-pointer select-none hover:text-ocean-700 font-serif flex items-center gap-2"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
          {selectedSeal && (
            <img src={selectedSeal} alt="" className="h-5 w-5 rounded-full object-contain" />
          )}
          {selected ? selected.name : 'Province'} ▾
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-3 w-72 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 p-2 z-50">
          <input
            type="text"
            placeholder="Search province..."
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
            {filtered.map(p => {
              const seal = getProvinceSeal(p.slug)
              return (
                <li key={p.id} role="option" aria-selected={selected?.id === p.id}>
                  <button
                    onClick={() => handleSelect(p)}
                    className={`w-full text-left px-3 py-2 rounded hover:bg-ocean-50 flex items-center gap-3 ${
                      selected?.id === p.id ? 'bg-ocean-100 font-medium' : ''
                    }`}
                  >
                    {seal && (
                      <img src={seal} alt="" className="h-6 w-6 rounded-full object-contain flex-shrink-0" />
                    )}
                    <span>{p.name}</span>
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li className="text-sm text-gray-500 px-3 py-2">No results</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
