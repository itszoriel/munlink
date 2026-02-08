import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { mediaUrl } from '@/lib/api'
import SafeImage from '@/components/SafeImage'

type Props = {
  images?: string[]
  alt: string
  aspect?: string
  className?: string
  showThumbs?: boolean
}

export default function ImageGallery({ images = [], alt, aspect = 'aspect-[4/3]', className = '', showThumbs = true }: Props) {
  const list = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images])
  const [index, setIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const count = list.length
  const safeIndex = Math.min(Math.max(0, index), Math.max(0, count - 1))
  const current = list[safeIndex]
  const hasMany = count > 1
  const openLightbox = () => {
    if (!current) return
    setLightboxOpen(true)
  }

  useEffect(() => {
    setIndex(0)
  }, [list.join('|')])

  useEffect(() => {
    if (!lightboxOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxOpen(false)
        return
      }
      if (!hasMany) return
      if (event.key === 'ArrowLeft') {
        setIndex((i) => (i - 1 + count) % count)
      }
      if (event.key === 'ArrowRight') {
        setIndex((i) => (i + 1) % count)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [count, hasMany, lightboxOpen])

  return (
    <div className={`space-y-3 ${className}`}>
      <div className={`relative w-full ${aspect} bg-neutral-100 rounded-xl overflow-hidden`}>
        {current ? (
          <SafeImage
            src={mediaUrl(current)}
            alt={alt}
            className="w-full h-full cursor-zoom-in"
            fallbackIcon="image"
            onClick={openLightbox}
          />
        ) : (
          <div className="w-full h-full" />
        )}
        {hasMany && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-2 shadow-lg border bg-white/90 hover:bg-white"
              onClick={(event) => {
                event.stopPropagation()
                setIndex((i) => (i - 1 + count) % count)
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 shadow-lg border bg-white/90 hover:bg-white"
              onClick={(event) => {
                event.stopPropagation()
                setIndex((i) => (i + 1) % count)
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
        {count > 0 && (
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-black/60 text-white text-xs">
            {safeIndex + 1} / {count}
          </div>
        )}
        {current && (
          <button
            type="button"
            aria-label="Open full size"
            className="absolute top-2 right-2 rounded-full p-2 shadow border bg-white/90 hover:bg-white"
            onClick={(event) => {
              event.stopPropagation()
              openLightbox()
            }}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {showThumbs && hasMany && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {list.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              className={`relative h-16 w-20 rounded-lg border overflow-hidden ${i === safeIndex ? 'ring-2 ring-ocean-500' : 'ring-1 ring-neutral-200'}`}
              onClick={() => setIndex(i)}
            >
              <SafeImage src={mediaUrl(img)} alt={`${alt} thumbnail ${i + 1}`} className="w-full h-full" fallbackIcon="image" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && current && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative w-full max-w-6xl h-[calc(100vh-2rem)] max-h-[90vh] bg-black/40 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={mediaUrl(current)} alt={alt} className="w-full h-full object-contain" />
            {hasMany && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow"
                  onClick={() => setIndex((i) => (i - 1 + count) % count)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow"
                  onClick={() => setIndex((i) => (i + 1) % count)}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-black/60 text-white text-xs">
              {safeIndex + 1} / {count}
            </div>
            <button
              type="button"
              aria-label="Close"
              className="absolute top-3 right-3 bg-white/90 hover:bg-white rounded-full p-2 shadow"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
