/**
 * MunLink Zambales - Announcement Manager Component
 * Component for managing municipality announcements
 */
import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { announcementApi, handleApiError, mediaUrl } from '../lib/api'
import { useCachedFetch } from '../lib/useCachedFetch'
import { CACHE_KEYS } from '../lib/dataStore'
import { EmptyState } from '@munlink/ui'
import SafeImage from './SafeImage'
import { useAdminStore } from '../lib/store'
import { MUNICIPALITIES, getBarangaysByMunicipalityId } from '../lib/locations'

interface Announcement {
  id: number
  title: string
  content: string
  priority: 'high' | 'medium' | 'low'
  is_active: boolean
  created_at: string
  updated_at: string
  municipality_name?: string
  municipality_id?: number
  barangay_id?: number
  barangay_name?: string
  scope?: 'PROVINCE' | 'MUNICIPALITY' | 'BARANGAY'
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  pinned?: boolean
  pinned_until?: string
  publish_at?: string
  expire_at?: string
  creator_name?: string
  images?: string[]
  shared_with_municipalities?: number[]
  public_viewable?: boolean
}

interface AnnouncementManagerProps {
  onAnnouncementUpdated?: (announcementId: number) => void
}

export default function AnnouncementManager({ onAnnouncementUpdated }: AnnouncementManagerProps) {
  const [error, setError] = useState<string | null>(null)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [fabExpanded, setFabExpanded] = useState(false)
  const user = useAdminStore((s) => s.user)
  const staffRole = (user?.role || '').toLowerCase()
  const staffMunicipalityId = user?.admin_municipality_id
  const staffBarangayId = (user as any)?.barangay_id as number | undefined
  const allowedScopes = useMemo(() => {
    if (staffRole === 'barangay_admin') return ['BARANGAY'] as const
    if (staffRole === 'municipal_admin') return ['MUNICIPALITY'] as const
    return ['PROVINCE', 'MUNICIPALITY', 'BARANGAY'] as const
  }, [staffRole])
  const defaultScope = allowedScopes[0] || 'MUNICIPALITY'

  // Use cached fetch for announcements
  const { data: announcementsData, loading: announcementsLoading, update: updateCache, refetch } = useCachedFetch(
    CACHE_KEYS.ANNOUNCEMENTS,
    async () => {
      try {
        const response = await announcementApi.getAnnouncements()
        return (response as any).announcements || []
      } catch (err: any) {
        // Handle 422 errors gracefully - return empty array
        if (err.response?.status === 422) {
          return []
        }
        throw err
      }
    },
    { staleTime: 2 * 60 * 1000 }
  )
  
  const announcements = (announcementsData || []) as Announcement[]
  const loading = announcementsLoading && announcements.length === 0
  
  const removeAnnouncementFromCache = (id: number) => {
    updateCache((prev: Announcement[]) => 
      (prev || []).filter((a: Announcement) => a.id !== id)
    )
  }
  
  const addAnnouncementToCache = (announcement: Announcement) => {
    updateCache((prev: Announcement[]) => 
      [announcement, ...(prev || [])]
    )
  }

  // Handle announcement update
  const handleUpdateAnnouncement = async (id: number, data: any) => {
    try {
      setActionLoading(id)
      await announcementApi.updateAnnouncement(id, data)
      // Refresh from server to avoid stale image state
      await refetch()

      onAnnouncementUpdated?.(id)
      
      // Close modal if this was the selected announcement
      if (selectedAnnouncement?.id === id) {
        setShowModal(false)
        setSelectedAnnouncement(null)
      }
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  // Handle announcement deletion
  const handleDeleteAnnouncement = async (id: number) => {
    try {
      setActionLoading(id)
      await announcementApi.deleteAnnouncement(id)
      
      // Remove announcement from cache
      removeAnnouncementFromCache(id)
      onAnnouncementUpdated?.(id)
      
      // Close modal
      setShowModal(false)
      setSelectedAnnouncement(null)
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  // Handle announcement creation
  const handleCreateAnnouncement = async (data: any, files?: File[]) => {
    try {
      setActionLoading(-1) // Use -1 for create action
      const response = await announcementApi.createAnnouncement(data)
      const created = (response as any).announcement || (response as any).data?.announcement
      const id = created?.id
      if (id && files && files.length) {
        try {
          await announcementApi.uploadImages(id, files.slice(0, 5))
        } catch {}
        // Refresh to get uploaded images
        await refetch()
      } else if (created) {
        // If no files, just add to cache directly
        addAnnouncementToCache(created)
      }
      
      if (created) {
        onAnnouncementUpdated?.(created.id)
      }
      
      // Close modal
      setShowCreateModal(false)
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  // Open announcement detail modal
  const openAnnouncementModal = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement)
    setShowModal(true)
  }

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isPinnedActive = (announcement: Announcement) => {
    if (!announcement.pinned) return false
    if (announcement.pinned_until) {
      return new Date(announcement.pinned_until).getTime() > Date.now()
    }
    return true
  }

  const scopeBadgeLabel = (announcement: Announcement) => {
    const scope = (announcement.scope || 'MUNICIPALITY').toUpperCase()
    if (scope === 'PROVINCE') return 'Province-wide'
    if (scope === 'BARANGAY') return announcement.barangay_name || 'Barangay'
    return announcement.municipality_name || 'Municipality'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zambales-green"></div>
        <span className="ml-2 text-gray-600">Loading announcements...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-400 mr-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-800">Error loading announcements</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Announcements</h3>
        {announcements.length > 0 && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-zambales-green hover:bg-green-700 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Announcement
          </button>
        )}
      </div>

      {/* Announcements List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {announcements.map((announcement) => (
          <div key={announcement.id} className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg transition-shadow">
            {/* Image banner with fixed aspect to avoid stretching on wide screens */}
            {Array.isArray(announcement.images) && announcement.images.length > 0 ? (
              <div className="aspect-[16/9] bg-neutral-100">
                <SafeImage src={mediaUrl(announcement.images[0])} alt="Announcement" className="w-full h-full object-cover" fallbackIcon="image" />
              </div>
            ) : (
              <div className="aspect-[16/9] bg-neutral-100" />
            )}
            <div className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">{scopeBadgeLabel(announcement)}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(announcement.priority)}`}>{announcement.priority.toUpperCase()}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    (announcement.status || '').toUpperCase() === 'PUBLISHED' ? 'bg-green-100 text-green-800'
                      : (announcement.status || '').toUpperCase() === 'ARCHIVED' ? 'bg-gray-100 text-gray-700'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>{(announcement.status || (announcement.is_active ? 'PUBLISHED' : 'DRAFT')).toUpperCase()}</span>
                  {isPinnedActive(announcement) && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-ocean-100 text-ocean-800">PINNED</span>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:self-start">
                  <button onClick={() => openAnnouncementModal(announcement)} className="px-3 py-1 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">Edit</button>
                  <button
                    onClick={() => {
                      const isActive = announcement.is_active
                      const nextStatus = isActive ? 'ARCHIVED' : 'PUBLISHED'
                      handleUpdateAnnouncement(announcement.id, { status: nextStatus })
                    }}
                    disabled={actionLoading === announcement.id}
                    className={`px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-colors disabled:opacity-50 ${announcement.is_active ? 'text-orange-700 bg-orange-100 hover:bg-orange-200' : 'text-green-700 bg-green-100 hover:bg-green-200'}`}
                  >
                    {actionLoading === announcement.id ? 'Updating…' : (announcement.is_active ? 'Archive' : 'Publish')}
                  </button>
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 line-clamp-2">{announcement.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-3">{announcement.content}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                {announcement.municipality_name && (<span className="truncate">{announcement.municipality_name}</span>)}
                {announcement.creator_name && (<span className="truncate">By: {announcement.creator_name}</span>)}
                <span className="hidden sm:inline">•</span>
                <span>{new Date(announcement.publish_at || announcement.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {announcements.length === 0 && (
        <EmptyState
          icon="announcement"
          title="No announcements yet"
          description="Create your first announcement to keep residents informed."
          action={
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-zambales-green hover:bg-green-700 rounded-md transition-colors"
            >
              Create Announcement
            </button>
          }
        />
      )}

      {/* Announcement Detail/Edit Modal */}
      {showModal && selectedAnnouncement && (
        <AnnouncementDetailModal
          announcement={selectedAnnouncement}
          onClose={() => {
            setShowModal(false)
            setSelectedAnnouncement(null)
          }}
          onUpdate={handleUpdateAnnouncement}
          onDelete={handleDeleteAnnouncement}
          loading={actionLoading === selectedAnnouncement.id}
          allowedScopes={allowedScopes}
          staffMunicipalityId={staffMunicipalityId}
          staffBarangayId={staffBarangayId}
        />
      )}

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <CreateAnnouncementModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateAnnouncement}
          loading={actionLoading === -1}
          allowedScopes={allowedScopes}
          defaultScope={defaultScope}
          staffMunicipalityId={staffMunicipalityId}
          staffBarangayId={staffBarangayId}
        />
      )}

      {/* Floating Action Button - positioned above mobile nav, MOBILE ONLY */}
      {/* HIDDEN when any modal is open (showCreateModal, showModal) or no announcements */}
      {/* Using Portal to render outside parent container */}
      {createPortal(
        <>
          <AnimatePresence>
            {!showCreateModal && !showModal && announcements.length > 0 && (
              <motion.div
                className="fixed bottom-20 right-4 z-[9999] sm:hidden"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <motion.button
                  className="relative flex items-center justify-center bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-600/30 hover:shadow-green-600/50 transition-shadow"
                  onClick={() => {
                    if (fabExpanded) {
                      setShowCreateModal(true)
                      setFabExpanded(false)
                    } else {
                      setFabExpanded(true)
                    }
                  }}
                  animate={{
                    width: fabExpanded ? 180 : 56,
                    height: 56,
                    borderRadius: 28,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <AnimatePresence mode="wait">
                    {fabExpanded ? (
                      <motion.div
                        key="expanded"
                        className="flex items-center gap-2 px-4"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Plus className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium whitespace-nowrap">New Announcement</span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="collapsed"
                        initial={{ opacity: 0, rotate: -90 }}
                        animate={{ opacity: 1, rotate: 0 }}
                        exit={{ opacity: 0, rotate: 90 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Plus className="w-6 h-6" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Backdrop to close FAB when clicking outside - MOBILE ONLY */}
          <AnimatePresence>
            {fabExpanded && !showCreateModal && announcements.length > 0 && (
              <motion.div
                className="fixed inset-0 z-[9998] sm:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setFabExpanded(false)}
              />
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </>
  )
}

// Announcement Detail Modal Component
interface AnnouncementDetailModalProps {
  announcement: Announcement
  onClose: () => void
  onUpdate: (id: number, data: any) => Promise<void>
  onDelete: (id: number) => Promise<void>
  loading: boolean
  allowedScopes: readonly string[]
  staffMunicipalityId?: number
  staffBarangayId?: number
}

function AnnouncementDetailModal({ 
  announcement, 
  onClose, 
  onUpdate, 
  onDelete, 
  loading,
  allowedScopes,
  staffMunicipalityId,
  staffBarangayId,
}: AnnouncementDetailModalProps) {
  const [editMode, setEditMode] = useState(true)
  const toInputValue = (value?: string) => value ? value.slice(0, 16) : ''
  const [formData, setFormData] = useState({
    title: announcement.title,
    content: announcement.content,
    priority: announcement.priority,
    external_url: (announcement as any).external_url || '',
    scope: (announcement.scope as any) || 'MUNICIPALITY',
    municipality_id: announcement.municipality_id || staffMunicipalityId,
    barangay_id: announcement.barangay_id || staffBarangayId,
    status: (announcement.status as any) || (announcement.is_active ? 'PUBLISHED' : 'DRAFT'),
    publish_at: toInputValue(announcement.publish_at),
    expire_at: toInputValue(announcement.expire_at),
    pinned: !!announcement.pinned,
    pinned_until: toInputValue(announcement.pinned_until),
    shared_with_municipalities: announcement.shared_with_municipalities || [],
    public_viewable: !!announcement.public_viewable,
  })
  const selectedMunicipalityId = formData.scope === 'PROVINCE' ? undefined : (formData.municipality_id || staffMunicipalityId)
  const barangayOptions = selectedMunicipalityId ? getBarangaysByMunicipalityId(selectedMunicipalityId) : []
  const municipalityLocked = allowedScopes.length === 1 && allowedScopes[0] !== 'PROVINCE'
  const [uploading, setUploading] = useState(false)
  const [images, setImages] = useState<string[]>(announcement.images || [])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const hasImageChanges = JSON.stringify(images) !== JSON.stringify(announcement.images || [])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Clamp index when images array changes
  useEffect(() => {
    setCurrentImageIndex((idx) => {
      if (images.length === 0) return 0
      return Math.min(Math.max(0, idx), images.length - 1)
    })
  }, [images.length])

  const handleSave = async () => {
    // Upload any staged files first (respecting 5 images max), then persist fields and order
    let current = images.slice(0, 5)
    if (pendingFiles.length > 0) {
      try {
        setUploading(true)
        const space = Math.max(0, 5 - current.length)
        const filesToUpload = pendingFiles.slice(0, space)
        if (filesToUpload.length) {
          try {
            const res = await announcementApi.uploadImages(announcement.id, filesToUpload as any)
            // Prefer explicit returned paths to preserve local removals and ordering
            const returnedPaths: string[] = (res as any)?.paths || []
            if (returnedPaths?.length) {
              const existingSet = new Set(current)
              for (const p of returnedPaths) {
                if (existingSet.has(p)) continue
                current.push(p)
                existingSet.add(p)
                if (current.length >= 5) break
              }
            } else {
              // Fallback: merge using server announcement images if paths missing
              const updated = (res as any)?.announcement?.images || (res as any)?.images || null
              if (Array.isArray(updated)) {
                const set = new Set(current)
                for (const p of updated) {
                  if (!set.has(p)) current.push(p)
                  if (current.length >= 5) break
                }
              }
            }
          } catch {
            alert('Failed to upload images. Please try again.')
          }
        }
        setImages(current)
        setPendingFiles([])
      } finally {
        setUploading(false)
      }
    }
    // Persist fields and final image order (including removals/reorders)
    const payload: any = {
      ...formData,
      images: current,
    }
    if (payload.scope === 'PROVINCE') {
      payload.municipality_id = undefined
      payload.barangay_id = undefined
    } else if (payload.scope === 'MUNICIPALITY') {
      payload.barangay_id = undefined
    }
    if (!payload.publish_at) delete payload.publish_at
    if (!payload.expire_at) delete payload.expire_at
    if (!payload.pinned_until) delete payload.pinned_until
    try {
      setSaving(true)
      await onUpdate(announcement.id, payload)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return
    try {
      setDeleting(true)
      await onDelete(announcement.id)
    } finally {
      setDeleting(false)
    }
  }

  return createPortal(
    (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[1000]" role="dialog" aria-modal="true">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto pb-24 sm:pb-0" tabIndex={-1} autoFocus>
          <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Edit Announcement</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Images */}
            <div>
              <label htmlFor="ann-images" className="block text-sm font-medium text-gray-700 mb-1">Images</label>
              {images.length > 0 && (
                <div className="relative w-full aspect-[16/9] bg-neutral-100 rounded mb-2 overflow-hidden">
                        <img src={mediaUrl(images[currentImageIndex]) || undefined} alt="Preview" className="w-full h-full object-contain" />
                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Prev"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 z-10"
                        onClick={() => setCurrentImageIndex((i) => (i - 1 + images.length) % images.length)}
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        aria-label="Next"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 z-10"
                        onClick={() => setCurrentImageIndex((i) => (i + 1) % images.length)}
                      >
                        ▶
                      </button>
                    </>
                  )}
                </div>
              )}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {images.map((img, idx) => (
                    <div key={`${img}-${idx}`} className="relative group">
                      <img src={mediaUrl(img) || undefined} alt="Image" className="w-full h-20 object-cover rounded border" />
                      <button
                        type="button"
                        aria-label="Remove image"
                        className="absolute -top-1 -right-1 bg-white border rounded-full p-1 shadow hidden group-hover:block"
                        onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      {/* Reorder arrows removed per request */}
                    </div>
                  ))}
                </div>
              )}
              <input id="ann-images" name="announcement_images" type="file" accept="image/*" multiple onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (files.length === 0) return
                const space = Math.max(0, 5 - images.length)
                setPendingFiles((prev) => [...prev, ...files].slice(0, space))
                try { (e.target as HTMLInputElement).value = '' } catch {}
              }} disabled={uploading || images.length >= 5} />
              {pendingFiles.length > 0 && (
                <div className="mt-2">
                  <div className="grid grid-cols-3 gap-2 mb-1">
                    {pendingFiles.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="relative">
                        <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-20 object-cover rounded border" />
                        <button type="button" className="absolute -top-2 -right-2 bg-white border rounded-full p-1 text-xs" aria-label="Remove pending image" onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">These will upload on Save. Max 5 images total.</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              {editMode ? (
                <input
                  name="announcement_title"
                  id="announcement-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                />
              ) : (
                <p className="text-gray-900">{announcement.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              {editMode ? (
                <textarea
                  name="announcement_content"
                  id="announcement-content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                />
              ) : (
                <p className="text-gray-900 whitespace-pre-wrap">{announcement.content}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                <select
                  value={formData.scope}
                  onChange={(e) => {
                    const next = e.target.value as 'PROVINCE' | 'MUNICIPALITY' | 'BARANGAY'
                    setFormData(prev => ({
                      ...prev,
                      scope: next,
                      municipality_id: next === 'PROVINCE' ? undefined : (prev.municipality_id || staffMunicipalityId),
                      barangay_id: next === 'BARANGAY' ? (prev.barangay_id || staffBarangayId) : undefined,
                      public_viewable: next === 'BARANGAY' ? false : prev.public_viewable,
                    }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                >
                  {(['PROVINCE', 'MUNICIPALITY', 'BARANGAY'] as const).map((s) => (
                    <option key={s} value={s} disabled={!allowedScopes.includes(s)}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              {formData.scope !== 'PROVINCE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Municipality</label>
                  <select
                    value={selectedMunicipalityId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, municipality_id: Number(e.target.value) || undefined }))}
                    disabled={municipalityLocked}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                  >
                    <option value="">Select municipality</option>
                    {MUNICIPALITIES.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {formData.scope === 'BARANGAY' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barangay</label>
                  <select
                    value={formData.barangay_id || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, barangay_id: Number(e.target.value) || undefined }))}
                    disabled={allowedScopes.length === 1 && allowedScopes[0] === 'BARANGAY' && !!staffBarangayId}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                  >
                    <option value="">Select barangay</option>
                    {barangayOptions.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Share with other municipalities */}
            {(formData.scope === 'MUNICIPALITY' || formData.scope === 'BARANGAY') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Share with other municipalities (optional)</label>
                <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                  {MUNICIPALITIES.filter(m => m.id !== selectedMunicipalityId).map((municipality) => (
                    <label key={municipality.id} className="flex items-center space-x-2 py-1 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.shared_with_municipalities.includes(municipality.id)}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setFormData(prev => ({
                            ...prev,
                            shared_with_municipalities: checked
                              ? [...prev.shared_with_municipalities, municipality.id]
                              : prev.shared_with_municipalities.filter(id => id !== municipality.id)
                          }))
                        }}
                        className="h-4 w-4 text-zambales-green border-gray-300 rounded focus:ring-zambales-green"
                      />
                      <span className="text-sm text-gray-700">{municipality.name}</span>
                    </label>
                  ))}
                </div>
                {formData.shared_with_municipalities.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Sharing with {formData.shared_with_municipalities.length} other {formData.shared_with_municipalities.length === 1 ? 'municipality' : 'municipalities'}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                {editMode ? (
                  <select
                    name="announcement_priority"
                    id="announcement-priority"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                ) : (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(announcement.priority)}`}>
                    {announcement.priority.toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                {editMode ? (
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                  >
                    <option value="PUBLISHED">Published</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                ) : (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">{(announcement.status || 'DRAFT').toUpperCase()}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Publish at</label>
                <input
                  type="datetime-local"
                  value={formData.publish_at || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, publish_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expire at (optional)</label>
                <input
                  type="datetime-local"
                  value={formData.expire_at || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, expire_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                />
              </div>
              <div className="flex items-start gap-2">
                <input
                  id="announcement-public"
                  type="checkbox"
                  checked={formData.public_viewable}
                  disabled={formData.scope === 'BARANGAY'}
                  onChange={(e) => setFormData(prev => ({ ...prev, public_viewable: e.target.checked }))}
                  className="h-4 w-4 mt-1 rounded border-gray-300 text-zambales-green focus:ring-zambales-green disabled:opacity-50"
                />
                <label htmlFor="announcement-public" className="text-sm text-gray-700">
                  Public on web (guest-visible). Barangay posts remain resident-only.
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="announcement-pin"
                  type="checkbox"
                  checked={formData.pinned}
                  onChange={(e) => setFormData(prev => ({ ...prev, pinned: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-zambales-green focus:ring-zambales-green"
                />
                <label htmlFor="announcement-pin" className="text-sm text-gray-700">Pin announcement</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pinned until (optional)</label>
                <input
                  type="datetime-local"
                  value={formData.pinned_until || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, pinned_until: e.target.value }))}
                  disabled={!formData.pinned}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green disabled:bg-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">More details link (optional)</label>
              {editMode ? (
                <input
                  type="url"
                  inputMode="url"
                  placeholder="https://domain.com/..."
                    value={formData.external_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, external_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                  />
                ) : (
                  (formData.external_url ? (
                    <a href={formData.external_url} target="_blank" rel="noopener noreferrer" className="text-ocean-700 hover:underline break-all">Open link</a>
                  ) : (
                    <span className="text-gray-500">No link</span>
                  ))
                )}
            </div>

            <div className="text-sm text-gray-500">
              <p>Created: {new Date(announcement.created_at).toLocaleString()}</p>
              <p>Updated: {new Date(announcement.updated_at).toLocaleString()}</p>
            </div>
          </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t mt-6">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>

              <div className="flex items-center space-x-3">
                {(editMode || hasImageChanges || pendingFiles.length > 0) && (
                  <>
                    {editMode && (
                      <button
                        onClick={() => setEditMode(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saving || uploading || (editMode && (!formData.title.trim() || !formData.content.trim()))}
                      className="px-4 py-2 text-sm font-medium text-white bg-zambales-green hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                    >
                      {(saving || uploading) ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    document.body
  )
}

// Create Announcement Modal Component
interface CreateAnnouncementModalProps {
  onClose: () => void
  onCreate: (data: any, files?: File[]) => void
  loading: boolean
  allowedScopes: readonly string[]
  defaultScope: string
  staffMunicipalityId?: number
  staffBarangayId?: number
}

function CreateAnnouncementModal({ onClose, onCreate, loading, allowedScopes, defaultScope, staffMunicipalityId, staffBarangayId }: CreateAnnouncementModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    external_url: '',
    scope: (defaultScope as any) || 'MUNICIPALITY',
    municipality_id: defaultScope === 'MUNICIPALITY' ? staffMunicipalityId : undefined,
    barangay_id: defaultScope === 'BARANGAY' ? staffBarangayId : undefined,
    status: 'PUBLISHED' as 'PUBLISHED' | 'DRAFT' | 'ARCHIVED',
    publish_at: '',
    expire_at: '',
    pinned: false,
    pinned_until: '',
    shared_with_municipalities: [] as number[],
    public_viewable: false,
  })
  const selectedMunicipalityId = formData.scope === 'PROVINCE' ? undefined : (formData.municipality_id || staffMunicipalityId)
  const barangayOptions = selectedMunicipalityId ? getBarangaysByMunicipalityId(selectedMunicipalityId) : []
  const municipalityLocked = allowedScopes.length === 1 && allowedScopes[0] !== 'PROVINCE'
  const [files, setFiles] = useState<File[]>([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.title.trim() && formData.content.trim()) {
      const payload: any = { ...formData }
      if (payload.scope === 'PROVINCE') {
        payload.municipality_id = undefined
        payload.barangay_id = undefined
      } else if (payload.scope === 'MUNICIPALITY') {
        payload.barangay_id = undefined
      }
      if (!payload.publish_at) delete payload.publish_at
      if (!payload.expire_at) delete payload.expire_at
      if (!payload.pinned_until) delete payload.pinned_until
      onCreate(payload, files)
    }
  }

  return createPortal(
    (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[1000]" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto pb-24 sm:pb-0" tabIndex={-1} autoFocus>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Create Announcement</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                name="create_announcement_title"
                id="create-announcement-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                placeholder="Enter announcement title"
                required
              />
            </div>

            <div>
              <label htmlFor="create-ann-images" className="block text-sm font-medium text-gray-700 mb-1">Images (optional, up to 5)</label>
              <input
                id="create-ann-images"
                name="create_announcement_images"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const incoming = Array.from(e.target.files || [])
                  setFiles((prev) => {
                    const next = [...prev, ...incoming]
                    return next.slice(0, 5)
                  })
                  try { (e.target as HTMLInputElement).value = '' } catch {}
                }}
                className="w-full"
              />
              {files.length > 0 && (
                <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="relative">
                      <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-20 object-cover rounded border" />
                      <button type="button" className="absolute -top-2 -right-2 bg-white border rounded-full p-1 text-xs" aria-label="Remove image" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
              <textarea
                name="create_announcement_content"
                id="create-announcement-content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                placeholder="Enter announcement content"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                <select
                  value={formData.scope}
                  onChange={(e) => {
                    const next = e.target.value as 'PROVINCE' | 'MUNICIPALITY' | 'BARANGAY'
                    setFormData(prev => ({
                      ...prev,
                      scope: next,
                      municipality_id: next === 'PROVINCE' ? undefined : (prev.municipality_id || staffMunicipalityId),
                      barangay_id: next === 'BARANGAY' ? (prev.barangay_id || staffBarangayId) : undefined,
                      public_viewable: next === 'BARANGAY' ? false : prev.public_viewable,
                    }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                >
                  {(['PROVINCE', 'MUNICIPALITY', 'BARANGAY'] as const).map((s) => (
                    <option key={s} value={s} disabled={!allowedScopes.includes(s)}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              {formData.scope !== 'PROVINCE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Municipality</label>
                  <select
                    value={selectedMunicipalityId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, municipality_id: Number(e.target.value) || undefined }))}
                    disabled={municipalityLocked}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                  >
                    <option value="">Select municipality</option>
                    {MUNICIPALITIES.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {formData.scope === 'BARANGAY' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barangay</label>
                  <select
                    value={formData.barangay_id || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, barangay_id: Number(e.target.value) || undefined }))}
                    disabled={allowedScopes.length === 1 && allowedScopes[0] === 'BARANGAY' && !!staffBarangayId}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                  >
                    <option value="">Select barangay</option>
                    {barangayOptions.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Share with other municipalities */}
            {(formData.scope === 'MUNICIPALITY' || formData.scope === 'BARANGAY') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Share with other municipalities (optional)</label>
                <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                  {MUNICIPALITIES.filter(m => m.id !== selectedMunicipalityId).map((municipality) => (
                    <label key={municipality.id} className="flex items-center space-x-2 py-1 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.shared_with_municipalities.includes(municipality.id)}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setFormData(prev => ({
                            ...prev,
                            shared_with_municipalities: checked
                              ? [...prev.shared_with_municipalities, municipality.id]
                              : prev.shared_with_municipalities.filter(id => id !== municipality.id)
                          }))
                        }}
                        className="h-4 w-4 text-zambales-green border-gray-300 rounded focus:ring-zambales-green"
                      />
                      <span className="text-sm text-gray-700">{municipality.name}</span>
                    </label>
                  ))}
                </div>
                {formData.shared_with_municipalities.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Sharing with {formData.shared_with_municipalities.length} other {formData.shared_with_municipalities.length === 1 ? 'municipality' : 'municipalities'}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  name="create_announcement_priority"
                  id="create-announcement-priority"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                >
                  <option value="PUBLISHED">Published</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Publish at (optional)</label>
                <input
                  type="datetime-local"
                  value={formData.publish_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, publish_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expire at (optional)</label>
                <input
                  type="datetime-local"
                  value={formData.expire_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, expire_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
                />
              </div>
              <div className="flex items-start gap-2">
                <input
                  id="create-announcement-public"
                  type="checkbox"
                  checked={formData.public_viewable}
                  disabled={formData.scope === 'BARANGAY'}
                  onChange={(e) => setFormData(prev => ({ ...prev, public_viewable: e.target.checked }))}
                  className="h-4 w-4 mt-1 rounded border-gray-300 text-zambales-green focus:ring-zambales-green disabled:opacity-50"
                />
                <label htmlFor="create-announcement-public" className="text-sm text-gray-700">
                  Public on web (guest-visible). Barangay posts remain resident-only.
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="create-announcement-pin"
                  type="checkbox"
                  checked={formData.pinned}
                  onChange={(e) => setFormData(prev => ({ ...prev, pinned: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-zambales-green focus:ring-zambales-green"
                />
                <label htmlFor="create-announcement-pin" className="text-sm text-gray-700">Pin announcement</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pinned until (optional)</label>
                <input
                  type="datetime-local"
                  value={formData.pinned_until}
                  onChange={(e) => setFormData(prev => ({ ...prev, pinned_until: e.target.value }))}
                  disabled={!formData.pinned}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green disabled:bg-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">More details link (optional)</label>
              <input
                name="create_announcement_link"
                id="create-announcement-link"
                type="url"
                inputMode="url"
                placeholder="https://facebook.com/..."
                value={formData.external_url}
                onChange={(e) => setFormData(prev => ({ ...prev, external_url: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.title.trim() || !formData.content.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-zambales-green hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
              >
                {loading ? 'Creating...' : 'Create Announcement'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    ),
    document.body
  )
}

// Helper function for priority colors
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800'
    case 'medium': return 'bg-yellow-100 text-yellow-800'
    case 'low': return 'bg-green-100 text-green-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}
