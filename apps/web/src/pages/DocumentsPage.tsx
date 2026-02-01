import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import GatedAction from '@/components/GatedAction'
import { documentsApi } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { useCachedFetch } from '@/lib/useCachedFetch'
import { CACHE_KEYS } from '@/lib/dataStore'
import Stepper from '@/components/ui/Stepper'
import FileUploader from '@/components/ui/FileUploader'
import { EmptyState } from '@munlink/ui'
import MunicipalitySelect from '@/components/MunicipalitySelect'
// pickup location is tied to resident profile; no remote fetch needed

export default function DocumentsPage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const selectedProvince = useAppStore((s) => s.selectedProvince)
  const user = useAppStore((s) => s.user)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [deliveryMethod, setDeliveryMethod] = useState<'digital' | 'pickup'>('digital')
  // deliveryAddress is derived server-side for pickup; no free-text field
  const [purpose, setPurpose] = useState('')
  const [remarks, setRemarks] = useState('')
  const [civilStatus, setCivilStatus] = useState('')
  const [age, setAge] = useState<string>('')
  // const [uploadForm, setUploadForm] = useState<FormData | null>(null)
  const [resultMsg, setResultMsg] = useState<string>('')
  const [createdId, setCreatedId] = useState<number | null>(null)
  const userBarangayName = (user as any)?.barangay_name // kept for review display and future use
  const [consent, setConsent] = useState(false)
  const [pickupLocation, setPickupLocation] = useState<'municipal'|'barangay'>('municipal')

  // Municipality scoping: Determine if location context is ready
  const guestLocationComplete = !isAuthenticated && !!selectedProvince?.id && !!selectedMunicipality?.id

  // Use cached fetch for document types (rarely changes)
  const { data: typesData, loading } = useCachedFetch(
    'document_types',
    () => documentsApi.getTypes(),
    { staleTime: 30 * 60 * 1000 } // 30 minutes - document types rarely change
  )
  const types: Array<{ id: number; name: string; code: string; fee: number; processing_days: number; supports_digital: boolean }> = (typesData as any)?.data?.types || []

  // Check if tab is requests
  const isRequestsTab = (searchParams.get('tab') || '').toLowerCase() === 'requests'

  // Use cached fetch for my requests (only when on requests tab)
  const { data: myRequestsData, loading: loadingMy } = useCachedFetch(
    CACHE_KEYS.DOCUMENT_REQUESTS,
    () => documentsApi.getMyRequests(),
    { enabled: isAuthenticated && isRequestsTab, staleTime: 2 * 60 * 1000 }
  )
  const myRequests = (myRequestsData as any)?.data?.requests || (myRequestsData as any)?.requests || []

  // Auto-select user's registered municipality if authenticated and no municipality is selected
  useEffect(() => {
    if (isAuthenticated && user && !selectedMunicipality && (user as any)?.municipality_id && (user as any)?.municipality_name) {
      // Set municipality from user's registered data
      const { setMunicipality, setProvince } = useAppStore.getState()
      const userMunId = (user as any).municipality_id
      const userMunName = (user as any).municipality_name
      const userProvName = (user as any).province_name
      
      // Create municipality object from user data
      setMunicipality({
        id: userMunId,
        name: userMunName,
        slug: (user as any).municipality_slug || userMunName.toLowerCase().replace(/\s+/g, '-'),
      } as any)
      
      // Also set province if available
      if (userProvName && !selectedProvince) {
        setProvince({
          id: (user as any).province_id || 0,
          name: userProvName,
          slug: (user as any).province_slug || userProvName.toLowerCase().replace(/\s+/g, '-'),
        } as any)
      }
    }
  }, [isAuthenticated, user, selectedMunicipality, selectedProvince])

  // Initialize pickup selection from user profile
  useEffect(() => {
    setPickupLocation(((user as any)?.barangay_id ? 'barangay' : 'municipal'))
  }, [(user as any)?.municipality_id, (user as any)?.barangay_id])

  const selectedType = useMemo(() => types.find((t) => t.id === selectedTypeId) || null, [types, selectedTypeId])
  const digitalAllowed = useMemo(() => {
    if (!selectedType) return false
    const fee = Number(selectedType.fee || 0)
    return !!selectedType.supports_digital && fee <= 0
  }, [selectedType])
  // Check for mismatch - compare by ID (static data now uses real database IDs)
  const isMismatch = useMemo(() => {
    const userMunId = (user as any)?.municipality_id
    const selectedMunId = selectedMunicipality?.id
    if (!userMunId || !selectedMunId) return false
    // Compare as numbers to handle string/number type differences
    return Number(userMunId) !== Number(selectedMunId)
  }, [user, selectedMunicipality?.id])
  const userMunicipalityName = (user as any)?.municipality_name

  const canSubmit = useMemo(() => {
    if (!selectedTypeId || !(user as any)?.municipality_id || !purpose) return false
    if (deliveryMethod === 'digital') return true
    // pickup requires barangay on profile
    return !!(user as any)?.barangay_id
  }, [selectedTypeId, (user as any)?.municipality_id, purpose, deliveryMethod, (user as any)?.barangay_id])

  return (
    <div className="container-responsive py-12">
      <div className="mb-6">
        <h1 className="text-fluid-3xl font-serif font-semibold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-600">Request documents for your selected municipality.</p>
      </div>

      {/* Guest Location Required Message */}
      {!isAuthenticated && !guestLocationComplete && (
        <div className="mb-4 p-4 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-900">
          <p><strong>Select your location</strong> to browse available documents. Use the location selector in the header to choose your province and municipality. Document requests require an account.</p>
        </div>
      )}
      { (searchParams.get('tab') || '').toLowerCase() === 'requests' && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">My Requests</h2>
            <button className="btn-secondary" onClick={() => navigate('/documents')}>New Request</button>
          </div>
          {loadingMy ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : myRequests.length === 0 ? (
            <EmptyState
              icon="document"
              title="No requests yet"
              description="You haven't submitted any document requests. Start by selecting a document type."
              compact
            />
          ) : (
            <div className="space-y-2">
              {myRequests.map((r: any) => (
                <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-1 sm:gap-3 rounded-lg border px-3 py-2 items-center">
                  <div className="min-w-0">
                    <Link to={`/dashboard/requests/${r.id}`} className="block font-medium text-blue-700 hover:underline truncate">
                      {r.document_type?.name || r.request_number || 'Document Request'}
                    </Link>
                    <div className="text-xs text-gray-600 truncate">{r.request_number}</div>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end shrink-0">
                    <span className="px-2.5 py-1 text-xs rounded-full ring-1 bg-gray-100 text-gray-700 capitalize">{r.status}</span>
                    <Link to={`/dashboard/requests/${r.id}`} className="btn-ghost text-blue-700">Open</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {isMismatch && (
        <div className="mb-4 p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
          You are viewing <strong>{selectedMunicipality?.name}</strong>. Document requests will be submitted to your registered municipality: <strong>{userMunicipalityName || 'Your municipality'}</strong>.
        </div>
      )}
      {/* Only show skeleton on first load when no cached data */}
      {loading && types.length === 0 ? (
          <div className="bg-white rounded-lg border p-4">
            <Stepper steps={["Type","Details","Review"]} current={step} />
            <h2 className="text-xl font-bold mb-4">Select Document Type</h2>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-card p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="h-5 w-2/3 skeleton rounded" />
                      <div className="h-4 w-1/2 skeleton rounded" />
                    </div>
                    <div className="ml-4 text-right space-y-1">
                      <div className="h-4 w-12 skeleton rounded" />
                      <div className="h-6 w-16 skeleton rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <div className="h-10 w-28 skeleton rounded-lg" />
            </div>
          </div>
        ) : !loading && types.length === 0 ? (
          <div className="bg-white rounded-lg border p-4">
            <Stepper steps={["Type","Details","Review"]} current={step} />
            <EmptyState
              icon="document"
              title="No document types available"
              description={!selectedMunicipality 
                ? "Please select a municipality to view available document types."
                : "No document types have been configured for this municipality yet. Check back later."}
            />
          </div>
        ) : (
          <div className="bg-white rounded-lg border p-4">
            <Stepper steps={["Type","Details","Review"]} current={step} />

            {/* Step 1: Select Type */}
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold mb-4">Select Document Type</h2>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                  {types.map((t) => (
                    <button
                      key={t.id}
                      className={`text-left p-4 rounded-xl border ${selectedTypeId===t.id?'border-ocean-500 bg-ocean-50':'border-gray-200 hover:border-ocean-300'}`}
                      onClick={() => { setSelectedTypeId(t.id); const fee = Number(t.fee||0); const allowDigital = !!t.supports_digital && fee<=0; setDeliveryMethod(allowDigital? 'digital':'pickup') }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{t.name}</h3>
                          <p className="text-sm text-gray-600">Processing: {t.processing_days} days</p>
                        </div>
                        <div className="text-right">
                          {Number(t.fee || 0) > 0 ? (
                            <>
                              <div className="text-sm text-gray-700">Fee</div>
                              <div className="text-lg font-bold">₱{Number(t.fee).toFixed(2)}</div>
                            </>
                          ) : (
                            <div className="mt-1 text-xs">
                              {t.supports_digital ? (
                                <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">Free digital copy</span>
                              ) : (
                                <span className="inline-block rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">Pickup only</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <GatedAction
                    required="fullyVerified"
                    onAllowed={() => {
                      if (!selectedTypeId) return
                      if (isAuthenticated && !selectedMunicipality) return
                      setStep(2)
                    }}
                    featureDescription="Request a document from your municipality"
                  >
                    <button 
                      className="btn-primary inline-flex items-center gap-2" 
                      disabled={isAuthenticated && (!selectedTypeId || !selectedMunicipality)}
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </GatedAction>
                </div>
                {isAuthenticated && !selectedMunicipality && (
                  <div className="mt-2 text-xs text-amber-700 text-right">Please select a municipality above to continue.</div>
                )}
              </div>
            )}

            {/* Step 2: Details */}
            {step === 2 && (
              <div>
                <h2 className="text-xl font-bold mb-4">Request Details</h2>
                {(!selectedProvince || !selectedMunicipality) && (
                  <div className="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 text-sm text-red-900">
                    <strong>Location Required:</strong> Please select a province and municipality using the selectors at the top of this page before continuing.
                  </div>
                )}
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Municipality</label>
                    {selectedMunicipality ? (
                      <input className="input-field" value={selectedMunicipality.name} disabled title={(user as any)?.municipality_id && selectedMunicipality?.id && (user as any).municipality_id !== selectedMunicipality.id ? 'Viewing other municipality. Submissions go to your registered municipality.' : ''} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <input className="input-field flex-1" value="" placeholder="No municipality selected" disabled />
                        <MunicipalitySelect />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Delivery Method</label>
                    <select className="input-field" value={digitalAllowed ? deliveryMethod : 'pickup'} onChange={(e) => setDeliveryMethod(e.target.value as any)}>
                      <option value="digital" disabled={!digitalAllowed}>Digital {digitalAllowed? '(Free)': '(Not available)'}</option>
                      <option value="pickup">Pickup</option>
                    </select>
                    {!digitalAllowed && (
                      <div className="text-xs text-gray-600 mt-1">This document can only be requested in person at the LGU.</div>
                    )}
                  </div>
                  {deliveryMethod === 'pickup' && (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1">Location</label>
                        <select
                          className="input-field"
                          value={pickupLocation}
                          onChange={(e)=> setPickupLocation(e.target.value as any)}
                        >
                          <option value="municipal">{`${(user as any)?.municipality_name || ''} Municipal`}</option>
                          {(user as any)?.barangay_id && (
                            <option value="barangay">{`Barangay ${userBarangayName || ''}`}</option>
                          )}
                        </select>
                        {!((user as any)?.barangay_id) && (
                          <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1 mt-1">Add your barangay in your Profile to request documents.</div>
                        )}
                      </div>
                    </>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Purpose</label>
                    <input className="input-field" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g., employment requirement" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Civil Status (optional)</label>
                    <input className="input-field" value={civilStatus} onChange={(e) => setCivilStatus(e.target.value)} placeholder="e.g., single" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Age (optional)</label>
                    <input className="input-field" type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g., 22" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Remarks or Additional Information</label>
                    <textarea className="input-field" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Provide extra context to help process your request" />
                    <div className="text-xs text-gray-600 mt-1">Provide extra context or clarifications that may help the office process your request.</div>
                  </div>
                </div>
                <div className="mt-6 flex flex-col xs:flex-row gap-3 xs:justify-between">
                  <button className="btn btn-secondary w-full xs:w-auto inline-flex items-center gap-2" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    <span>Back</span>
                  </button>
                  <button className="btn btn-primary w-full xs:w-auto inline-flex items-center gap-2" onClick={() => setStep(3)} disabled={!canSubmit || isMismatch || !selectedMunicipality}>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {step === 3 && (
              <div>
                <h2 className="text-xl font-bold mb-4">Review & Submit</h2>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Type:</span> {selectedType?.name}</div>
                  <div><span className="font-medium">Municipality:</span> {isMismatch ? `${selectedMunicipality?.name} (viewing) • Submission: ${userMunicipalityName || 'Your municipality'}` : (selectedMunicipality?.name || userMunicipalityName || '')}</div>
                  <div><span className="font-medium">Delivery:</span> {deliveryMethod}{deliveryMethod==='pickup' ? (pickupLocation==='municipal' ? ` • ${(user as any)?.municipality_name || ''} Municipal` : ` • Barangay ${(user as any)?.barangay_name || ''}`) : ''}</div>
                  <div><span className="font-medium">Purpose:</span> {purpose}</div>
                  {civilStatus && <div><span className="font-medium">Civil Status:</span> {civilStatus}</div>}
                  {age && <div><span className="font-medium">Age:</span> {age}</div>}
                  {remarks && <div><span className="font-medium">Remarks:</span> {remarks}</div>}
                </div>
                {deliveryMethod==='digital' && (
                  <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-2">Digital copies are free and include a QR code for verification.</div>
                )}
                <label className="mt-4 flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={consent} onChange={(e)=>setConsent(e.target.checked)} />
                  <span>I confirm the information provided is true and I consent to its processing for document issuance.</span>
                </label>
                <div className="mt-6 flex flex-col xs:flex-row gap-3 xs:justify-between items-stretch xs:items-center">
                  <button className="btn btn-secondary w-full xs:w-auto inline-flex items-center gap-2" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    <span>Back</span>
                  </button>
                  <GatedAction
                    required="fullyVerified"
                    onAllowed={async () => {
                      if (submitting) return
                      if (isMismatch || !(user as any)?.municipality_id || !selectedTypeId) return
                      setSubmitting(true)
                      setResultMsg('')
                      try {
                        const res = await documentsApi.createRequest({
                          document_type_id: selectedTypeId,
                          municipality_id: (user as any)!.municipality_id as number,
                          delivery_method: deliveryMethod,
                          // delivery_address is derived server-side for pickup
                          pickup_location: pickupLocation,
                          barangay_id: (pickupLocation==='barangay' ? (user as any)?.barangay_id : undefined) as any,
                          purpose,
                          civil_status: civilStatus || undefined,
                          age: (age && !Number.isNaN(Number(age))) ? Number(age) : undefined,
                          remarks: remarks || undefined,
                        })
                        const id = res?.data?.request?.id
                        setCreatedId(id || null)
                        setResultMsg('Request created successfully')
                        // Redirect to dashboard with a flash toast
                        navigate('/dashboard', {
                          replace: true,
                          state: {
                            toast: {
                              type: 'success',
                              message: 'Your document request has been submitted successfully.'
                            }
                          }
                        })
                      } catch (e: any) {
                        setResultMsg(e?.response?.data?.error || 'Failed to create request')
                      } finally {
                        setSubmitting(false)
                      }
                    }}
                    tooltip="Login required to use this feature"
                  >
                    <button className="btn btn-primary w-full xs:w-auto" disabled={!canSubmit || submitting || isMismatch || !consent} title={isMismatch ? 'Requests are limited to your registered municipality' : undefined}>
                      {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </GatedAction>
                </div>
                {resultMsg && (
                  <div className="mt-4 text-sm text-gray-700">
                    {resultMsg}
                    {createdId && (
                      <div className="mt-3">
                        <div className="font-medium mb-1">Upload supporting documents (optional)</div>
                        <FileUploader
                          accept="image/*,.pdf"
                          multiple
                          onFiles={async (files) => {
                            const form = new FormData()
                            files.forEach((f) => form.append('file', f))
                            try {
                              await documentsApi.uploadSupportingDocs(createdId, form)
                              setResultMsg('Files uploaded successfully')
                            } catch {
                              setResultMsg('Upload failed')
                            }
                          }}
                          label="Upload files"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
    </div>
  )
}


