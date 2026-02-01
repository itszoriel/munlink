import { Link } from 'react-router-dom'
import { useRef, useState, useEffect, useCallback } from 'react'

// Custom event to close other location dropdowns (shared with ProvinceSelect/MunicipalitySelect)
const CLOSE_LOCATION_DROPDOWNS = 'munlink:closeLocationDropdowns'

export default function ServicesMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close this dropdown when another location dropdown opens
  useEffect(() => {
    const handleCloseOthers = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.source !== 'services') {
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
      window.dispatchEvent(new CustomEvent(CLOSE_LOCATION_DROPDOWNS, { detail: { source: 'services' } }))
    }
    setIsOpen(newState)
  }, [isOpen])

  const close = () => setIsOpen(false)

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="cursor-pointer select-none hover:text-ocean-700 font-serif px-2 py-1 rounded-lg hover:bg-ocean-50"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        Services ▾
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-3 w-56 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 p-2 z-50">
          <Link to="/documents" onClick={close} className="block px-3 py-2 rounded hover:bg-ocean-50">Documents</Link>
          <Link to="/problems" onClick={close} className="block px-3 py-2 rounded hover:bg-ocean-50">Problems</Link>
          <Link to="/programs" onClick={close} className="block px-3 py-2 rounded hover:bg-ocean-50">Programs</Link>
        </div>
      )}
    </div>
  )
}
