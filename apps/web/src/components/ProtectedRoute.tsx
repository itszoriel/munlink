import { Navigate, Link, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useAppStore } from '@/lib/store'
import { LogIn, Mail, IdCard, Clock, ShieldCheck } from 'lucide-react'

type Props = {
  children: ReactElement
  allow: Array<'public' | 'resident' | 'admin'>
  /** If true, will show an auth gate page instead of redirecting */
  showGate?: boolean
}

export default function ProtectedRoute({ children, allow, showGate = true }: Props) {
  const role = useAppStore((s) => s.role)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const emailVerified = useAppStore((s) => s.emailVerified)
  const adminVerified = useAppStore((s) => s.adminVerified)
  const user = useAppStore((s) => s.user)
  const isAuthBootstrapped = useAppStore((s) => s.isAuthBootstrapped)
  const location = useLocation()

  // Wait for auth to bootstrap before making decisions
  if (!isAuthBootstrapped) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  // Check if user has uploaded ID
  const hasUploadedId = !!(user?.valid_id_front || user?.valid_id_back || user?.selfie_with_id)

  // Determine gate status
  type GateStatus = 'notLoggedIn' | 'emailNotVerified' | 'idNotUploaded' | 'pendingApproval' | 'allowed'
  
  let gateStatus: GateStatus = 'allowed'
  if (!isAuthenticated) {
    gateStatus = 'notLoggedIn'
  } else if (!emailVerified) {
    gateStatus = 'emailNotVerified'
  } else if (!hasUploadedId) {
    gateStatus = 'idNotUploaded'
  } else if (!adminVerified) {
    gateStatus = 'pendingApproval'
  }

  const isPublicAllowed = allow.includes('public')
  const roleAllowed = allow.includes(role)
  if (!roleAllowed && !isPublicAllowed && gateStatus === 'allowed') {
    gateStatus = 'notLoggedIn'
  }

  const canProceed =
    (isPublicAllowed && role === 'public') ||
    (roleAllowed && gateStatus === 'allowed')

  if (canProceed) return children

  // If not showing gate, just redirect
  if (!showGate) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // Gate content based on status
  const gateContent: Record<GateStatus, { title: string; message: string; icon: typeof LogIn; actionLabel?: string; actionPath?: string; secondaryAction?: { label: string; path: string } }> = {
    notLoggedIn: {
      title: 'Account Required',
      message: 'Please create an account or log in to access this page. Creating an account allows you to:',
      icon: LogIn,
      actionLabel: 'Log In',
      actionPath: '/login',
      secondaryAction: { label: 'Create Account', path: '/register' },
    },
    emailNotVerified: {
      title: 'Email Verification Required',
      message: 'Please verify your email address to access this page. Check your inbox for the verification link we sent you.',
      icon: Mail,
      actionLabel: 'Verify Email',
      actionPath: '/verify-email',
    },
    idNotUploaded: {
      title: 'ID Verification Required',
      message: 'Please upload your valid ID for verification to access this page. This helps us ensure the security of our community.',
      icon: IdCard,
      actionLabel: 'Upload ID',
      actionPath: '/upload-id',
    },
    pendingApproval: {
      title: 'Verification Pending',
      message: 'Your account is pending admin verification. This process usually takes 1-2 business days. You will be notified once approved.',
      icon: Clock,
    },
    allowed: {
      title: 'Access Granted',
      message: '',
      icon: ShieldCheck,
    },
  }

  const content = gateContent[gateStatus]
  const IconComponent = content.icon

  return (
    <div className="container-responsive py-12">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-ocean-100 flex items-center justify-center">
              <IconComponent className="w-7 h-7 text-ocean-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{content.title}</h1>
              <p className="text-sm text-gray-500">Access required to view this page</p>
            </div>
          </div>

          <p className="text-gray-700 mb-6">{content.message}</p>

          {gateStatus === 'notLoggedIn' && (
            <ul className="list-disc list-inside text-gray-600 mb-6 space-y-1">
              <li>Access your personal dashboard</li>
              <li>Request documents from your municipality</li>
              <li>Apply for benefit programs</li>
              <li>Post items on the marketplace</li>
              <li>Report community issues</li>
            </ul>
          )}

          {/* Verification progress */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-xs font-medium text-gray-500 mb-3">Verification Progress</p>
            <div className="space-y-3">
              <ProgressStep
                number={1}
                label="Create account"
                completed={isAuthenticated}
                current={!isAuthenticated}
              />
              <ProgressStep
                number={2}
                label="Verify email"
                completed={emailVerified}
                current={isAuthenticated && !emailVerified}
              />
              <ProgressStep
                number={3}
                label="Upload ID"
                completed={hasUploadedId}
                current={isAuthenticated && emailVerified && !hasUploadedId}
              />
              <ProgressStep
                number={4}
                label="Admin approval"
                completed={adminVerified}
                current={isAuthenticated && emailVerified && hasUploadedId && !adminVerified}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {content.actionLabel && content.actionPath && (
              <Link
                to={content.actionPath}
                state={{ from: location.pathname }}
                className="btn btn-primary flex-1 text-center"
              >
                {content.actionLabel}
              </Link>
            )}
            {content.secondaryAction && (
              <Link
                to={content.secondaryAction.path}
                state={{ from: location.pathname }}
                className="btn btn-secondary flex-1 text-center"
              >
                {content.secondaryAction.label}
              </Link>
            )}
            {gateStatus === 'pendingApproval' && (
              <Link to="/" className="btn btn-secondary flex-1 text-center">
                Return Home
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProgressStep({ number, label, completed, current }: { number: number; label: string; completed: boolean; current: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
          completed
            ? 'bg-green-500 text-white'
            : current
            ? 'bg-ocean-500 text-white'
            : 'bg-gray-200 text-gray-500'
        }`}
      >
        {completed ? '✓' : number}
      </div>
      <span className={`text-sm ${completed ? 'text-green-700' : current ? 'text-ocean-700 font-medium' : 'text-gray-500'}`}>
        {label}
      </span>
      {current && <span className="text-xs text-ocean-600 bg-ocean-50 px-2 py-0.5 rounded-full">Current step</span>}
    </div>
  )
}


