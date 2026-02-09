import { StatusBadge, Card, EmptyState } from '@munlink/ui'
import { useEffect, useState, useMemo } from 'react'
import { ArrowRight, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import GatedAction from '@/components/GatedAction'
import { useAppStore } from '@/lib/store'
import { authApi, benefitsApi, mediaUrl } from '@/lib/api'
import { useCachedFetch } from '@/lib/useCachedFetch'
import { CACHE_KEYS, invalidateMultiple } from '@/lib/dataStore'
import Modal from '@/components/ui/Modal'
import Stepper from '@/components/ui/Stepper'
import FileUploader from '@/components/ui/FileUploader'

type Program = {
  id: string | number
  name: string
  summary?: string
  description?: string
  municipality?: string
  eligibility?: string[]
  eligibility_criteria?: string[]
  requirements?: string[]
  required_documents?: string[]
}

export default function ProgramsPage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const selectedProvince = useAppStore((s) => s.selectedProvince)
  const user = useAppStore((s) => s.user)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const [typeFilter, setTypeFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [selected, setSelected] = useState<Program | null>(null)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [tab, setTab] = useState<'programs'|'applications'>('programs')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [uploadingDocs, setUploadingDocs] = useState(false)
  const [pendingApplicationId, setPendingApplicationId] = useState<number | null>(null)
  const [retryTarget, setRetryTarget] = useState<any | null>(null)
  const [retryFiles, setRetryFiles] = useState<File[]>([])
  const [retrySubmitting, setRetrySubmitting] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [applicationsNotice, setApplicationsNotice] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const [openId, setOpenId] = useState<string | number | null>(null)
  
  // Municipality scoping logic
  // Logged-in users: Can ONLY see programs from their registered municipality
  // Guests: Must select province AND municipality before programs load
  const userMunicipalityId = (user as any)?.municipality_id
  const userMunicipalityName = (user as any)?.municipality_name
  const effectiveMunicipalityId = isAuthenticated && userMunicipalityId 
    ? userMunicipalityId  // Force user's municipality for logged-in users
    : selectedMunicipality?.id  // Allow selection for guests
  
  // For guests: Check if location is fully selected
  const guestHasProvince = !isAuthenticated && !!selectedProvince?.id
  const guestHasMunicipality = !isAuthenticated && !!selectedMunicipality?.id
  const guestLocationComplete = guestHasProvince && guestHasMunicipality
  
  // Should we fetch programs?
  // - Logged-in users: Always fetch (their municipality is known)
  // - Guests: Only fetch if both province AND municipality are selected
  const shouldFetchPrograms = isAuthenticated || guestLocationComplete
  
  const [eligibilityCheck, setEligibilityCheck] = useState<{
    age: { passed: boolean; message: string; required: boolean }
    location: { passed: boolean; message: string; required: boolean }
    hasTags: boolean
    overall: boolean
  } | null>(null)
  const [additionalEligibilityData, setAdditionalEligibilityData] = useState<Record<string, any>>({})
  const [userProfile, setUserProfile] = useState<any>(null)
  
  // Fetch full user profile when modal opens to get date_of_birth
  useEffect(() => {
    if (open && selected && isAuthenticated) {
      const fetchProfile = async () => {
        try {
          const profileRes = await authApi.getProfile()
          const profileData = (profileRes as any).data || profileRes
          setUserProfile(profileData)
        } catch (e) {
          console.error('Failed to fetch user profile:', e)
          setUserProfile(user) // Fallback to store user
        }
      }
      fetchProfile()
    }
  }, [open, selected, isAuthenticated])

  // Use cached fetch for programs
  // For logged-in users, API will enforce their municipality server-side
  // For guests, only fetch when both province AND municipality are selected
  const { data: programsData, loading: programsLoading } = useCachedFetch(
    CACHE_KEYS.BENEFITS_PROGRAMS,
    () => {
      const params: any = {}
      // Only pass municipality_id for guests - backend ignores it for logged-in users anyway
      if (!isAuthenticated && effectiveMunicipalityId) {
        params.municipality_id = effectiveMunicipalityId
      }
      if (typeFilter !== 'all') params.type = typeFilter
      return benefitsApi.getPrograms(params)
    },
    { 
      dependencies: [effectiveMunicipalityId, typeFilter, isAuthenticated], 
      staleTime: 5 * 60 * 1000,
      enabled: shouldFetchPrograms  // Only fetch when location is ready
    }
  )
  const programs = shouldFetchPrograms ? ((programsData as any)?.data?.programs || []) : []

  // Use cached fetch for my applications
  const { data: applicationsData, loading: applicationsLoading, refetch: refetchApplications } = useCachedFetch(
    CACHE_KEYS.MY_APPLICATIONS,
    () => benefitsApi.getMyApplications(),
    { enabled: isAuthenticated, staleTime: 2 * 60 * 1000 }
  )
  const applications = (applicationsData as any)?.data?.applications || []
  const appliedProgramIds = useMemo(() => {
    const ids = new Set<number>()
    applications.forEach((application: any) => {
      const value = Number(application?.program_id ?? application?.program?.id)
      if (Number.isFinite(value) && value > 0) ids.add(value)
    })
    return ids
  }, [applications])

  const loading = tab === 'programs' ? programsLoading : applicationsLoading

  // Initialize tab from query param (?tab=applications)
  useEffect(() => {
    const t = (searchParams.get('tab') || '').toLowerCase()
    if (t === 'applications') setTab('applications')
  }, [searchParams])

  const toStringArray = (value: any): string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean)
    }
    if (typeof value === 'string') {
      const raw = value.trim()
      if (!raw) return []
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item || '').trim()).filter(Boolean)
        }
      } catch {
        // keep raw value fallback
      }
      return [raw]
    }
    return []
  }

  // Helper function to safely get requirements array
  const getRequirementsArray = (program: Program | null): string[] => {
    if (!program) return []
    const requirements = (program as any).requirements ?? (program as any).required_documents
    return toStringArray(requirements)
  }

  const getSupportingDocumentsArray = (application: any): string[] =>
    toStringArray(application?.supporting_documents)

  const getMissingRequiredDocumentsCount = (application: any): number => {
    const required = getRequirementsArray((application?.program || null) as Program | null)
    const uploaded = getSupportingDocumentsArray(application)
    return Math.max(0, required.length - uploaded.length)
  }

  const selectedRequiredDocuments = useMemo(() => getRequirementsArray(selected), [selected])
  const selectedMissingRequiredCount = Math.max(0, selectedRequiredDocuments.length - uploadedFiles.length)
  const selectedHasIncompleteRequiredDocs = selectedRequiredDocuments.length > 0 && selectedMissingRequiredCount > 0

  // Check eligibility automatically when modal opens - using tag-based system
  const checkEligibility = useMemo(() => {
    const currentUser = userProfile || user
    if (!selected || !currentUser) return null
    
    const criteria = (selected as any).eligibility_criteria
    let ageCheck = { passed: true, message: 'Age requirement: Not required', required: false }
    let locationCheck = { passed: true, message: 'Location requirement: Not required', required: false }
    
    // Parse criteria - handle tag-based format
    let parsedCriteria: any = null
    if (typeof criteria === 'string') {
      try {
        parsedCriteria = JSON.parse(criteria)
      } catch {
        parsedCriteria = null
      }
    } else {
      parsedCriteria = criteria
    }
    
    // If no eligibility tags exist, program is open to all
    if (!parsedCriteria || (typeof parsedCriteria === 'object' && Object.keys(parsedCriteria).length === 0)) {
      return {
        age: { passed: true, message: 'Age requirement: Not required', required: false },
        location: { passed: true, message: 'Location requirement: Not required', required: false },
        hasTags: false,
        overall: true
      }
    }
    
    // Handle tag-based format
    if (typeof parsedCriteria === 'object' && !Array.isArray(parsedCriteria)) {
      // Age Tag Check
      if ('age_min' in parsedCriteria || 'age' in parsedCriteria) {
        ageCheck.required = true
        const userDob = (currentUser as any).date_of_birth
        if (!userDob) {
          ageCheck.passed = false
          ageCheck.message = '❌ Does not meet age requirement (Date of birth is required)'
        } else {
          const today = new Date()
          const birthDate = new Date(userDob)
          let age = today.getFullYear() - birthDate.getFullYear()
          const monthDiff = today.getMonth() - birthDate.getMonth()
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--
          }
          
          const minAge = parsedCriteria.age_min || (typeof parsedCriteria.age === 'number' ? parsedCriteria.age : null)
          const maxAge = parsedCriteria.age_max || null
          
          if (minAge !== null) {
            if (maxAge !== null) {
              ageCheck.passed = age >= minAge && age <= maxAge
              ageCheck.message = ageCheck.passed
                ? `✅ Meets age requirement (${age} years old, required: ${minAge}-${maxAge})`
                : `❌ Does not meet age requirement (${age} years old, required: ${minAge}-${maxAge})`
            } else {
              ageCheck.passed = age >= minAge
              ageCheck.message = ageCheck.passed
                ? `✅ Meets age requirement (${age} years old, minimum ${minAge})`
                : `❌ Does not meet age requirement (${age} years old, minimum ${minAge} required)`
            }
          }
        }
      }
      
      // Location Tag Check
      if ('location_required' in parsedCriteria && parsedCriteria.location_required === true) {
        locationCheck.required = true
        const userMunicipalityId = (currentUser as any).municipality_id
        const programMunicipalityId = (selected as any).municipality_id
        
        if (!userMunicipalityId) {
          locationCheck.passed = false
          locationCheck.message = '❌ Not registered in required municipality (Municipality information required)'
        } else if (programMunicipalityId && userMunicipalityId !== programMunicipalityId) {
          locationCheck.passed = false
          locationCheck.message = '❌ Not registered in required municipality'
        } else {
          locationCheck.passed = true
          locationCheck.message = '✅ Registered in required municipality'
        }
      }
    }
    
    const overall = (!ageCheck.required || ageCheck.passed) && 
                    (!locationCheck.required || locationCheck.passed)
    
    return {
      age: ageCheck,
      location: locationCheck,
      hasTags: !!(parsedCriteria && Object.keys(parsedCriteria).length > 0),
      overall
    }
  }, [selected, user, userProfile])

  // Update eligibility check when modal opens
  useEffect(() => {
    if (open && selected) {
      setEligibilityCheck(checkEligibility)
      setStep(1)
      setAdditionalEligibilityData({})
      setUploadedFiles([])
      setPendingApplicationId(null)
      setResult(null)
    }
  }, [open, selected, checkEligibility])

  const closeRetryModal = () => {
    setRetryTarget(null)
    setRetryFiles([])
    setRetryError(null)
    setRetrySubmitting(false)
  }

  const submitRetryDocuments = async () => {
    if (!retryTarget) return
    if (retryFiles.length === 0) {
      setRetryError('Please upload at least one document before submitting.')
      return
    }

    setRetrySubmitting(true)
    setRetryError(null)
    try {
      const formData = new FormData()
      retryFiles.forEach((file) => formData.append('file', file))
      await benefitsApi.uploadDocs(Number(retryTarget.id), formData)

      const currentStatus = String(retryTarget.status || '').toLowerCase()
      if (currentStatus === 'rejected') {
        await benefitsApi.resubmitApplication(Number(retryTarget.id))
        setApplicationsNotice('Documents uploaded. Your application was resubmitted for review.')
      } else {
        setApplicationsNotice('Documents uploaded successfully.')
      }

      closeRetryModal()
      await refetchApplications()
      invalidateMultiple([CACHE_KEYS.MY_APPLICATIONS])
    } catch (e: any) {
      const errorMsg = e?.response?.data?.error || e?.message || 'Failed to upload required documents'
      setRetryError(errorMsg)
    } finally {
      setRetrySubmitting(false)
    }
  }

  return (
    <div className="container-responsive py-12">
      <div className="mb-3">
        <h1 className="text-fluid-3xl font-serif font-semibold">Programs with Benefits</h1>
        <p className="text-gray-600">Explore available programs. You can view details without logging in; applying requires an account.</p>
      </div>

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Type</label>
            <select className="input-field" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="financial">Financial</option>
              <option value="educational">Educational</option>
              <option value="health">Health</option>
              <option value="livelihood">Livelihood</option>
            </select>
          </div>
          <div className="flex items-center gap-2 md:ml-auto">
            <button className={`btn ${tab==='programs'?'btn-primary':'btn-secondary'}`} onClick={() => setTab('programs')}>Programs</button>
            <GatedAction
              required="fullyVerified"
              onAllowed={() => setTab('applications')}
              featureDescription="View your benefit program applications"
            >
              <button className={`btn ${tab==='applications'?'btn-primary':'btn-secondary'}`}>My Applications</button>
            </GatedAction>
          </div>
        </div>
      </Card>

      {/* Municipality scoping information */}
      {isAuthenticated && userMunicipalityName && (
        <div className="mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-900">
          <strong>Showing programs for:</strong> {userMunicipalityName}
          <span className="text-blue-600 ml-2">(your registered municipality)</span>
        </div>
      )}
      {!isAuthenticated && guestLocationComplete && (
        <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
          <strong>Browsing programs in:</strong> {selectedMunicipality?.name}
          <span className="text-gray-500 ml-2">(Sign in to apply for programs in your registered municipality)</span>
        </div>
      )}

      {/* Guest location selection prompts */}
      {!isAuthenticated && !guestHasProvince && tab === 'programs' && (
        <div className="py-12">
          <EmptyState 
            icon="location"
            title="Select a Location" 
            description="Please select a province and municipality from the header to browse available programs in your area."
          />
        </div>
      )}
      {!isAuthenticated && guestHasProvince && !guestHasMunicipality && tab === 'programs' && (
        <div className="py-12">
          <EmptyState 
            icon="location"
            title="Select a Municipality" 
            description={`You've selected ${selectedProvince?.name}. Please select a municipality from the header to view available programs.`}
          />
        </div>
      )}

      {/* Only show content when location is ready (or user is authenticated) */}
      {shouldFetchPrograms && (
        <>
          {/* Only show skeleton on first load when no cached data */}
          {loading && (tab === 'programs' ? programs.length === 0 : applications.length === 0) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-card h-40" />
              ))}
            </div>
          ) : tab==='programs' ? (
            programs.length === 0 ? (
              <EmptyState title="No Programs Available" description="There are no programs available in this municipality at the moment. Check back later." />
            ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((p: Program) => {
              const desc = (p as any).description || p.summary || ''
              const eligibility = (p.eligibility || (p as any).eligibility_criteria || []) as string[]
              const requirements = getRequirementsArray(p)
              const alreadyApplied = appliedProgramIds.has(Number(p.id))
              const img = (p as any).image_path ? mediaUrl((p as any).image_path) : ((p as any).image_url ? mediaUrl((p as any).image_url) : undefined)
              return (
              <Card key={p.id} className="flex flex-col">
                {img ? (
                  <div className="mb-3 -mx-4 -mt-4 overflow-hidden rounded-t-lg border-b border-[var(--color-border)] bg-gray-50">
                    <img src={img} alt={`${p.name} image`} className="w-full h-48 object-contain" />
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold truncate">{p.name}</h3>
                    {openId!==p.id && (
                      <p className="text-sm text-gray-700 mt-1 line-clamp-2">{desc}</p>
                    )}
                  </div>
                  <button
                    className="btn-ghost text-blue-700 shrink-0"
                    onClick={() => setOpenId(openId===p.id ? null : p.id)}
                    aria-expanded={openId===p.id}
                  >
                    {openId===p.id ? 'Hide' : 'View details'}
                  </button>
                </div>
                {openId===p.id && (
                  <div className="mt-3 space-y-3">
                    {p.municipality && (
                      <div className="text-xs text-gray-500">{p.municipality}</div>
                    )}
                    {desc && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Details</div>
                        <p className="text-sm text-gray-700">{desc}</p>
                      </div>
                    )}
                    {eligibility.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Eligibility</div>
                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                          {eligibility.map((e, i) => (<li key={i}>{e}</li>))}
                        </ul>
                      </div>
                    )}
                    {requirements.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Requirements</div>
                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                          {requirements.map((r, i) => (<li key={i}>{r}</li>))}
                        </ul>
                      </div>
                    )}
                    {!(desc && String(desc).trim()) && eligibility.length===0 && requirements.length===0 && (
                      <div className="text-sm text-gray-600">No details provided.</div>
                    )}
                  </div>
                )}
                <div className="mt-4">
                  {alreadyApplied ? (
                    <button type="button" className="btn btn-secondary w-full cursor-not-allowed opacity-80" disabled>
                      Already Applied
                    </button>
                  ) : (
                    <GatedAction
                      required="fullyVerified"
                      onAllowed={() => {
                        setSelected(p)
                        setOpen(true)
                        setStep(1)
                      }}
                      featureDescription={`Apply for ${p.name}`}
                    >
                      <button className="btn btn-primary w-full">Apply Now</button>
                    </GatedAction>
                  )}
                </div>
              </Card>
              )
            })}
          </div>
        )
      ) : (
        applications.length === 0 ? (
          <EmptyState title="No applications yet" description="Submit an application to see it here." />
        ) : (
          <>
            {applicationsNotice && (
              <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {applicationsNotice}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {applications.map((a: any) => {
                const missingRequiredCount = getMissingRequiredDocumentsCount(a)
                const canRetryRequiredDocs = missingRequiredCount > 0 && a.status !== 'approved'
                return (
                  <Card key={a.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{a.program?.name || 'Application'}</div>
                        <div className="text-xs text-gray-600">{a.application_number}</div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.status === 'rejected' && a.rejection_reason && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        <span className="font-medium">Reason:</span> {a.rejection_reason}
                      </div>
                    )}
                    {canRetryRequiredDocs && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                        Missing required documents: upload {missingRequiredCount} more document{missingRequiredCount === 1 ? '' : 's'} to continue.
                      </div>
                    )}
                    {canRetryRequiredDocs && (
                      <div className="mt-2">
                        <button
                          type="button"
                          className="btn btn-secondary w-full"
                          onClick={() => {
                            setRetryTarget(a)
                            setRetryFiles([])
                            setRetryError(null)
                            setApplicationsNotice(null)
                          }}
                        >
                          Add the required document(s)
                        </button>
                      </div>
                    )}
                    {a.disbursement_status && <div className="text-xs text-gray-600 mt-2">Disbursement: {a.disbursement_status}</div>}
                  </Card>
                )
              })}
            </div>
          </>
        )
      )}
        </>
      )}

      <Modal isOpen={open} onClose={() => { setOpen(false); setSelected(null); setResult(null); setStep(1); setUploadedFiles([]); setEligibilityCheck(null); setPendingApplicationId(null) }} title={selected ? `Apply: ${selected.name}` : 'Apply'}>
        <Stepper steps={["Eligibility Check","Additional Info","Documents & Submit"]} current={step} />
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-3">Automatic Eligibility Verification</h3>
              
              {eligibilityCheck && !eligibilityCheck.hasTags ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    <div className="text-sm font-medium text-blue-800">Open to All Applicants</div>
                  </div>
                  <p className="text-xs text-blue-700">This program has no eligibility restrictions. All applicants are welcome to apply.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-600 mb-4">We've automatically checked your profile against the program requirements:</p>
                  
                  <div className="space-y-3">
                    {/* Age Requirement */}
                    {eligibilityCheck?.age.required && (
                      <div className={`p-3 rounded-lg border ${eligibilityCheck.age.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-start gap-2">
                          {eligibilityCheck.age.passed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <div className="text-sm font-medium mb-1">Age Requirement</div>
                            <div className={`text-sm ${eligibilityCheck.age.passed ? 'text-green-700' : 'text-red-700'}`}>
                              {eligibilityCheck.age.message}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Location Requirement */}
                    {eligibilityCheck?.location.required && (
                      <div className={`p-3 rounded-lg border ${eligibilityCheck.location.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-start gap-2">
                          {eligibilityCheck.location.passed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <div className="text-sm font-medium mb-1">Location Requirement</div>
                            <div className={`text-sm ${eligibilityCheck.location.passed ? 'text-green-700' : 'text-red-700'}`}>
                              {eligibilityCheck.location.message}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Error message if not eligible */}
                  {eligibilityCheck && !eligibilityCheck.overall && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-sm font-medium text-red-800 mb-1">Not Eligible</div>
                      <div className="text-xs text-red-700">
                        You do not meet the required eligibility criteria for this program. Please review the requirements above.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button 
                className="btn btn-primary inline-flex items-center gap-2" 
                onClick={() => setStep(2)}
                disabled={eligibilityCheck ? !eligibilityCheck.overall : false}
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            {eligibilityCheck && !eligibilityCheck.hasTags ? (
              // Case A: Program has NO eligibility tags - require explanation letter
              <>
                <div>
                  <h3 className="text-sm font-semibold mb-3">Application Letter</h3>
                  <p className="text-xs text-gray-600 mb-4">Please submit a short letter explaining why you are applying for this program. This will be reviewed by the administrator.</p>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Explanation Letter <span className="text-red-500">*</span></label>
                    <textarea 
                      className="input-field" 
                      rows={6} 
                      placeholder="Please explain why you are applying for this program and how it will benefit you..."
                      value={additionalEligibilityData.explanation_letter || ''}
                      onChange={(e) => setAdditionalEligibilityData({ ...additionalEligibilityData, explanation_letter: e.target.value })} 
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">This letter is required and will be reviewed by administrators.</p>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button className="btn btn-secondary inline-flex items-center gap-2" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    <span>Back</span>
                  </button>
                  <button 
                    className="btn btn-primary inline-flex items-center gap-2" 
                    onClick={() => setStep(3)}
                    disabled={!additionalEligibilityData.explanation_letter || !additionalEligibilityData.explanation_letter.trim()}
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : (
              // Case B: Program HAS eligibility tags - additional eligibility inputs
              <>
                <div>
                  <h3 className="text-sm font-semibold mb-3">Additional Information</h3>
                  <p className="text-xs text-gray-600 mb-4">Please provide any additional information to support your application:</p>

                  {/* Additional Information */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Additional Information (Optional)</label>
                    <textarea 
                      className="input-field" 
                      rows={4} 
                      placeholder="Share any additional details to support your application" 
                      value={additionalEligibilityData.notes || ''}
                      onChange={(e) => setAdditionalEligibilityData({ ...additionalEligibilityData, notes: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button className="btn btn-secondary inline-flex items-center gap-2" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    <span>Back</span>
                  </button>
                  <button 
                    className="btn btn-primary inline-flex items-center gap-2" 
                    onClick={() => setStep(3)}
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-3">Documents & Submission</h3>
              
              {/* Required Documents */}
              {selectedRequiredDocuments.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Required Documents <span className="text-red-500">*</span></label>
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-600 mb-2">Please upload the following documents:</p>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {selectedRequiredDocuments.map((req: string, i: number) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>
                  <FileUploader
                    accept="image/*,.pdf"
                    multiple={true}
                    maxSizeMb={10}
                    onFiles={(files) => {
                      setUploadedFiles((previous) => {
                        const merged = [...previous]
                        files.forEach((file) => {
                          const exists = merged.some(
                            (item) =>
                              item.name === file.name &&
                              item.size === file.size &&
                              item.lastModified === file.lastModified
                          )
                          if (!exists) merged.push(file)
                        })
                        return merged
                      })
                    }}
                    label="Upload Documents"
                  />
                  {uploadedFiles.length > 0 && (
                    <div className="mt-2 text-sm text-gray-700">
                      <p className="font-medium mb-1">Uploaded ({uploadedFiles.length}):</p>
                      <ul className="list-disc list-inside space-y-1">
                        {uploadedFiles.map((file, i) => (
                          <li key={i} className="text-xs">{file.name}</li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="mt-2 text-xs text-ocean-700 underline"
                        onClick={() => setUploadedFiles([])}
                      >
                        Clear selected files
                      </button>
                    </div>
                  )}
                  {selectedHasIncompleteRequiredDocs && pendingApplicationId === null && (
                    <p className="text-xs text-rose-600 mt-2">
                      Please upload {selectedMissingRequiredCount} more required document{selectedMissingRequiredCount === 1 ? '' : 's'} before submitting.
                    </p>
                  )}
                </div>
              )}

              {/* Application Summary */}
              <div className="rounded-lg border p-3 text-sm space-y-2 mb-4">
                <div className="font-medium mb-2">Application Summary</div>
                <div><span className="font-medium">Program:</span> {selected?.name}</div>
                {additionalEligibilityData.notes && (
                  <div><span className="font-medium">Additional Information:</span> {additionalEligibilityData.notes}</div>
                )}
                {uploadedFiles.length > 0 && (
                  <div>
                    <span className="font-medium">Documents:</span> {uploadedFiles.length} file(s) ready to upload
                  </div>
                )}
              </div>
              {pendingApplicationId !== null && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Your application was created, but document upload did not complete. Re-upload your documents and submit again to finish.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button className="btn btn-secondary inline-flex items-center gap-2" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back</span>
              </button>
              <button 
                className="btn btn-primary" 
                disabled={
                  applying ||
                  (pendingApplicationId === null && selectedHasIncompleteRequiredDocs) ||
                  (pendingApplicationId !== null && uploadedFiles.length === 0) ||
                  !eligibilityCheck?.overall
                }
                onClick={async () => {
                  setApplying(true)
                  try {
                    if (pendingApplicationId === null && selectedHasIncompleteRequiredDocs) {
                      throw new Error(`Please upload all required documents before submitting. Missing ${selectedMissingRequiredCount} document${selectedMissingRequiredCount === 1 ? '' : 's'}.`)
                    }

                    let app: any = null
                    if (pendingApplicationId) {
                      app = { id: pendingApplicationId }
                    } else {
                      // Create application with eligibility data (API will validate eligibility)
                      const res = await benefitsApi.createApplication({
                        program_id: selected!.id,
                        application_data: {
                          ...additionalEligibilityData,
                          eligibility_verified: true
                        }
                      })
                      app = res?.data?.application
                    }
                     
                    // Upload documents if any
                    if (uploadedFiles.length > 0 && app?.id) {
                      const appId = Number(app.id)
                      if (!appId) {
                        throw new Error('Application was created but missing ID for document upload.')
                      }
                      setUploadingDocs(true)
                      try {
                        const formData = new FormData()
                        uploadedFiles.forEach(file => formData.append('file', file))
                        await benefitsApi.uploadDocs(appId, formData)
                      } catch (e: any) {
                        setPendingApplicationId(appId)
                        const uploadErr = e?.response?.data?.error || e?.message || 'Document upload failed'
                        throw new Error(`Application created, but document upload failed. Please retry upload now. ${uploadErr}`)
                      } finally {
                        setUploadingDocs(false)
                      }
                    }

                    setPendingApplicationId(null)
                    setResult(app)
                    // Refresh applications list after successful submission
                    refetchApplications()
                    // Invalidate programs cache to reflect any slot/capacity changes
                    invalidateMultiple([CACHE_KEYS.BENEFITS_PROGRAMS])
                  } catch (e: any) {
                    const errorMsg = e?.response?.data?.error || e?.message || 'Failed to submit application'
                    setResult({ error: errorMsg })
                    // Don't close modal on error so user can fix issues
                  } finally {
                    setApplying(false)
                  }
                }}
              >
                {applying ? (uploadingDocs ? 'Uploading documents...' : 'Submitting...') : 'Submit Application'}
              </button>
            </div>
            {result && result.error && (
              <div className="mt-3 rounded-lg border p-3 text-sm bg-red-50 border-red-200 text-red-800">
                <div className="font-medium mb-1">❌ Submission Failed</div>
                <div>{result.error}</div>
              </div>
            )}
            {result && result.application_number && (
              <div className="mt-3 rounded-lg border p-3 text-sm flex items-center justify-between bg-green-50 border-green-200">
                <div>
                  ✅ Submitted • Application No.: <span className="font-medium">{result.application_number}</span>
                </div>
                <StatusBadge status={result.status} />
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!retryTarget}
        onClose={closeRetryModal}
        title="Complete Required Documents"
      >
        <div className="space-y-4">
          <div className="text-sm">
            <div><span className="font-medium">Program:</span> {retryTarget?.program?.name || 'Application'}</div>
            <div className="text-xs text-gray-600 mt-1">Application No.: {retryTarget?.application_number}</div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-700 mb-2">
              Required documents ({getRequirementsArray((retryTarget?.program || null) as Program | null).length})
            </div>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {getRequirementsArray((retryTarget?.program || null) as Program | null).map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Currently uploaded: {getSupportingDocumentsArray(retryTarget).length} • Missing: {getMissingRequiredDocumentsCount(retryTarget)}
          </div>

          <FileUploader
            accept="image/*,.pdf"
            multiple={true}
            maxSizeMb={10}
            onFiles={(files) => {
              setRetryFiles((previous) => {
                const merged = [...previous]
                files.forEach((file) => {
                  const exists = merged.some(
                    (item) =>
                      item.name === file.name &&
                      item.size === file.size &&
                      item.lastModified === file.lastModified
                  )
                  if (!exists) merged.push(file)
                })
                return merged
              })
            }}
            label="Upload Additional Documents"
          />

          {retryFiles.length > 0 && (
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">Selected for upload ({retryFiles.length}):</p>
              <ul className="list-disc list-inside space-y-1">
                {retryFiles.map((file, i) => (
                  <li key={i} className="text-xs">{file.name}</li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-2 text-xs text-ocean-700 underline"
                onClick={() => setRetryFiles([])}
              >
                Clear selected files
              </button>
            </div>
          )}

          {retryError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {retryError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={closeRetryModal} disabled={retrySubmitting}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={retrySubmitting || retryFiles.length === 0}
              onClick={submitRetryDocuments}
            >
              {retrySubmitting ? 'Submitting...' : (String(retryTarget?.status || '').toLowerCase() === 'rejected' ? 'Upload and Resubmit' : 'Upload Documents')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
