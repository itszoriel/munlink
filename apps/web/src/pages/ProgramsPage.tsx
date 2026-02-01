import { StatusBadge, Card, EmptyState } from '@munlink/ui'
import { useEffect, useState, useMemo } from 'react'
import { ArrowRight, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import GatedAction from '@/components/GatedAction'
import { useAppStore } from '@/lib/store'
import { benefitsApi, mediaUrl } from '@/lib/api'
import { useCachedFetch } from '@/lib/useCachedFetch'
import { CACHE_KEYS } from '@/lib/dataStore'
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
          const { authApi } = await import('@/lib/api')
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
    { enabled: isAuthenticated && tab === 'applications', staleTime: 2 * 60 * 1000 }
  )
  const applications = (applicationsData as any)?.data?.applications || []

  const loading = tab === 'programs' ? programsLoading : applicationsLoading

  // Initialize tab from query param (?tab=applications)
  useEffect(() => {
    const t = (searchParams.get('tab') || '').toLowerCase()
    if (t === 'applications') setTab('applications')
  }, [searchParams])

  // Helper function to safely get requirements array
  const getRequirementsArray = (program: Program | null): string[] => {
    if (!program) return []
    const requirements = (program as any).requirements || (program as any).required_documents
    if (Array.isArray(requirements)) return requirements
    return []
  }

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
      setResult(null)
    }
  }, [open, selected, checkEligibility])

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
              const requirements = (p.requirements || (p as any).required_documents || []) as string[]
              const img = (p as any).image_path ? mediaUrl((p as any).image_path) : ((p as any).image_url ? mediaUrl((p as any).image_url) : undefined)
              return (
              <Card key={p.id} className="flex flex-col">
                {img ? (
                  <div className="mb-3 -mx-4 -mt-4 overflow-hidden rounded-t-lg border-b border-[var(--color-border)]">
                    <img src={img} alt={`${p.name} image`} className="h-36 w-full object-cover" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {applications.map((a: any) => (
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
                {a.disbursement_status && <div className="text-xs text-gray-600 mt-2">Disbursement: {a.disbursement_status}</div>}
              </Card>
            ))}
          </div>
        )
      )}
        </>
      )}

      <Modal isOpen={open} onClose={() => { setOpen(false); setSelected(null); setResult(null); setStep(1); setUploadedFiles([]); setEligibilityCheck(null) }} title={selected ? `Apply: ${selected.name}` : 'Apply'}>
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
              {getRequirementsArray(selected).length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Required Documents <span className="text-red-500">*</span></label>
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-600 mb-2">Please upload the following documents:</p>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {getRequirementsArray(selected).map((req: string, i: number) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>
                  <FileUploader
                    accept="image/*,.pdf"
                    multiple={true}
                    maxSizeMb={10}
                    onFiles={(files) => setUploadedFiles(files)}
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
                    </div>
                  )}
                  {getRequirementsArray(selected).length > 0 && uploadedFiles.length === 0 && (
                    <p className="text-xs text-rose-600 mt-2">Please upload at least one document to submit.</p>
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
            </div>

            <div className="flex items-center justify-between pt-2">
              <button className="btn btn-secondary inline-flex items-center gap-2" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back</span>
              </button>
              <button 
                className="btn btn-primary" 
                disabled={applying || (getRequirementsArray(selected).length > 0 && uploadedFiles.length === 0) || !eligibilityCheck?.overall} 
                onClick={async () => {
                  setApplying(true)
                  try {
                    // Create application with eligibility data (API will validate eligibility)
                    const res = await benefitsApi.createApplication({ 
                      program_id: selected!.id, 
                      application_data: {
                        ...additionalEligibilityData,
                        eligibility_verified: true
                      } 
                    })
                    const app = res?.data?.application
                    
                    // Upload documents if any
                    if (uploadedFiles.length > 0 && app?.id) {
                      setUploadingDocs(true)
                      try {
                        const formData = new FormData()
                        uploadedFiles.forEach(file => formData.append('file', file))
                        await benefitsApi.uploadDocs(app.id, formData)
                      } catch (e: any) {
                        console.error('Document upload failed:', e)
                        // Continue even if upload fails - documents can be uploaded later
                      } finally {
                        setUploadingDocs(false)
                      }
                    }
                    
                    setResult(app)
                    // Refresh applications list after successful submission
                    refetchApplications()
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
    </div>
  )
}