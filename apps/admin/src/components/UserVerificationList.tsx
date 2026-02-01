/**
 * MunLink Zambales - User Verification Component
 * Component for managing user verification requests
 */
import { useState, useEffect, useRef } from 'react'
import { userApi, handleApiError, mediaUrl, showToast } from '../lib/api'
import { WatermarkedImageViewer } from './WatermarkedImageViewer'
import { ViewIDReasonModal } from './ViewIDReasonModal'
import { useAdminStore } from '../lib/store'

interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  profile_picture?: string
  valid_id_front?: string
  valid_id_back?: string
  created_at: string
  municipality_name?: string
}

interface UserVerificationListProps {
  onUserVerified?: (userId: number) => void
  onUserRejected?: (userId: number) => void
  onReview?: (user: User) => void
}

export default function UserVerificationList({ 
  onUserVerified, 
  onUserRejected,
  onReview,
}: UserVerificationListProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState<{ userId: number; action: 'approve' | 'reject' } | null>(null)
  const currentUser = useAdminStore((s) => s.user)
  const hasApprovePermission = (currentUser?.permissions?.includes('residents:approve') || currentUser?.permissions?.includes('*')) ?? false

  // Load pending users
  const loadPendingUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await userApi.getPendingUsers()
      setUsers((response as any).users || [])
    } catch (err: any) {
      // Handle 422 errors gracefully - show empty state instead of error
      if (err.response?.status === 422) {
        setUsers([])
        setError(null)
      } else {
        setError(handleApiError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPendingUsers()
  }, [])

  // Handle user verification
  const handleVerifyUser = async (userId: number) => {
    if (!hasApprovePermission) {
      setError('Permission denied: residents:approve required')
      return
    }
    try {
      setActionLoading({ userId, action: 'approve' })
      await userApi.verifyUser(userId)
      
      // Remove user from list
      setUsers(prev => prev.filter(user => user.id !== userId))
      onUserVerified?.(userId)
      
      // Close modal if this was the selected user
      if (selectedUser?.id === userId) {
        setShowModal(false)
        setSelectedUser(null)
      }
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  // Handle user rejection
  const handleRejectUser = async (userId: number, reason: string) => {
    if (!hasApprovePermission) {
      setError('Permission denied: residents:approve required')
      return
    }
    try {
      setActionLoading({ userId, action: 'reject' })
      await userApi.rejectUser(userId, reason)
      
      // Remove user from list
      setUsers(prev => prev.filter(user => user.id !== userId))
      onUserRejected?.(userId)
      
      // Close modal
      setShowModal(false)
      setSelectedUser(null)
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  // Open user detail modal
  const openUserModal = (user: User) => {
    if (onReview) {
      onReview(user)
      return
    }
    setSelectedUser(user)
    setShowModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zambales-green"></div>
        <span className="ml-2 text-gray-600">Loading pending users...</span>
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
            <h3 className="text-sm font-medium text-red-800">Error loading users</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No pending verifications</h3>
        <p className="text-gray-500">All users have been processed.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {users.map((user) => (
          <div key={user.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="flex items-start space-x-4 min-w-0">
                {/* Profile Picture */}
                <div className="flex-shrink-0">
                  {user.profile_picture ? (
                    <img
                      src={mediaUrl(user.profile_picture)}
                      alt={`${user.first_name} ${user.last_name}`}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500 font-medium">
                        {user.first_name[0]}{user.last_name[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-gray-900">
                    {user.first_name} {user.last_name}
                  </h3>
                  <p className="text-sm text-gray-500">@{user.username}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  {user.municipality_name && (
                    <p className="text-sm text-gray-500">{user.municipality_name}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Registered: {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap md:flex-nowrap md:self-start mt-3 md:mt-0">
                <button
                  onClick={() => openUserModal(user)}
                  className="px-3 py-1 text-xs whitespace-nowrap font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Review
                </button>
                <button
                  onClick={() => handleVerifyUser(user.id)}
                  disabled={!hasApprovePermission || actionLoading !== null}
                  className="px-3 py-1 text-xs whitespace-nowrap font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {actionLoading?.userId === user.id && actionLoading?.action === 'approve' ? 'Verifying...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleRejectUser(user.id, 'Verification rejected by admin')}
                  disabled={!hasApprovePermission || actionLoading !== null}
                  className="px-3 py-1 text-xs whitespace-nowrap font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {actionLoading?.userId === user.id && actionLoading?.action === 'reject' ? 'Rejecting...' : 'Reject'}
                </button>
                {!hasApprovePermission && (
                  <span className="text-xs text-gray-400 ml-2">No approve/reject permission</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* User Detail Modal */}
      {showModal && selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => {
            setShowModal(false)
            setSelectedUser(null)
          }}
          onVerify={handleVerifyUser}
          onReject={handleRejectUser}
          loading={actionLoading?.userId === selectedUser.id ? actionLoading.action : null}
        />
      )}
    </>
  )
}

// User Detail Modal Component
interface UserDetailModalProps {
  user: User
  onClose: () => void
  onVerify: (userId: number) => void
  onReject: (userId: number, reason: string) => void
  loading: 'approve' | 'reject' | null
}

function UserDetailModal({ user, onClose, onVerify, onReject, loading }: UserDetailModalProps) {
  const currentUser = useAdminStore((s) => s.user)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [fullUser, setFullUser] = useState<User | null>(user)
  const [fetching, setFetching] = useState(false)
  const [uploadingDocs, setUploadingDocs] = useState(false)
  const [docFiles, setDocFiles] = useState<{ valid_id_front?: File, valid_id_back?: File }>({})
  const idFrontInputRef = useRef<HTMLInputElement>(null)
  const idBackInputRef = useRef<HTMLInputElement>(null)

  // Watermarked viewer state
  const [viewingDoc, setViewingDoc] = useState<{
    type: 'id_front' | 'id_back',
    reason: string
  } | null>(null)
  const [showReasonModal, setShowReasonModal] = useState<{
    type: 'id_front' | 'id_back'
  } | null>(null)

  // Permission checks
  const hasIdViewPermission = currentUser?.permissions?.includes('residents:id_view') ?? false
  const hasApprovePermission = currentUser?.permissions?.includes('residents:approve') ?? false

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setFetching(true)
        const res = await userApi.getUserById(user.id)
        const data = (res as any)?.data || res
        if (mounted && data) setFullUser(data as any)
      } catch {}
      finally { if (mounted) setFetching(false) }
    })()
    return () => { mounted = false }
  }, [user?.id])

  const handleReject = () => {
    if (rejectReason.trim()) {
      onReject(user.id, rejectReason)
    }
  }

  const handleUploadDocs = async () => {
    if (!Object.keys(docFiles).length) return
    setUploadingDocs(true)
    try {
      const res = await userApi.uploadUserVerificationDocs(user.id, docFiles)
      const updatedUser = (res as any)?.data?.user || (res as any)?.data || res
      if (updatedUser) {
        setFullUser(updatedUser)
      }
      setDocFiles({})
      if (idFrontInputRef.current) idFrontInputRef.current.value = ''
      if (idBackInputRef.current) idBackInputRef.current.value = ''
      showToast('Documents uploaded successfully', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setUploadingDocs(false)
    }
  }

  const handleConfirmView = (reason: string, notes: string) => {
    if (!showReasonModal) return

    const fullReason = notes ? `${reason} - ${notes}` : reason
    setViewingDoc({ type: showReasonModal.type, reason: fullReason })
    setShowReasonModal(null)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              User Verification Review
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* User Info */}
          <div className="flex items-start space-x-4 mb-6">
            {fullUser?.profile_picture ? (
              <img
                src={mediaUrl(fullUser.profile_picture)}
                alt={`${fullUser.first_name} ${fullUser.last_name}`}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500 font-medium text-lg">
                  {user.first_name[0]}{user.last_name[0]}
                </span>
              </div>
            )}
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {fullUser?.first_name || user.first_name} {fullUser?.last_name || user.last_name}
              </h3>
              <p className="text-sm text-gray-500">@{fullUser?.username || user.username}</p>
              <p className="text-sm text-gray-500">{fullUser?.email || user.email}</p>
              {(fullUser?.municipality_name || user.municipality_name) && (
                <p className="text-sm text-gray-500">{fullUser?.municipality_name || user.municipality_name}</p>
              )}
            </div>
          </div>

          {/* ID Documents */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">ID Documents</h4>
            <div className="space-y-4 mb-4">
              {/* ID Front */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">ID Front</label>
                {viewingDoc?.type === 'id_front' ? (
                  <WatermarkedImageViewer
                    userId={fullUser?.id || user.id}
                    docType="id_front"
                    reason={viewingDoc.reason}
                    municipalityName={fullUser?.municipality_name || user.municipality_name || 'Unknown'}
                    residentId={fullUser?.id || user.id}
                    onError={(err) => {
                      console.error('Failed to load ID front:', err)
                      setViewingDoc(null)
                    }}
                  />
                ) : (
                  <>
                    {fullUser?.valid_id_front && hasIdViewPermission && (
                      <button
                        onClick={() => setShowReasonModal({ type: 'id_front' })}
                        className="px-3 py-1.5 text-xs font-medium text-ocean-600 border border-ocean-600 rounded hover:bg-ocean-50"
                      >
                        View ID Front
                      </button>
                    )}
                    {fullUser?.valid_id_front && !hasIdViewPermission && (
                      <span className="text-xs text-gray-400">No permission to view</span>
                    )}
                    {!fullUser?.valid_id_front && (
                      <span className="text-xs text-gray-500">Not uploaded</span>
                    )}
                  </>
                )}
              </div>

              {/* ID Back */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">ID Back</label>
                {viewingDoc?.type === 'id_back' ? (
                  <WatermarkedImageViewer
                    userId={fullUser?.id || user.id}
                    docType="id_back"
                    reason={viewingDoc.reason}
                    municipalityName={fullUser?.municipality_name || user.municipality_name || 'Unknown'}
                    residentId={fullUser?.id || user.id}
                    onError={(err) => {
                      console.error('Failed to load ID back:', err)
                      setViewingDoc(null)
                    }}
                  />
                ) : (
                  <>
                    {fullUser?.valid_id_back && hasIdViewPermission && (
                      <button
                        onClick={() => setShowReasonModal({ type: 'id_back' })}
                        className="px-3 py-1.5 text-xs font-medium text-ocean-600 border border-ocean-600 rounded hover:bg-ocean-50"
                      >
                        View ID Back
                      </button>
                    )}
                    {fullUser?.valid_id_back && !hasIdViewPermission && (
                      <span className="text-xs text-gray-400">No permission to view</span>
                    )}
                    {!fullUser?.valid_id_back && (
                      <span className="text-xs text-gray-500">Not uploaded</span>
                    )}
                  </>
                )}
              </div>

              {!fetching && !fullUser?.valid_id_front && !fullUser?.valid_id_back && (
                <p className="text-sm text-gray-500">No ID documents uploaded.</p>
              )}
            </div>

            {/* Re-upload Section */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
              <h5 className="text-sm font-medium text-gray-900 mb-3">Re-upload Documents (Admin)</h5>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">ID Front</label>
                  <input
                    ref={idFrontInputRef}
                    type="file"
                    accept="image/*"
                    className="text-xs"
                    onChange={(e) => setDocFiles(prev => ({ ...prev, valid_id_front: e.target.files?.[0] || undefined }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">ID Back</label>
                  <input
                    ref={idBackInputRef}
                    type="file"
                    accept="image/*"
                    className="text-xs"
                    onChange={(e) => setDocFiles(prev => ({ ...prev, valid_id_back: e.target.files?.[0] || undefined }))}
                  />
                </div>
                {Object.keys(docFiles).length > 0 && (
                  <button
                    onClick={handleUploadDocs}
                    disabled={uploadingDocs}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-ocean-600 hover:bg-ocean-700 disabled:opacity-50 rounded-md"
                  >
                    {uploadingDocs ? 'Uploading...' : 'Upload Selected Documents'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3">
            {!showRejectForm ? (
              <>
                {hasApprovePermission ? (
                  <>
                    <button
                      onClick={() => setShowRejectForm(true)}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => onVerify(user.id)}
                      disabled={loading !== null}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                    >
                      {loading === 'approve' ? 'Verifying...' : 'Approve'}
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-gray-400">No permission to approve/reject</span>
                )}
              </>
            ) : (
              <>
                <div className="flex-1">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    rows={2}
                  />
                </div>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={loading !== null || !rejectReason.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {loading === 'reject' ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Reason Modal for viewing ID/Selfie */}
      <ViewIDReasonModal
        isOpen={!!showReasonModal}
        docType={showReasonModal?.type || 'id_front'}
        onClose={() => setShowReasonModal(null)}
        onConfirm={handleConfirmView}
      />
    </div>
  )
}
