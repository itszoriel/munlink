import { useState, useEffect, useRef } from 'react'
import { GraduationCap, Accessibility, UserCheck, Clock, CheckCircle, AlertCircle, Upload, X } from 'lucide-react'
import { specialStatusApi, showToast } from '@/lib/api'
import { Button } from '@munlink/ui'

type StatusType = 'student' | 'pwd' | 'senior'

interface StatusInfo {
  active: boolean
  pending: boolean
  expired?: boolean
  status: {
    id: number
    status_type: string
    status: string
    school_name?: string
    semester_start?: string
    semester_end?: string
    disability_type?: string
    expires_at?: string
    approved_at?: string
    rejection_reason?: string
  } | null
}

interface StatusSummary {
  student: StatusInfo
  pwd: StatusInfo
  senior: StatusInfo
  active_types: string[]
}

const STATUS_CONFIG = {
  student: {
    label: 'Student',
    description: 'For currently enrolled students. Valid until the declared semester end.',
    icon: GraduationCap,
    color: 'blue',
    requiredDocs: ['Student ID', 'Certificate of Registration (COR)']
  },
  pwd: {
    label: 'Person with Disability (PWD)',
    description: 'For persons with disabilities. Permanent once approved.',
    icon: Accessibility,
    color: 'purple',
    requiredDocs: ['PWD ID']
  },
  senior: {
    label: 'Senior Citizen',
    description: 'For citizens 60 years and above. Permanent once approved.',
    icon: UserCheck,
    color: 'green',
    requiredDocs: ['Senior Citizen ID']
  }
}

const formatDate = (value?: string) => {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString()
  }
  return new Date(value).toLocaleDateString()
}

