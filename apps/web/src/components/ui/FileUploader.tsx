import { useRef, useState } from 'react'

type Props = {
  accept?: string
  multiple?: boolean
  maxSizeMb?: number
  onFiles: (files: File[]) => void
  label?: string
}

// Helper to validate file type against accept string
function isValidFileType(file: File, accept: string): boolean {
  if (!accept || accept === '*') return true
  
  const acceptTypes = accept.split(',').map(t => t.trim().toLowerCase())
  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()
  
  for (const acceptType of acceptTypes) {
    // Handle extension patterns like .pdf, .jpg
    if (acceptType.startsWith('.')) {
      if (fileName.endsWith(acceptType)) return true
    }
    // Handle MIME type patterns like image/*, application/pdf
    else if (acceptType.includes('/')) {
      if (acceptType.endsWith('/*')) {
        // Wildcard MIME type (e.g., image/*)
        const baseType = acceptType.replace('/*', '')
        if (fileType.startsWith(baseType + '/')) return true
      } else {
        // Exact MIME type match
        if (fileType === acceptType) return true
      }
    }
  }
  return false
}

export default function FileUploader({ accept = 'image/*,.pdf', multiple = true, maxSizeMb = 10, onFiles, label = 'Upload files' }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string>('')

  const handle = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    
    // Validate file types
    const invalidType = arr.find(f => !isValidFileType(f, accept))
    if (invalidType) {
      setError(`File "${invalidType.name}" is not an allowed file type. Allowed: ${accept}`)
      return
    }
    
    // Validate file size
    const tooBig = arr.find(f => f.size > maxSizeMb * 1024 * 1024)
    if (tooBig) { setError(`File "${tooBig.name}" exceeds ${maxSizeMb}MB limit`); return }
    
    setError('')
    onFiles(arr)
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => ref.current?.click()}>{label}</button>
        <input ref={ref} type="file" className="hidden" accept={accept} multiple={multiple} onChange={(e) => handle(e.target.files)} />
      </div>
      {error && <div className="mt-2 text-sm text-rose-600">{error}</div>}
    </div>
  )
}


