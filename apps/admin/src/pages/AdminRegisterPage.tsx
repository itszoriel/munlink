import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { getProvinces, getMunicipalities, getBarangaysByMunicipalitySlug } from '@/lib/locations'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

type AdminRole = 'provincial_admin' | 'municipal_admin' | 'barangay_admin'

// Province seals for visual feedback
const provinceSealMap: Record<string, string> = {
  'aurora': new URL('../../../../public/logos/provinces/aurora.png', import.meta.url).toString(),
  'bataan': new URL('../../../../public/logos/provinces/bataan.png', import.meta.url).toString(),
  'bulacan': new URL('../../../../public/logos/provinces/bulacan.png', import.meta.url).toString(),
  'nueva-ecija': new URL('../../../../public/logos/provinces/nueva-ecija.png', import.meta.url).toString(),
  'pampanga': new URL('../../../../public/logos/provinces/pampanga.png', import.meta.url).toString(),
  'tarlac': new URL('../../../../public/logos/provinces/tarlac.png', import.meta.url).toString(),
  'zambales': new URL('../../../../public/logos/provinces/zambales.png', import.meta.url).toString(),
}

export default function AdminRegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    mobile_number: '',
    password: '',
    confirm_password: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    admin_secret: '',
    admin_role: 'municipal_admin' as AdminRole,
    admin_province_id: '',
    admin_municipality_slug: '',
    admin_barangay_id: '',
  })
  const [uploads, setUploads] = useState<{ profile_picture?: File | null; valid_id_front?: File | null; valid_id_back?: File | null }>({})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Use static data - instant load, no API call needed!
  const provinces = useMemo(() => getProvinces(), [])
  const municipalities = useMemo(
    () => formData.admin_province_id ? getMunicipalities(Number(formData.admin_province_id)) : [],
    [formData.admin_province_id]
  )

  const barangays = useMemo(
    () => formData.admin_municipality_slug ? getBarangaysByMunicipalitySlug(formData.admin_municipality_slug) : [],
    [formData.admin_municipality_slug]
  )

  // Get the selected province seal
  const selectedProvince = provinces.find(p => p.id === Number(formData.admin_province_id))
  const provinceSeal = selectedProvince?.slug ? provinceSealMap[selectedProvince.slug] : null

  // Reset municipality when province changes
  useEffect(() => {
    setFormData(f => ({ ...f, admin_municipality_slug: '' }))
  }, [formData.admin_province_id])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      if (formData.password !== formData.confirm_password) {
        setError('Password confirmation does not match')
        setLoading(false)
        return
      }

      // Use FormData from the form element to ensure proper handling
      const formDataObj = new FormData(e.currentTarget)
      
      // Add any additional fields that might not be in the form
      Object.entries(formData).forEach(([key, value]) => {
        if (value && !formDataObj.has(key)) {
          formDataObj.append(key, String(value))
        }
      })
      
      // Add file uploads
      if (uploads.profile_picture) {
        formDataObj.append('profile_picture', uploads.profile_picture)
      }
      if (uploads.valid_id_front) {
        formDataObj.append('valid_id_front', uploads.valid_id_front)
      }
      if (uploads.valid_id_back) {
        formDataObj.append('valid_id_back', uploads.valid_id_back)
      }
      
      // Debug: Log what we're sending
      console.log('Form data being sent:', formData)
      console.log('Files:', { 
        profile_picture: !!uploads.profile_picture, 
        valid_id_front: !!uploads.valid_id_front, 
        valid_id_back: !!uploads.valid_id_back 
      })
      
      // Debug: Log FormData entries
      console.log('FormData entries:')
      for (const [key, value] of formDataObj.entries()) {
        console.log(`${key}:`, value)
      }
      
      const res = await axios.post(`${API_BASE_URL}/api/auth/admin/register`, formDataObj, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      })
      setSuccess(res.data?.message || 'Admin created')
    } catch (err: any) {
      console.error('Full error object:', err)
      console.error('Response data:', err?.response?.data)
      console.error('Response status:', err?.response?.status)
      console.error('Response headers:', err?.response?.headers)
      
      let errorMsg = 'Failed to create admin'
      if (err?.response?.data?.error) {
        errorMsg = err.response.data.error
      } else if (err?.response?.data?.details) {
        errorMsg = err.response.data.details
      } else if (err?.message) {
        errorMsg = err.message
      }
      
      const errorDetails = err?.response?.data?.details ? ` - ${err?.response?.data?.details}` : ''
      setError(errorMsg + errorDetails)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card max-w-2xl mx-auto p-6">
      <div className="w-full flex justify-center pt-2">
        {provinceSeal ? (
          <img
            src={provinceSeal}
            alt={`${selectedProvince?.name} Seal`}
            className="h-14 w-14 object-contain opacity-90 transition-all duration-300"
          />
        ) : (
          <div className="flex gap-1">
            {Object.entries(provinceSealMap).slice(0, 7).map(([slug, src]) => (
              <img
                key={slug}
                src={src}
                alt={`${slug} seal`}
                className="h-6 w-6 object-contain opacity-60"
              />
            ))}
          </div>
        )}
      </div>
      <h1 className="text-3xl font-bold text-center mb-2 text-ocean-700">Create Admin Account</h1>
      <p className="text-center text-sm text-gray-600 mb-6">MunLink Zambales</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
        {success && <div className="rounded-md border border-green-200 bg-green-50 text-green-700 px-3 py-2 text-sm">{success}</div>}
        {/* Name grid (matches web) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">First name <span className="text-red-500">*</span></label>
            <input name="first_name" className="input-field" value={formData.first_name} onChange={(e)=>setFormData({...formData, first_name:e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Middle name <span className="text-gray-400">(optional)</span></label>
            <input name="middle_name" className="input-field" value={formData.middle_name} onChange={(e)=>setFormData({...formData, middle_name:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last name <span className="text-red-500">*</span></label>
            <input name="last_name" className="input-field" value={formData.last_name} onChange={(e)=>setFormData({...formData, last_name:e.target.value})} required />
          </div>
        </div>

        {/* Username & Email (matches web order) */}
        <div>
          <label className="block text-sm font-medium mb-1">Username <span className="text-red-500">*</span></label>
          <input name="username" className="input-field" value={formData.username} onChange={(e)=>setFormData({...formData, username:e.target.value})} required />
          <p className="text-xs text-gray-500 mt-1">3-30 characters, alphanumeric and underscore only (no spaces)</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email <span className="text-red-500">*</span></label>
          <input name="email" type="email" className="input-field" value={formData.email} onChange={(e)=>setFormData({...formData, email:e.target.value})} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mobile Number <span className="text-gray-400">(optional)</span></label>
          <input name="mobile_number" type="tel" className="input-field" value={formData.mobile_number} onChange={(e)=>setFormData({...formData, mobile_number:e.target.value})} placeholder="09XXXXXXXXX" />
          <p className="text-xs text-gray-500 mt-1">Optional — used for SMS notifications.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input name="password" type={showPassword ? 'text' : 'password'} className="input-field pr-10" value={formData.password} onChange={(e)=>setFormData({...formData, password:e.target.value})} required />
              <button type="button" aria-label={showPassword ? 'Hide password':'Show password'} className="absolute inset-y-0 right-2 grid place-items-center text-gray-500" onClick={()=>setShowPassword(v=>!v)}>
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.58 10.58a2 2 0 102.83 2.83"/><path d="M16.68 16.68A8.5 8.5 0 0112 18.5c-5 0-9-4.5-9-6.5a11.77 11.77 0 013.33-3.87"/><path d="M9.88 5.09A8.5 8.5 0 0112 4.5c5 0 9 4.5 9 6.5a11.77 11.77 0 01-2.3 3.2"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Min 8 chars, 1 uppercase, 1 lowercase, 1 number</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input name="confirm_password" type={showConfirm ? 'text' : 'password'} className="input-field pr-10" value={formData.confirm_password} onChange={(e)=>setFormData({...formData, confirm_password:e.target.value})} required />
              <button type="button" aria-label={showConfirm ? 'Hide password':'Show password'} className="absolute inset-y-0 right-2 grid place-items-center text-gray-500" onClick={()=>setShowConfirm(v=>!v)}>
                {showConfirm ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.58 10.58a2 2 0 102.83 2.83"/><path d="M16.68 16.68A8.5 8.5 0 0112 18.5c-5 0-9-4.5-9-6.5a11.77 11.77 0 013.33-3.87"/><path d="M9.88 5.09A8.5 8.5 0 0112 4.5c5 0 9 4.5 9 6.5a11.77 11.77 0 01-2.3 3.2"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <button type="button" className="relative h-20 w-20 rounded-full overflow-hidden border bg-gray-100" onClick={() => document.getElementById('admin-profile-upload')?.click()}>
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-xs text-gray-500">Profile</span>
            )}
          </button>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Profile Photo</label>
            <input id="admin-profile-upload" type="file" accept="image/*" className="hidden" onChange={(e)=>{
              const f = e.target.files?.[0]||null
              setUploads({...uploads, profile_picture:f})
              if (f) setPreviewUrl(URL.createObjectURL(f))
            }} />
            <p className="text-xs text-gray-500">This photo is used across admin UI and public posts.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Valid ID (Front) <span className="text-red-500">*</span></label>
            <input type="file" accept="image/*" className="input-field" onChange={(e)=>setUploads({...uploads, valid_id_front:e.target.files?.[0]||null})} required />
            {uploads.valid_id_front && (<img className="mt-2 h-24 w-auto rounded border" src={uploads.valid_id_front ? URL.createObjectURL(uploads.valid_id_front) : ''} alt="Valid ID Front" />)}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Valid ID (Back) <span className="text-red-500">*</span></label>
            <input type="file" accept="image/*" className="input-field" onChange={(e)=>setUploads({...uploads, valid_id_back:e.target.files?.[0]||null})} required />
            {uploads.valid_id_back && (<img className="mt-2 h-24 w-auto rounded border" src={uploads.valid_id_back ? URL.createObjectURL(uploads.valid_id_back) : ''} alt="Valid ID Back" />)}
          </div>
        </div>
        {/* Admin Role and Assignment */}
        <div className="border-t pt-4 mt-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Admin Role and Assignment</h3>

          {/* Role Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Admin Role <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.admin_role === 'municipal_admin' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="admin_role"
                  value="municipal_admin"
                  checked={formData.admin_role === 'municipal_admin'}
                  onChange={(e) => setFormData({ ...formData, admin_role: e.target.value as AdminRole, admin_barangay_id: '' })}
                  className="mr-3 h-4 w-4"
                />
                <div>
                  <div className="font-medium text-gray-900">Municipal Admin</div>
                  <div className="text-xs text-gray-600">Manage entire municipality</div>
                </div>
              </label>
              <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.admin_role === 'barangay_admin' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="admin_role"
                  value="barangay_admin"
                  checked={formData.admin_role === 'barangay_admin'}
                  onChange={(e) => setFormData({ ...formData, admin_role: e.target.value as AdminRole })}
                  className="mr-3 h-4 w-4"
                />
                <div>
                  <div className="font-medium text-gray-900">Barangay Admin</div>
                  <div className="text-xs text-gray-600">Manage specific barangay</div>
                </div>
              </label>
            </div>
          </div>

          {/* Location Assignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Province <span className="text-red-500">*</span></label>
              <select
                className="input-field"
                value={formData.admin_province_id}
                onChange={(e) => setFormData({ ...formData, admin_province_id: e.target.value, admin_municipality_slug: '', admin_barangay_id: '' })}
                required
              >
                <option value="">— Select Province —</option>
                {provinces.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Municipality <span className="text-red-500">*</span></label>
              <select
                name="admin_municipality_slug"
                className="input-field"
                value={formData.admin_municipality_slug}
                onChange={(e)=>setFormData({...formData, admin_municipality_slug:e.target.value, admin_barangay_id: ''})}
                disabled={!formData.admin_province_id}
                required
              >
                <option value="">{!formData.admin_province_id ? 'Select province first' : '— Select Municipality —'}</option>
                {municipalities.map(m => (
                  <option key={m.slug} value={m.slug}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Barangay Selection - only for barangay_admin */}
            {formData.admin_role === 'barangay_admin' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Barangay <span className="text-red-500">*</span></label>
                <select
                  name="admin_barangay_id"
                  className="input-field"
                  value={formData.admin_barangay_id}
                  onChange={(e)=>setFormData({...formData, admin_barangay_id:e.target.value})}
                  disabled={!formData.admin_municipality_slug}
                  required={formData.admin_role === 'barangay_admin'}
                >
                  <option value="">{!formData.admin_municipality_slug ? 'Select municipality first' : '— Select Barangay —'}</option>
                  {barangays.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">This admin will only manage this specific barangay</p>
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Admin Secret Key <span className="text-red-500">*</span></label>
          <input name="admin_secret" type="password" className="input-field" value={formData.admin_secret} onChange={(e)=>setFormData({...formData, admin_secret:e.target.value})} required />
          <p className="text-xs text-gray-500 mt-1">This must match the server's ADMIN_SECRET_KEY.</p>
        </div>
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Creating...' : 'Create Admin'}</button>
      </form>
    </div>
  )
}


