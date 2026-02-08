import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import GatedAction from '@/components/GatedAction'
import { documentsApi } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { useCachedFetch } from '@/lib/useCachedFetch'
import { CACHE_KEYS, invalidateMultiple } from '@/lib/dataStore'
import Stepper from '@/components/ui/Stepper'
import { EmptyState } from '@munlink/ui'
import MunicipalitySelect from '@/components/MunicipalitySelect'
// pickup location is tied to resident profile; no remote fetch needed

const PURPOSE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'educational', label: 'Educational' },
  { value: 'employment', label: 'Employment' },
  { value: 'legal', label: 'Legal' },
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
]

const CIVIL_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' },
  { value: 'divorced', label: 'Divorced' },
]

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  big_business: 'Big Business',
  small_business: 'Small Business',
  banca_tricycle: 'Banca/Tricycle',
}

export default function DocumentsPage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const selectedProvince = useAppStore((s) => s.selectedProvince)
  const user = useAppStore((s) => s.user)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const isAuthBootstrapped = useAppStore((s) => s.isAuthBootstrapped)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [deliveryMethod, setDeliveryMethod] = useState<'digital' | 'pickup'>('digital')
  // deliveryAddress is derived server-side for pickup; no free-text field
  const [purposeType, setPurposeType] = useState('')
  const [purposeOther, setPurposeOther] = useState('')
  const [remarks, setRemarks] = useState('')
  const [civilStatus, setCivilStatus] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [age, setAge] = useState<string>('')
  // const [uploadForm, setUploadForm] = useState<FormData | null>(null)
  const [resultMsg, setResultMsg] = useState<string>('')
  const [createdId, setCreatedId] = useState<number | null>(null)
  const userBarangayName = (user as any)?.barangay_name // kept for review display and future use
  const [consent, setConsent] = useState(false)
  const [requirementFiles, setRequirementFiles] = useState<Record<string, File | null>>({})
  const [requirementsError, setRequirementsError] = useState<string>('')
  const [uploadingRequirements, setUploadingRequirements] = useState(false)
  const [requirementsUploaded, setRequirementsUploaded] = useState(false)
  const [feePreview, setFeePreview] = useState<any | null>(null)
  const [feeLoading, setFeeLoading] = useState(false)
  const [pickupLocation, setPickupLocation] = useState<'municipal'|'barangay'>('municipal')
  const [typeFilter, setTypeFilter] = useState<'all' | 'municipal' | 'barangay'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const userMunicipalityId = (user as any)?.municipality_id as number | undefined
  const userBarangayId = (user as any)?.barangay_id as number | undefined

  // Municipality scoping: Determine if location context is ready
  const guestLocationComplete = !isAuthenticated && !!selectedProvince?.id && !!selectedMunicipality?.id

  // Use cached fetch for document types (rarely changes)
  const { data: typesData, loading } = useCachedFetch(
    'document_types',
    () => documentsApi.getTypes({ municipality_id: userMunicipalityId, barangay_id: userBarangayId }),
    {
      staleTime: 30 * 60 * 1000,
      enabled: isAuthBootstrapped && isAuthenticated && !!userMunicipalityId,
      dependencies: [userMunicipalityId, userBarangayId]
    } // 30 minutes - document types rarely change
  )
  const types: Array<{ id: number; name: string; code: string; fee: number; processing_days: number; supports_digital: boolean; authority_level?: string; requirements?: string[]; fee_tiers?: Record<string, number>; exemption_rules?: Record<string, any> }> = (typesData as any)?.data?.types || []

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
    if (isAuthenticated && user && (user as any)?.municipality_id && (user as any)?.municipality_name) {
      const shouldSyncMunicipality = !selectedMunicipality || Number(selectedMunicipality?.id) !== Number((user as any)?.municipality_id)
      if (!shouldSyncMunicipality) return
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
      if (userProvName && (!selectedProvince || Number((user as any)?.province_id || 0) !== Number(selectedProvince?.id))) {
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

  useEffect(() => {
    setRequirementFiles({})
    setRequirementsError('')
    setRequirementsUploaded(false)
    setBusinessType('')
  }, [selectedTypeId])

  const selectedType = useMemo(() => types.find((t) => t.id === selectedTypeId) || null, [types, selectedTypeId])
  const requirements = useMemo(() => (selectedType?.requirements || []).filter(Boolean), [selectedType])
  const businessTypeRequired = useMemo(() => {
    const tiers = selectedType?.fee_tiers || {}
    return Object.keys(tiers).length > 0
  }, [selectedType])
  const requirementsReady = useMemo(() => {
    if (!requirements.length) return true
    return requirements.every((req) => requirementFiles[req])
  }, [requirements, requirementFiles])
  const filteredTypes = useMemo(() => {
    if (typeFilter === 'all') return types
    return types.filter((t) => (t as any).authority_level === typeFilter)
  }, [types, typeFilter])
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(filteredTypes.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pagedTypes = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredTypes.slice(start, start + pageSize)
  }, [filteredTypes, safePage])
  const digitalAllowed = useMemo(() => {
    if (!selectedType) return false
    return !!selectedType.supports_digital
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

  const purposeText = useMemo(() => {
    if (!purposeType) return ''
    if (purposeType === 'other') return purposeOther.trim()
    const match = PURPOSE_OPTIONS.find((opt) => opt.value === purposeType)
    return match?.label || purposeType
  }, [purposeType, purposeOther])
  const civilStatusLabel = useMemo(() => {
    if (!civilStatus) return ''
    const match = CIVIL_STATUS_OPTIONS.find((opt) => opt.value === civilStatus)
    return match?.label || civilStatus
  }, [civilStatus])

  useEffect(() => {
    let cancelled = false
    if (!isAuthenticated || !isAuthBootstrapped || !selectedTypeId) {
      setFeePreview(null)
      return
    }
    const loadPreview = async () => {
      setFeeLoading(true)
      try {
        const res = await documentsApi.calculateFee({
          document_type_id: selectedTypeId,
          purpose_type: purposeType || undefined,
          business_type: businessType || undefined,
          requirements_submitted: requirementsReady
        })
        // Handle axios response structure: { data: {...} }
        const responseData = (res as any)?.data || res
        if (!cancelled) setFeePreview(responseData)
      } catch (err) {
        console.error('Fee calculation error:', err)
        if (!cancelled) setFeePreview(null)
      } finally {
        if (!cancelled) setFeeLoading(false)
      }
    }
    loadPreview()
    return () => { cancelled = true }
  }, [isAuthenticated, isAuthBootstrapped, selectedTypeId, purposeType, businessType, requirementsReady])

  useEffect(() => {
    setCurrentPage(1)
  }, [typeFilter, types.length])

  const canSubmit = useMemo(() => {
    if (!selectedTypeId || !(user as any)?.municipality_id || !purposeText) return false
    if (!civilStatus) return false
    if (businessTypeRequired && !businessType) return false
    if (!requirementsReady) return false
    if (deliveryMethod === 'digital') return true
    // pickup requires barangay on profile
    return !!(user as any)?.barangay_id
  }, [selectedTypeId, (user as any)?.municipality_id, purposeText, civilStatus, businessTypeRequired, businessType, requirementsReady, deliveryMethod, (user as any)?.barangay_id])

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
            <div className="text-sm text-gray-600">Loading...</div>
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
                <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 mb-4">
                  <h2 className="text-xl font-bold">Select Document Type</h2>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Filter</label>
                    <select
                      className="input-field h-9 py-1"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as any)}
                    >
                      <option value="all">All</option>
                      <option value="municipal">Municipal</option>
                      <option value="barangay">Barangay</option>
                    </select>
                  </div>
                </div>
                {filteredTypes.length === 0 ? (
                  <div className="text-sm text-gray-600">No document types match this filter.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                      {pagedTypes.map((t) => (
                        <button
                          key={t.id}
                          className={`text-left p-4 rounded-xl border ${selectedTypeId===t.id?'border-ocean-500 bg-ocean-50':'border-gray-200 hover:border-ocean-300'}`}
                          onClick={() => {
                            setSelectedTypeId(t.id)
                            const allowDigital = !!(t as any).supports_digital
                            setDeliveryMethod(allowDigital ? 'digital' : 'pickup')
                          }}
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
                                  <div className="text-lg font-bold">PHP {Number(t.fee).toFixed(2)}</div>
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
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
                      <span>Page {safePage} of {totalPages} | {filteredTypes.length} documents</span>
                      <div className="flex items-center gap-2">
                        <button
                          className="btn-secondary px-3 py-1"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                        >
                          Prev
                        </button>
                        <button
                          className="btn-secondary px-3 py-1"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage >= totalPages}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
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
                      <option value="digital" disabled={!digitalAllowed}>
                        Digital {digitalAllowed ? (Number(selectedType?.fee || 0) > 0 ? '(Pay online after approval)' : '(Free)') : '(Not available)'}
                      </option>
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
                    <select
                      className="input-field"
                      value={purposeType}
                      onChange={(e) => setPurposeType(e.target.value)}
                    >
                      <option value="">Select purpose</option>
                      {PURPOSE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {purposeType === 'other' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Other Purpose</label>
                      <input
                        className="input-field"
                        value={purposeOther}
                        onChange={(e) => setPurposeOther(e.target.value)}
                        placeholder="Specify your purpose"
                      />
                    </div>
                  )}
                  {businessTypeRequired && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Business Type</label>
                      <select
                        className="input-field"
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                      >
                        <option value="">Select business type</option>
                        {Object.keys(selectedType?.fee_tiers || {}).map((key) => (
                          <option key={key} value={key}>{BUSINESS_TYPE_LABELS[key] || key}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1">Civil Status</label>
                    <select
                      className="input-field"
                      value={civilStatus}
                      onChange={(e) => setCivilStatus(e.target.value)}
                    >
                      <option value="">Select civil status</option>
                      {CIVIL_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Age (optional)</label>
                    <input className="input-field" type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g., 22" />
                  </div>
                  {requirements.length > 0 && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Requirements</label>
                      <div className="space-y-3">
                        {requirements.map((req) => (
                          <div key={req} className="rounded-lg border border-gray-200 p-3">
                            <div className="text-sm font-medium text-gray-800">{req}</div>
                            <div className="mt-2 flex items-center gap-3">
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null
                                  setRequirementFiles((prev) => ({ ...prev, [req]: file }))
                                  setRequirementsError('')
                                }}
                              />
                              {requirementFiles[req] && (
                                <span className="text-xs text-gray-600">
                                  {requirementFiles[req]?.name}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {requirementsError && (
                        <div className="text-xs text-red-600 mt-2">{requirementsError}</div>
                      )}
                      <div className="text-xs text-gray-600 mt-2">
                        Required documents must be uploaded per request to qualify for exemptions.
                      </div>
                      {!requirementsReady && (
                        <div className="text-xs text-amber-700 mt-1">
                          Please upload all required documents to continue.
                        </div>
                      )}
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Remarks or Additional Information</label>
                    <textarea className="input-field" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Provide extra context to help process your request" />
                    <div className="text-xs text-gray-600 mt-1">Provide extra context or clarifications that may help the office process your request.</div>
                  </div>
                </div>
                {isAuthenticated && selectedTypeId && (
                  <div className="mt-4 rounded-lg border bg-gray-50 p-3 text-sm">
                    <div className="font-medium text-gray-700 mb-2">Fee Preview</div>
                    {feeLoading ? (
                      <div className="text-gray-600">Calculating...</div>
                    ) : feePreview?.fee_calculation ? (
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Original Fee</span>
                          <span>PHP {Number(feePreview.fee_calculation.original_fee ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Final Fee</span>
                          <span className="font-semibold">PHP {Number(feePreview.fee_calculation.final_fee ?? 0).toFixed(2)}</span>
                        </div>
                        {feePreview.fee_calculation.exemption_type && (
                          <div className="text-xs text-green-700">
                            Exempted: {String(feePreview.fee_calculation.exemption_type).toUpperCase()}
                          </div>
                        )}
                        {requirements.length > 0 && !requirementsReady && (
                          <div className="text-xs text-amber-700">
                            Upload all required documents to qualify for exemptions.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-600">Fee preview unavailable.</div>
                    )}
                  </div>
                )}
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
                  <div><span className="font-medium">Municipality:</span> {isMismatch ? `${selectedMunicipality?.name} (viewing) - Submission: ${userMunicipalityName || 'Your municipality'}` : (selectedMunicipality?.name || userMunicipalityName || '')}</div>
                  <div><span className="font-medium">Delivery:</span> {deliveryMethod}{deliveryMethod==='pickup' ? (pickupLocation==='municipal' ? ` - ${(user as any)?.municipality_name || ''} Municipal` : ` - Barangay ${(user as any)?.barangay_name || ''}`) : ''}</div>
                  <div><span className="font-medium">Purpose:</span> {purposeText}</div>
                  {civilStatusLabel && <div><span className="font-medium">Civil Status:</span> {civilStatusLabel}</div>}
                  {businessType && <div><span className="font-medium">Business Type:</span> {BUSINESS_TYPE_LABELS[businessType] || businessType}</div>}
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
                      if (requirements.length > 0 && !requirementsReady) {
                        setRequirementsError('Please upload all required documents before submitting.')
                        return
                      }
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
                          purpose: purposeText,
                          purpose_type: purposeType || undefined,
                          purpose_other: purposeType === 'other' ? (purposeOther || undefined) : undefined,
                          business_type: businessType || undefined,
                          civil_status: civilStatus || undefined,
                          age: (age && !Number.isNaN(Number(age))) ? Number(age) : undefined,
                          remarks: remarks || undefined,
                          requirements_submitted: requirementsReady,
                        })
                        const id = res?.data?.request?.id
                        setCreatedId(id || null)

                        if (id && requirements.length > 0 && requirementsReady) {
                          try {
                            setUploadingRequirements(true)
                            const form = new FormData()
                            requirements.forEach((req) => {
                              const file = requirementFiles[req]
                              if (file) {
                                form.append('file', file)
                                form.append('requirement', req)
                              }
                            })
                            await documentsApi.uploadSupportingDocs(id, form)
                            setRequirementsUploaded(true)
                          } catch (uploadErr: any) {
                            setResultMsg(uploadErr?.response?.data?.error || 'Failed to upload requirements')
                            return
                          } finally {
                            setUploadingRequirements(false)
                          }
                        }

                        setResultMsg('Request created successfully')
                        // Invalidate caches to reflect new request immediately
                        invalidateMultiple([CACHE_KEYS.DOCUMENT_REQUESTS])
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
                    <button className="btn btn-primary w-full xs:w-auto" disabled={!canSubmit || submitting || uploadingRequirements || isMismatch || !consent} title={isMismatch ? 'Requests are limited to your registered municipality' : undefined}>
                      {submitting || uploadingRequirements ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </GatedAction>
                </div>
                {resultMsg && (
                  <div className="mt-4 text-sm text-gray-700">
                    {resultMsg}
                    {createdId && requirements.length > 0 && !requirementsUploaded && (
                      <div className="mt-3">
                        <div className="font-medium mb-2">Upload required documents</div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={uploadingRequirements}
                          onClick={async () => {
                            setRequirementsError('')
                            try {
                              setUploadingRequirements(true)
                              const form = new FormData()
                              requirements.forEach((req) => {
                                const file = requirementFiles[req]
                                if (file) {
                                  form.append('file', file)
                                  form.append('requirement', req)
                                }
                              })
                              await documentsApi.uploadSupportingDocs(createdId, form)
                              setRequirementsUploaded(true)
                              setResultMsg('Requirements uploaded successfully')
                            } catch (err: any) {
                              setResultMsg(err?.response?.data?.error || 'Failed to upload requirements')
                            } finally {
                              setUploadingRequirements(false)
                            }
                          }}
                        >
                          {uploadingRequirements ? 'Uploading...' : 'Upload Requirements'}
                        </button>
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
