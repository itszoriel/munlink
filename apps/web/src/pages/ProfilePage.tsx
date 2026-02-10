import { useEffect, useState, useRef } from 'react'
import { X } from 'lucide-react'
import { authApi, mediaUrl, transferApi, showToast, municipalityApi } from '@/lib/api'
import { Form, FormField, Input, Button } from '@munlink/ui'
import { getProvinces, getMunicipalities, getMunicipalityById, getBarangaysByMunicipalityId } from '@/lib/locations'
import SafeImage from '@/components/SafeImage'
import SpecialStatusSection from '@/components/SpecialStatusSection'
import { useAppStore } from '@/lib/store'
import { getAccessToken } from '@/lib/api'

type Profile = {
  first_name?: string
  last_name?: string
  username?: string
  email?: string
  phone?: string
  mobile?: string
  notify_email_enabled?: boolean
  notify_sms_enabled?: boolean
  sms_provider_status?: any
  profile_picture?: string
  province_id?: number
  province_name?: string
  municipality_id?: number
  municipality_name?: string
  barangay_id?: number
  barangay_name?: string
}

export default function ProfilePage() {
  const setAuth = useAppStore((s) => s.setAuth)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [form, setForm] = useState<Profile>({})
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferOk, setTransferOk] = useState<string | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferForm, setTransferForm] = useState({ province_id: '', to_municipality_id: '', to_barangay_id: '', notes: '' })
  const [transferBarangays, setTransferBarangays] = useState<any[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const profilePhotoInputRef = useRef<HTMLInputElement>(null)

  // Static province and municipality data
  const provinces = getProvinces()
  const transferMunicipalities = transferForm.province_id
    ? getMunicipalities(Number(transferForm.province_id))
    : []

  // Compute the full address from location parts
  const fullAddress = [
    form.barangay_name ? `Brgy. ${form.barangay_name}` : null,
    form.municipality_name,
    form.province_name
  ].filter(Boolean).join(', ')

  const smsStatus = form.sms_provider_status || {}
  const smsUnavailableReason = smsStatus && smsStatus.available === false ? (smsStatus.reason || 'unavailable') : null
  const smsReasonCopy = smsUnavailableReason === 'not_configured'
    ? 'SMS temporarily unavailable: Provider not configured.'
    : smsUnavailableReason === 'philsms_unavailable'
      ? 'SMS temporarily unavailable: Service unreachable.'
      : smsUnavailableReason === 'sms_disabled'
        ? 'SMS is disabled in this environment.'
        : smsUnavailableReason

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const profileRes = await authApi.getProfile()
        const data = (profileRes as any).data || profileRes

        // Use API-provided names first (from database relationships)
        // Fall back to static lookup only if API doesn't return them
        let provinceName = data.province_name || ''
        let provinceId = undefined

        // If API didn't return province_name, try static lookup
        if (!provinceName && data.municipality_id) {
          // Convert to number in case it's a string from JSON
          const muniId = typeof data.municipality_id === 'string'
            ? parseInt(data.municipality_id, 10)
            : data.municipality_id
          const userMuni = getMunicipalityById(muniId)
          if (userMuni) {
            provinceId = userMuni.province_id
            const province = getProvinces().find(p => p.id === userMuni.province_id)
            provinceName = province?.name || ''
          }
        }

        // For barangay_name, use API data directly (comes from database relationship)
        const barangayName = data.barangay_name || ''

        if (!cancelled) {
          setForm({
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            username: data.username || '',
            email: data.email || '',
            phone: data.phone_number || '',
            mobile: data.mobile_number || '',
            notify_email_enabled: data.notify_email_enabled !== false,
            notify_sms_enabled: !!data.notify_sms_enabled,
            sms_provider_status: data.sms_provider_status || null,
            profile_picture: data.profile_picture || '',
            province_id: provinceId,
            province_name: provinceName,
            municipality_id: data.municipality_id,
            municipality_name: data.municipality_name,
            barangay_id: data.barangay_id,
            barangay_name: barangayName,
          })
          // Note: Barangay is now read-only in profile, only editable through transfer request
        }
      } catch (e: any) {
        if (!cancelled) setError('Failed to load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((f) => {
      const next: any = { ...f, [name]: value }
      if (name === 'mobile' && !value) {
        next.notify_sms_enabled = false
      }
      return next
    })
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const payload: any = {
        first_name: form.first_name,
        last_name: form.last_name,
      }
      if (form.username) payload.username = form.username
      if (form.email) payload.email = form.email
      if (form.phone !== undefined) payload.phone_number = form.phone
      if (form.mobile !== undefined) payload.mobile_number = form.mobile
      if (form.notify_email_enabled !== undefined) payload.notify_email_enabled = form.notify_email_enabled
      if (form.notify_sms_enabled !== undefined) payload.notify_sms_enabled = form.notify_sms_enabled && !!form.mobile && !smsUnavailableReason
      // Barangay is not editable in profile - only through transfer request
      await authApi.updateProfile(payload)
      setOk('Profile updated')
      showToast('Profile updated successfully', 'success')
    } catch (e: any) {
      setError('Failed to update profile')
      showToast('Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Load barangays when municipality is selected in transfer form
  useEffect(() => {
    const loadTransferBarangays = async () => {
      if (!transferForm.to_municipality_id) {
        setTransferBarangays([])
        setTransferForm(prev => ({ ...prev, to_barangay_id: '' }))
        return
      }
      const municipalityId = Number(transferForm.to_municipality_id)
      const normalizeBarangays = (items: any[]): any[] => {
        if (!Array.isArray(items)) return []
        return items
          .map((item: any) => {
            const id = Number(item?.id ?? item?.barangay_id ?? 0)
            const name = item?.name || item?.barangay_name || ''
            if (!id || !name) return null
            return { ...item, id, name }
          })
          .filter(Boolean) as any[]
      }

      // Zambales-first: prefer local static scope map for transfer barangays.
      const staticBarangays = normalizeBarangays(getBarangaysByMunicipalityId(municipalityId))
      if (staticBarangays.length > 0) {
        setTransferBarangays(staticBarangays)
        return
      }

      try {
        const res = await municipalityApi.getBarangays(municipalityId)
        const apiBarangays = normalizeBarangays((res as any)?.data?.barangays || (res as any)?.barangays || [])
        setTransferBarangays(apiBarangays)
      } catch {
        setTransferBarangays([])
      }
    }
    loadTransferBarangays()
  }, [transferForm.to_municipality_id])

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferForm.to_municipality_id) {
      setTransferError('Please select a municipality')
      return
    }
    if (!transferForm.to_barangay_id) {
      setTransferError('Please select a barangay')
      return
    }
    if (!transferForm.notes || !transferForm.notes.trim()) {
      setTransferError('Please provide a reason for the transfer')
      return
    }
    setTransferring(true)
    setTransferError(null)
    setTransferOk(null)
    try {
      await transferApi.request(Number(transferForm.to_municipality_id), transferForm.notes, Number(transferForm.to_barangay_id))
      setTransferOk('Transfer request submitted successfully')
      setShowTransferModal(false)
      setTransferForm({ province_id: '', to_municipality_id: '', to_barangay_id: '', notes: '' })
      setTransferBarangays([])
      showToast('Transfer request submitted successfully', 'success')
    } catch (e: any) {
      setTransferError(e?.response?.data?.error || 'Failed to submit transfer request')
      showToast(e?.response?.data?.error || 'Failed to submit transfer request', 'error')
    } finally {
      setTransferring(false)
    }
  }

  const handleProfilePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      handleProfilePhotoUpload(file)
    }
  }

  const handleProfilePhotoUpload = async (file: File) => {
    setUploadingPhoto(true)
    setError(null)
    try {
      const response = await authApi.uploadProfilePhoto(file)
      const userData = (response as any)?.data?.user || (response as any)?.user || response
      if (userData) {
        setAuth(userData, getAccessToken() || '', '')
        setForm((prev) => ({ ...prev, profile_picture: userData.profile_picture || prev.profile_picture }))
        showToast('Profile photo updated successfully', 'success')
      }
      if (profilePhotoInputRef.current) {
        profilePhotoInputRef.current.value = ''
      }
    } catch (e: any) {
      setError('Failed to upload profile photo')
      showToast(e?.response?.data?.error || 'Failed to upload profile photo', 'error')
    } finally {
      setUploadingPhoto(false)
    }
  }

  return (
    <div className="container-responsive py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile Picture Section */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Profile</h3>
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="relative self-start">
              <SafeImage
                src={form.profile_picture ? mediaUrl(form.profile_picture) : undefined}
                alt="Profile"
                className="w-24 h-24 rounded-full"
                fallbackIcon="user"
                showReuploadButton={true}
                onReupload={() => profilePhotoInputRef.current?.click()}
                reuploadLabel="Change Photo"
              />
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">Uploading...</span>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-xl font-semibold text-gray-900">
                  {`${form.first_name || ''} ${form.last_name || ''}`.trim() || form.username || 'My Profile'}
                </p>
                {form.email && <p className="text-sm text-gray-600">{form.email}</p>}
                {(form.mobile || form.phone) && (
                  <p className="text-sm text-gray-600">{form.mobile || form.phone}</p>
                )}
                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-ocean-50 text-ocean-700 border border-ocean-100">
                  Resident
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {form.profile_picture ? 'This photo is displayed across the platform.' : 'Upload a profile picture to personalize your account.'}
              </p>
              <input
                ref={profilePhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfilePhotoSelect}
                disabled={uploadingPhoto}
              />
              <button
                type="button"
                onClick={() => profilePhotoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="px-4 py-2 text-sm font-medium text-white bg-ocean-600 hover:bg-ocean-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
              >
                {uploadingPhoto ? 'Uploading...' : form.profile_picture ? 'Change Photo' : 'Upload Photo'}
              </button>
            </div>
          </div>
        </div>

        {error && <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
        {ok && <div className="rounded-md border border-green-200 bg-green-50 text-green-700 px-3 py-2 text-sm">{ok}</div>}

        {/* Location / Address Section */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Your Address</h3>
          <div className="bg-ocean-50 rounded-lg p-4 border border-ocean-200 mb-4">
            <div className="text-sm font-medium text-ocean-800 mb-1">Current Address</div>
            <div className="text-ocean-900 font-semibold">
              {fullAddress || 'No address set - please complete your location details'}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
              <input
                type="text"
                value={form.province_name || ''}
                disabled
                className="input-field bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Municipality</label>
              <input
                type="text"
                value={form.municipality_name || ''}
                disabled
                className="input-field bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barangay</label>
              <input
                type="text"
                value={form.barangay_name || ''}
                disabled
                className="input-field bg-gray-100 cursor-not-allowed"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              <span>Need to move to a different municipality or province? </span>
              <button
                type="button"
                onClick={() => setShowTransferModal(true)}
                className="text-ocean-600 hover:text-ocean-700 font-medium underline"
              >
                Request a transfer
              </button>
            </div>
          </div>
        </div>

        {/* Special Status Section */}
        <SpecialStatusSection />

        {/* Personal Info Form */}
        <Form onSubmit={onSubmit} className="max-w-2xl" columns={2}>
          <FormField label="First name">
            <Input name="first_name" value={form.first_name || ''} onChange={onChange} disabled={loading || saving} />
          </FormField>
          <FormField label="Last name">
            <Input name="last_name" value={form.last_name || ''} onChange={onChange} disabled={loading || saving} />
          </FormField>
          <FormField label="Username">
            <Input name="username" value={form.username || ''} onChange={onChange} disabled={loading || saving} />
          </FormField>
          <FormField label="Email">
            <Input name="email" type="email" value={form.email || ''} onChange={onChange} disabled={loading || saving} />
          </FormField>
          <FormField label="Mobile (SMS)">
            <Input name="mobile" value={form.mobile || ''} onChange={onChange} disabled={loading || saving} placeholder="09XXXXXXXXX" />
            <p className="text-xs text-gray-500 mt-1">Optional — add a mobile number to enable SMS notifications.</p>
          </FormField>


          <div className="col-span-full border rounded-lg p-4 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-800">Notification Preferences</h4>
              <p className="text-xs text-gray-600">Manage email and SMS alerts for announcements and document requests.</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Email notifications</p>
                <p className="text-xs text-gray-600">Recommended for important updates.</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.notify_email_enabled ?? true}
                onChange={(e) => setForm((f) => ({ ...f, notify_email_enabled: e.target.checked }))}
                disabled={loading || saving}
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <div>
                <p className="text-sm font-medium text-gray-900">SMS notifications</p>
                <p className="text-xs text-gray-600">
                  {form.mobile ? 'Get SMS alerts about announcements and requests.' : 'Add a mobile number to enable SMS alerts.'}
                </p>
                {smsReasonCopy && (
                  <p className="text-xs text-red-600 mt-1">{smsReasonCopy}</p>
                )}
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!form.notify_sms_enabled && !!form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, notify_sms_enabled: e.target.checked }))}
                disabled={loading || saving || !form.mobile || !!smsUnavailableReason}
              />
            </div>
          </div>
          <div className="col-span-full">
            <Button type="submit" disabled={saving || loading}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </Form>
      </div>

      {/* Transfer Modal with Province Selection - Full screen on mobile */}
      {showTransferModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
          onClick={() => setShowTransferModal(false)}
        >
          <div
            className="bg-white w-full sm:w-[95%] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Request Location Transfer</h3>
              <button onClick={() => setShowTransferModal(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
              <p className="text-sm text-gray-600 mb-4">
                Select your new province, municipality, and barangay. This will require approval from your current admin and acceptance by the new municipality.
              </p>
              {transferError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2.5 text-sm">{transferError}</div>}
              {transferOk && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 text-green-700 px-3 py-2.5 text-sm">{transferOk}</div>}
              <form onSubmit={handleTransferSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Target Province <span className="text-red-500">*</span></label>
                  <select
                    value={transferForm.province_id}
                    onChange={(e) => setTransferForm(prev => ({ ...prev, province_id: e.target.value, to_municipality_id: '', to_barangay_id: '' }))}
                    className="input-field"
                    required
                  >
                    <option value="">Select province</option>
                    {provinces.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Target Municipality <span className="text-red-500">*</span></label>
                  <select
                    value={transferForm.to_municipality_id}
                    onChange={(e) => setTransferForm(prev => ({ ...prev, to_municipality_id: e.target.value, to_barangay_id: '' }))}
                    className="input-field"
                    disabled={!transferForm.province_id}
                    required
                  >
                    <option value="">{transferForm.province_id ? 'Select municipality' : 'Select province first'}</option>
                    {transferMunicipalities.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Target Barangay <span className="text-red-500">*</span></label>
                  <select
                    value={transferForm.to_barangay_id}
                    onChange={(e) => setTransferForm(prev => ({ ...prev, to_barangay_id: e.target.value }))}
                    className="input-field"
                    disabled={!transferForm.to_municipality_id || transferBarangays.length === 0}
                    required
                  >
                    <option value="">{!transferForm.to_municipality_id ? 'Select municipality first' : transferBarangays.length === 0 ? 'No barangays available' : 'Select barangay'}</option>
                    {transferBarangays.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Reason for Transfer <span className="text-red-500">*</span></label>
                  <textarea
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="input-field resize-none"
                    rows={3}
                    placeholder="Please provide a reason for the transfer..."
                    required
                  />
                </div>

                {/* Footer buttons */}
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setShowTransferModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto" disabled={transferring}>
                    {transferring ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


