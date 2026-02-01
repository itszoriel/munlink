import { useState, useEffect } from 'react'
import { Plus, Megaphone, Edit, Trash2, Pin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ProvincialAdminLayout from '../components/layout/ProvincialAdminLayout'
import { announcementApi, handleApiError, mediaUrl } from '../lib/api'
import { EmptyState } from '@munlink/ui'

interface Announcement {
  id: number
  title: string
  content: string
  priority: 'high' | 'medium' | 'low'
  is_active: boolean
  created_at: string
  updated_at: string
  scope?: 'PROVINCE' | 'MUNICIPALITY' | 'BARANGAY'
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  pinned?: boolean
  pinned_until?: string
  publish_at?: string
  expire_at?: string
  images?: string[]
}

type AnnouncementFormValues = {
  title: string
  content: string
  priority: 'high' | 'medium' | 'low'
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  pinned: boolean
  pinned_until: string
  publish_at: string
  expire_at: string
}

const initialFormData: AnnouncementFormValues = {
  title: '',
  content: '',
  priority: 'medium',
  status: 'DRAFT',
  pinned: false,
  pinned_until: '',
  publish_at: '',
  expire_at: '',
}

export default function ProvincialAdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [formData, setFormData] = useState<AnnouncementFormValues>(initialFormData)
  const [formImages, setFormImages] = useState<FileList | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [fabExpanded, setFabExpanded] = useState(false)

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      setLoading(true)
      const response = await announcementApi.getAnnouncements()
      const allAnnouncements = (response as any).announcements || []
      // Filter for province-wide only
      const provinceAnnouncements = allAnnouncements.filter((a: Announcement) => a.scope === 'PROVINCE')
      setAnnouncements(provinceAnnouncements)
    } catch (err) {
      handleApiError(err, 'Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setFormLoading(true)

      const data = new FormData()
      data.append('title', formData.title)
      data.append('content', formData.content)
      data.append('priority', formData.priority)
      data.append('status', formData.status)
      data.append('scope', 'PROVINCE') // Always PROVINCE for provincial admin
      data.append('pinned', String(formData.pinned))
      if (formData.pinned_until) data.append('pinned_until', formData.pinned_until)
      if (formData.publish_at) data.append('publish_at', formData.publish_at)
      if (formData.expire_at) data.append('expire_at', formData.expire_at)

      if (formImages) {
        Array.from(formImages).forEach((file) => {
          data.append('images', file)
        })
      }

      await announcementApi.createAnnouncement(data)
      setShowCreateModal(false)
      setFormData(initialFormData)
      setFormImages(null)
      fetchAnnouncements()
    } catch (err) {
      handleApiError(err, 'Failed to create announcement')
    } finally {
      setFormLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAnnouncement) return

    try {
      setFormLoading(true)

      const data = new FormData()
      data.append('title', formData.title)
      data.append('content', formData.content)
      data.append('priority', formData.priority)
      data.append('status', formData.status)
      data.append('pinned', String(formData.pinned))
      if (formData.pinned_until) data.append('pinned_until', formData.pinned_until)
      if (formData.publish_at) data.append('publish_at', formData.publish_at)
      if (formData.expire_at) data.append('expire_at', formData.expire_at)

      if (formImages) {
        Array.from(formImages).forEach((file) => {
          data.append('images', file)
        })
      }

      await announcementApi.updateAnnouncement(editingAnnouncement.id, data)
      setEditingAnnouncement(null)
      setFormData(initialFormData)
      setFormImages(null)
      fetchAnnouncements()
    } catch (err) {
      handleApiError(err, 'Failed to update announcement')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return

    try {
      await announcementApi.deleteAnnouncement(id)
      fetchAnnouncements()
    } catch (err) {
      handleApiError(err, 'Failed to delete announcement')
    }
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setFormData({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      status: announcement.status || 'DRAFT',
      pinned: announcement.pinned || false,
      pinned_until: announcement.pinned_until || '',
      publish_at: announcement.publish_at || '',
      expire_at: announcement.expire_at || '',
    })
  }

  const resetForm = () => {
    setShowCreateModal(false)
    setEditingAnnouncement(null)
    setFormData(initialFormData)
    setFormImages(null)
  }

  const priorityColors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
  }

  const statusColors = {
    DRAFT: 'bg-gray-100 text-gray-700',
    PUBLISHED: 'bg-blue-100 text-blue-700',
    ARCHIVED: 'bg-neutral-100 text-neutral-700',
  }

  const isFormOpen = showCreateModal || editingAnnouncement !== null

  return (
    <ProvincialAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-gray-900">Province-Wide Announcements</h1>
            <p className="text-gray-600 mt-2">Manage announcements for all 13 municipalities in Zambales</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="hidden sm:flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-xl hover:shadow-lg transition-shadow"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">New Announcement</span>
          </button>
        </div>

        {/* Announcements List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-2/3 mb-4" />
                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="w-16 h-16" />}
            title="No province-wide announcements yet"
            description="Create your first province-wide announcement to reach all municipalities in Zambales."
            action={
              <button
                onClick={() => setShowCreateModal(true)}
                className="hidden sm:block px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-xl hover:shadow-lg transition-shadow"
              >
                Create Announcement
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{announcement.title}</h3>
                      {announcement.pinned && <Pin className="w-5 h-5 text-orange-600" />}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[announcement.priority]}`}>
                        {announcement.priority.toUpperCase()}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[announcement.status || 'DRAFT']}`}>
                        {announcement.status || 'DRAFT'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                        PROVINCE-WIDE
                      </span>
                    </div>
                    <p className="text-gray-600 line-clamp-2">{announcement.content}</p>
                    {announcement.images && announcement.images.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {announcement.images.slice(0, 3).map((img, idx) => (
                          <img
                            key={idx}
                            src={mediaUrl(img)}
                            alt={`Announcement image ${idx + 1}`}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        ))}
                        {announcement.images.length > 3 && (
                          <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-sm">
                            +{announcement.images.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(announcement)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(announcement.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  Created {new Date(announcement.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-start md:items-center justify-center p-4 pt-20 md:pt-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 my-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {editingAnnouncement ? 'Edit Announcement' : 'Create Province-Wide Announcement'}
              </h2>

              <form onSubmit={editingAnnouncement ? handleUpdate : handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.pinned}
                      onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Pin this announcement</span>
                  </label>
                </div>

                {formData.pinned && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pin Until (Optional)</label>
                    <input
                      type="datetime-local"
                      value={formData.pinned_until}
                      onChange={(e) => setFormData({ ...formData, pinned_until: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Images (Optional)</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => setFormImages(e.target.files)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50"
                  >
                    {formLoading ? 'Saving...' : editingAnnouncement ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Floating Action Button (Mobile Only) */}
        {!isFormOpen && (
          <motion.div
            className="fixed bottom-20 right-4 z-50 sm:hidden"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <motion.button
              className="relative flex items-center justify-center bg-gradient-to-r from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-shadow"
              onClick={() => {
                if (fabExpanded) {
                  setShowCreateModal(true)
                  setFabExpanded(false)
                } else {
                  setFabExpanded(true)
                }
              }}
              animate={{
                width: fabExpanded ? 200 : 56,
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

        {/* Backdrop to close FAB when clicking outside */}
        <AnimatePresence>
          {fabExpanded && !isFormOpen && (
            <motion.div
              className="fixed inset-0 z-40 sm:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFabExpanded(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </ProvincialAdminLayout>
  )
}
