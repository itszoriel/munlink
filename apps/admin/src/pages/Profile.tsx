import { useEffect, useState, useRef } from 'react'
import { useAdminStore } from '../lib/store'
import { authApi, mediaUrl, showToast } from '../lib/api'
import SafeImage from '../components/SafeImage'

export default function Profile() {
  const storeUser = useAdminStore((s) => s.user)
  const updateUser = useAdminStore((s) => s.updateUser)
  const [user, setUser] = useState<any>(storeUser)
  const [form, setForm] = useState<{ first_name: string; middle_name?: string; last_name: string; mobile_number?: string }>(
    { first_name: storeUser?.first_name || '', middle_name: storeUser?.middle_name || '', last_name: storeUser?.last_name || '', mobile_number: storeUser?.mobile_number || '' }
  )
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [imageError, setImageError] = useState(false)
  const profilePhotoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await authApi.getProfile()
        const u = (res as any)?.data || res
        setUser(u)
        setForm({ first_name: u.first_name || '', middle_name: u.middle_name || '', last_name: u.last_name || '', mobile_number: u.mobile_number || '' })
        updateUser(u)
      } catch {}
    })()
  }, [updateUser])

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-8">
        {/* Header with photo */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative">
            <SafeImage
              src={user?.profile_picture ? mediaUrl(user.profile_picture) : undefined}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover mb-4 ring-4 ring-ocean-100"
              fallbackIcon="user"
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
            />
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center mb-4">
                <span className="text-white text-xs">Uploading...</span>
              </div>
            )}
          </div>
          <h2 className="text-xl font-semibold text-neutral-900">{user?.first_name} {user?.last_name}</h2>
          <p className="text-neutral-600 text-sm">{user?.email}</p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ocean-50 text-ocean-700 text-xs font-medium">
            <span className="capitalize">{user?.role || 'Admin'}</span>
            <span className="text-ocean-300">•</span>
            <span>{user?.admin_municipality_name || user?.municipality_name || 'Unassigned'}</span>
          </div>
          
          {/* Photo upload */}
          <div className="mt-4 flex items-center gap-2">
            <input
              ref={profilePhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const selectedFile = e.target.files?.[0] || null
                if (selectedFile) {
                  setUploadingPhoto(true)
                  try {
                    const res = await authApi.uploadProfilePhoto(selectedFile)
                    const u = (res as any)?.data?.user || (res as any)?.user || res
                    setUser(u)
                    updateUser(u)
                    showToast('Photo updated', 'success')
                    if (profilePhotoInputRef.current) {
                      profilePhotoInputRef.current.value = ''
                    }
                  } catch (e: any) {
                    showToast(e?.response?.data?.error || 'Upload failed', 'error')
                  } finally {
                    setUploadingPhoto(false)
                  }
                }
              }}
            />
            <button
              className={`px-3 py-1.5 rounded-lg text-sm transition disabled:opacity-50 ${
                imageError || !user?.profile_picture
                  ? 'bg-ocean-600 hover:bg-ocean-700 text-white'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
              onClick={() => profilePhotoInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
            </button>
          </div>
        </div>

        {/* Edit name form */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900 border-b pb-2">Edit Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs text-neutral-500">First name</span>
              <input className="input-field mt-1" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-500">Middle name</span>
              <input className="input-field mt-1" value={form.middle_name || ''} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-500">Last name</span>
              <input className="input-field mt-1" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-neutral-500">Mobile number (optional)</span>
            <input className="input-field mt-1" value={form.mobile_number || ''} onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} placeholder="09XXXXXXXXX" />
            <span className="text-[11px] text-neutral-500">Used for SMS notifications when enabled.</span>
          </label>
          <div className="flex justify-end pt-2">
            <button
              className="px-5 py-2 rounded-lg bg-ocean-600 text-white hover:bg-ocean-700 disabled:opacity-60 text-sm font-medium"
              disabled={saving || !form.first_name || !form.last_name}
              onClick={async () => {
                setSaving(true)
                try {
                  const res = await authApi.updateProfile({ first_name: form.first_name, middle_name: form.middle_name, last_name: form.last_name, mobile_number: form.mobile_number })
                  const u = (res as any)?.data?.user || (res as any)?.user || res
                  setUser(u)
                  updateUser(u)
                  showToast('Profile updated', 'success')
                } catch (e: any) {
                  showToast(e?.response?.data?.error || 'Update failed', 'error')
                } finally {
                  setSaving(false)
                }
              }}
            >{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