function StatusBadge({ type, info }: { type: StatusType; info: StatusInfo }) {
  const config = STATUS_CONFIG[type]
  const studentExpiry = info.status?.semester_end || info.status?.expires_at

  if (info.active) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-${config.color}-50 text-${config.color}-700 border border-${config.color}-200`}>
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm font-medium">{config.label}</span>
        {type === 'student' && studentExpiry && (
          <span className="text-xs opacity-75">
            (valid until {formatDate(studentExpiry)})
          </span>
        )}
      </div>
    )
  }

  if (info.pending) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
        <Clock className="w-4 h-4" />
        <span className="text-sm font-medium">{config.label} - Pending</span>
      </div>
    )
  }

  if (info.expired) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm font-medium">{config.label} - Expired</span>
      </div>
    )
  }

  return null
}

function ApplicationModal({
  type,
  onClose,
  onSuccess,
  existingStatusId
}: {
  type: StatusType
  onClose: () => void
  onSuccess: () => void
  existingStatusId?: number
}) {
  const config = STATUS_CONFIG[type]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [schoolName, setSchoolName] = useState('')
  const [semesterStart, setSemesterStart] = useState('')
  const [semesterEnd, setSemesterEnd] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [disabilityType, setDisabilityType] = useState('')

  // File refs
  const studentIdRef = useRef<HTMLInputElement>(null)
  const corRef = useRef<HTMLInputElement>(null)
  const pwdIdRef = useRef<HTMLInputElement>(null)
  const seniorIdRef = useRef<HTMLInputElement>(null)

  // File states
  const [studentIdFile, setStudentIdFile] = useState<File | null>(null)
  const [corFile, setCorFile] = useState<File | null>(null)
  const [pwdIdFile, setPwdIdFile] = useState<File | null>(null)
  const [seniorIdFile, setSeniorIdFile] = useState<File | null>(null)

  const isRenewal = !!existingStatusId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()

    try {
      if (type === 'student') {
        if (!schoolName.trim()) {
          throw new Error('School name is required')
        }
        if (!semesterStart) {
          throw new Error('Semester start date is required')
        }
        if (!semesterEnd) {
          throw new Error('Semester end date is required')
        }
        if (semesterEnd < semesterStart) {
          throw new Error('Semester end date must be on or after the start date')
        }
        if (!isRenewal && !studentIdFile) {
          throw new Error('Student ID is required')
        }
        if (!corFile) {
          throw new Error('Certificate of Registration is required')
        }

        formData.append('school_name', schoolName)
        formData.append('semester_start', semesterStart)
        formData.append('semester_end', semesterEnd)
        if (idNumber) formData.append('id_number', idNumber)
        if (studentIdFile) formData.append('student_id', studentIdFile)
        formData.append('cor', corFile)

        if (isRenewal && existingStatusId) {
          await specialStatusApi.renewStudent(existingStatusId, formData)
        } else {
          await specialStatusApi.applyStudent(formData)
        }
      } else if (type === 'pwd') {
        if (!pwdIdFile) {
          throw new Error('PWD ID is required')
        }

        if (idNumber) formData.append('id_number', idNumber)
        if (disabilityType) formData.append('disability_type', disabilityType)
        formData.append('pwd_id', pwdIdFile)

        await specialStatusApi.applyPwd(formData)
      } else if (type === 'senior') {
        if (!seniorIdFile) {
          throw new Error('Senior Citizen ID is required')
        }

        if (idNumber) formData.append('id_number', idNumber)
        formData.append('senior_id', seniorIdFile)

        await specialStatusApi.applySenior(formData)
      }

      showToast(isRenewal ? 'Renewal submitted successfully' : 'Application submitted successfully', 'success')
      onSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:w-[95%] sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {isRenewal ? `Renew ${config.label} Status` : `Apply for ${config.label} Status`}
          </h3>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <p className="text-sm text-gray-600 mb-4">{config.description}</p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2.5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Student-specific fields */}
            {type === 'student' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    School Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="input-field"
                    placeholder="e.g., University of the Philippines"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Semester Dates <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={semesterStart}
                        onChange={(e) => setSemesterStart(e.target.value)}
                        className="input-field"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End Date</label>
                      <input
                        type="date"
                        value={semesterEnd}
                        min={semesterStart || undefined}
                        onChange={(e) => setSemesterEnd(e.target.value)}
                        className="input-field"
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Use the semester dates shown on your COR.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Student ID Number</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="input-field"
                    placeholder="Optional"
                  />
                </div>

                {!isRenewal && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Student ID Card <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={studentIdRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setStudentIdFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => studentIdRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-ocean-500 transition-colors"
                    >
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {studentIdFile ? studentIdFile.name : 'Upload Student ID'}
                      </span>
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Certificate of Registration (COR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={corRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setCorFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => corRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-ocean-500 transition-colors"
                  >
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {corFile ? corFile.name : 'Upload COR'}
                    </span>
                  </button>
                </div>
              </>
            )}

            {/* PWD-specific fields */}
            {type === 'pwd' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1.5">PWD ID Number</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="input-field"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Type of Disability</label>
                  <input
                    type="text"
                    value={disabilityType}
                    onChange={(e) => setDisabilityType(e.target.value)}
                    className="input-field"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    PWD ID Card <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={pwdIdRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPwdIdFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => pwdIdRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-ocean-500 transition-colors"
                  >
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {pwdIdFile ? pwdIdFile.name : 'Upload PWD ID'}
                    </span>
                  </button>
                </div>
              </>
            )}

            {/* Senior-specific fields */}
            {type === 'senior' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Senior Citizen ID Number</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="input-field"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Senior Citizen ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={seniorIdRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSeniorIdFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => seniorIdRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-ocean-500 transition-colors"
                  >
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {seniorIdFile ? seniorIdFile.name : 'Upload Senior Citizen ID'}
                    </span>
                  </button>
                </div>
              </>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Submitting...' : isRenewal ? 'Submit Renewal' : 'Submit Application'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SpecialStatusSection() {
  const [loading, setLoading] = useState(true)
  const [statuses, setStatuses] = useState<StatusSummary | null>(null)
  const [applyingFor, setApplyingFor] = useState<StatusType | null>(null)
  const [renewingStatusId, setRenewingStatusId] = useState<number | null>(null)

  const loadStatuses = async () => {
    try {
      const res = await specialStatusApi.getMyStatuses()
      setStatuses(res.data)
    } catch (err) {
      console.error('Failed to load special statuses:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatuses()
  }, [])

  const handleApplySuccess = () => {
    setApplyingFor(null)
    setRenewingStatusId(null)
    loadStatuses()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Special Status</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  const hasActiveStatuses = statuses?.active_types && statuses.active_types.length > 0
  const canApplyStudent = !statuses?.student.active && !statuses?.student.pending
  const canApplyPwd = !statuses?.pwd.active && !statuses?.pwd.pending
  const canApplySenior = !statuses?.senior.active && !statuses?.senior.pending
  const canRenewStudent = statuses?.student.expired && !statuses?.student.pending

  return (
    <>
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-2">Special Status</h3>
        <p className="text-sm text-gray-600 mb-4">
          Apply for special status to receive fee exemptions on certain document requests.
        </p>

        {/* Current Statuses */}
        {hasActiveStatuses && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Your Active Statuses:</p>
            <div className="flex flex-wrap gap-2">
              {statuses?.student.active && <StatusBadge type="student" info={statuses.student} />}
              {statuses?.pwd.active && <StatusBadge type="pwd" info={statuses.pwd} />}
              {statuses?.senior.active && <StatusBadge type="senior" info={statuses.senior} />}
            </div>
          </div>
        )}

        {/* Pending Statuses */}
        {(statuses?.student.pending || statuses?.pwd.pending || statuses?.senior.pending) && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Pending Applications:</p>
            <div className="flex flex-wrap gap-2">
              {statuses?.student.pending && <StatusBadge type="student" info={statuses.student} />}
              {statuses?.pwd.pending && <StatusBadge type="pwd" info={statuses.pwd} />}
              {statuses?.senior.pending && <StatusBadge type="senior" info={statuses.senior} />}
            </div>
          </div>
        )}

        {/* Expired Student Status */}
        {canRenewStudent && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-800">Your student status has expired</p>
                <p className="text-xs text-orange-600">Submit a new COR and semester dates to renew your status</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setApplyingFor('student')
                  setRenewingStatusId(statuses?.student.status?.id || null)
                }}
              >
                Renew
              </Button>
            </div>
          </div>
        )}

        {/* Apply Buttons */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Apply for Special Status:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {canApplyStudent && (
              <button
                onClick={() => setApplyingFor('student')}
                className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <GraduationCap className="w-6 h-6 text-blue-600" />
                <span className="text-sm font-medium">Student</span>
              </button>
            )}
            {canApplyPwd && (
              <button
                onClick={() => setApplyingFor('pwd')}
                className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
              >
                <Accessibility className="w-6 h-6 text-purple-600" />
                <span className="text-sm font-medium">PWD</span>
              </button>
            )}
            {canApplySenior && (
              <button
                onClick={() => setApplyingFor('senior')}
                className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
              >
                <UserCheck className="w-6 h-6 text-green-600" />
                <span className="text-sm font-medium">Senior</span>
              </button>
            )}
          </div>
          {!canApplyStudent && !canApplyPwd && !canApplySenior && !canRenewStudent && (
            <p className="text-sm text-gray-500 text-center py-2">
              You have applied for or already have all available special statuses.
            </p>
          )}
        </div>
      </div>

      {/* Application Modal */}
      {applyingFor && (
        <ApplicationModal
          type={applyingFor}
          existingStatusId={renewingStatusId || undefined}
          onClose={() => {
            setApplyingFor(null)
            setRenewingStatusId(null)
          }}
          onSuccess={handleApplySuccess}
        />
      )}
    </>
  )
}
