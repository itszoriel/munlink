import { useEffect, useRef, useState } from 'react'
import { useAdminStore } from '../lib/store'
import { userApi } from '../lib/api'

interface WatermarkedImageViewerProps {
  userId: number
  docType: 'id_front' | 'id_back' | 'selfie'
  reason: string
  municipalityName: string
  residentId: number
  onLoad?: () => void
  onError?: (error: string) => void
}

export function WatermarkedImageViewer({
  userId,
  docType,
  reason,
  municipalityName,
  residentId,
  onLoad,
  onError
}: WatermarkedImageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const user = useAdminStore((s) => s.user)

  useEffect(() => {
    // Don't wait for canvas - fetch can happen independently
    if (!user) {
      return
    }

    let blobUrl: string | null = null
    let mounted = true

    // Fetch image with audit logging
    const fetchAndWatermark = async () => {
      try {
        setLoading(true)
        setError(null)

        // Call secure endpoint
        const response = await userApi.getResidentDocument(userId, docType, reason)

        if (!mounted) return

        // Check if response is actually a blob with image data
        // If API returns an error, it might be JSON wrapped as a blob
        if (response.type && response.type.startsWith('application/json')) {
          const text = await response.text()
          let errorMsg = 'Failed to load image'
          try {
            const json = JSON.parse(text)
            errorMsg = json.error || json.message || errorMsg
          } catch {}
          setError(errorMsg)
          setLoading(false)
          onError?.(errorMsg)
          return
        }

        // Convert blob to data URL
        const blob = await response
        blobUrl = URL.createObjectURL(blob)

        // Add timeout in case image loading hangs
        let loadTimeout: number | null = null

        // Create image element
        const img = new Image()
        img.crossOrigin = 'anonymous'

        img.onload = () => {
          if (loadTimeout) clearTimeout(loadTimeout)

          if (!mounted) {
            // Clean up if component unmounted
            if (blobUrl) URL.revokeObjectURL(blobUrl)
            return
          }

          // Get canvas and context when we need to draw
          const canvas = canvasRef.current
          const ctx = canvas?.getContext('2d')

          if (!canvas || !ctx) {
            setError('Failed to initialize canvas')
            setLoading(false)
            onError?.('Failed to initialize canvas')
            return
          }

          // Set canvas size to match image
          canvas.width = img.width
          canvas.height = img.height

          // Draw original image
          ctx.drawImage(img, 0, 0)

          // Configure watermark
          const fontSize = Math.max(16, img.width / 40)
          ctx.font = `bold ${fontSize}px Arial`
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)'
          ctx.lineWidth = 3

          // Watermark text
          const timestamp = new Date().toLocaleString()
          const staffName = user.first_name && user.last_name
            ? `${user.first_name} ${user.last_name}`
            : user.email
          const topText = `VIEWED BY: ${staffName} | ${municipalityName}`
          const bottomText = `${timestamp} | Resident ID: ${residentId}`

          // Draw top watermark
          const topY = fontSize + 10
          ctx.strokeText(topText, 10, topY)
          ctx.fillText(topText, 10, topY)

          // Draw bottom watermark
          const bottomY = img.height - 10
          ctx.strokeText(bottomText, 10, bottomY)
          ctx.fillText(bottomText, 10, bottomY)

          // Draw diagonal watermark (center)
          ctx.save()
          ctx.translate(img.width / 2, img.height / 2)
          ctx.rotate(-Math.PI / 6)
          ctx.font = `bold ${fontSize * 1.5}px Arial`
          ctx.globalAlpha = 0.15
          const centerText = `CONFIDENTIAL - ${municipalityName.toUpperCase()}`
          const textWidth = ctx.measureText(centerText).width
          ctx.strokeText(centerText, -textWidth / 2, 0)
          ctx.fillText(centerText, -textWidth / 2, 0)
          ctx.restore()

          // Revoke blob URL after rendering
          if (blobUrl) URL.revokeObjectURL(blobUrl)

          setLoading(false)
          onLoad?.()
        }

        img.onerror = () => {
          if (loadTimeout) clearTimeout(loadTimeout)

          // Revoke blob URL on error
          if (blobUrl) URL.revokeObjectURL(blobUrl)

          const errMsg = 'Failed to load image'
          setError(errMsg)
          setLoading(false)
          onError?.(errMsg)
        }

        // Set timeout AFTER defining handlers
        loadTimeout = setTimeout(() => {
          if (blobUrl) URL.revokeObjectURL(blobUrl)
          const errMsg = 'Image loading timeout - file may be invalid or too large'
          setError(errMsg)
          setLoading(false)
          onError?.(errMsg)
        }, 15000) // 15 second timeout

        // Start loading image
        img.src = blobUrl

      } catch (err: any) {
        // When responseType is 'blob', error responses are also Blobs
        // We need to extract the JSON error message from the Blob
        let errMsg = 'Failed to fetch document'

        try {
          if (err.response?.data instanceof Blob) {
            const text = await err.response.data.text()
            try {
              const json = JSON.parse(text)
              errMsg = json.error || json.message || errMsg
            } catch {
              errMsg = text || errMsg
            }
          } else if (err.response?.data?.error) {
            errMsg = err.response.data.error
          } else if (err.response?.data?.message) {
            errMsg = err.response.data.message
          } else if (err.message) {
            errMsg = err.message
          }
        } catch {
          // Fallback to generic message
        }

        setError(errMsg)
        setLoading(false)
        onError?.(errMsg)
      }
    }

    fetchAndWatermark()

    // Cleanup on unmount
    return () => {
      mounted = false
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [userId, docType, reason, municipalityName, residentId, user, onLoad, onError, retryCount])

  return (
    <div className="relative">
      {/* Always render canvas so ref is available */}
      <canvas
        ref={canvasRef}
        className="w-full h-auto border rounded shadow-sm"
        style={{
          maxHeight: '500px',
          objectFit: 'contain',
          display: loading || error || !user ? 'none' : 'block'
        }}
      />

      {/* Loading overlay */}
      {!user && (
        <div className="flex items-center justify-center h-64 bg-yellow-50 rounded border border-yellow-200">
          <div className="text-yellow-700 text-sm">Waiting for authentication...</div>
        </div>
      )}

      {user && loading && (
        <div className="flex items-center justify-center h-64 bg-gray-100 rounded">
          <div className="text-gray-500">Loading image...</div>
        </div>
      )}

      {user && error && (
        <div className="flex flex-col items-center justify-center h-64 bg-red-50 rounded border border-red-200 p-4">
          <div className="text-red-600 text-sm text-center mb-3">{error}</div>
          <button
            onClick={() => {
              setError(null)
              setLoading(true)
              setRetryCount(prev => prev + 1)
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
