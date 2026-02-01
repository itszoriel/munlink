import { useMemo, useState, isValidElement, cloneElement } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/lib/store'
import Modal from '@/components/ui/Modal'
import { LogIn, Mail, IdCard, Clock, ShieldCheck } from 'lucide-react'

type Props = {
  required?: 'authenticated' | 'emailVerified' | 'idUploaded' | 'fullyVerified'
  onAllowed: () => void | Promise<void>
  children: ReactNode
  className?: string
  tooltip?: string
  disabled?: boolean
  loading?: boolean
  /** Custom message to explain what feature is being gated */
  featureDescription?: string
}

type GateStatus = 'notLoggedIn' | 'emailNotVerified' | 'idNotUploaded' | 'pendingApproval' | 'allowed'

export default function GatedAction({
  required = 'fullyVerified',
  onAllowed,
  children,
  className = '',
  tooltip,
  disabled,
  loading,
  featureDescription,
}: Props) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const emailVerified = useAppStore((s) => s.emailVerified)
  const adminVerified = useAppStore((s) => s.adminVerified)
  const user = useAppStore((s) => s.user)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  // Check if user has uploaded ID documents
  const hasUploadedId = useMemo(() => {
    if (!user) return false
    return !!(user.valid_id_front || user.valid_id_back || user.selfie_with_id)
  }, [user])

  // Determine the current gate status
  const gateStatus: GateStatus = useMemo(() => {
    if (!isAuthenticated) return 'notLoggedIn'
    if (!emailVerified) return 'emailNotVerified'
    if (required === 'idUploaded' || required === 'fullyVerified') {
      if (!hasUploadedId) return 'idNotUploaded'
    }
    if (required === 'fullyVerified' && !adminVerified) return 'pendingApproval'
    return 'allowed'
  }, [isAuthenticated, emailVerified, adminVerified, hasUploadedId, required])

  const allowed = gateStatus === 'allowed'

  // Get status-specific content
  const gateContent = useMemo(() => {
    const contents: Record<GateStatus, { title: string; message: string; icon: typeof LogIn; actionLabel?: string; actionPath?: string }> = {
      notLoggedIn: {
        title: 'Account Required',
        message: 'Please create an account or log in to access this feature.',
        icon: LogIn,
        actionLabel: 'Log In',
        actionPath: '/login',
      },
      emailNotVerified: {
        title: 'Email Verification Required',
        message: 'Please verify your email address to continue. Check your inbox for the verification link.',
        icon: Mail,
        actionLabel: 'Verify Email',
        actionPath: '/verify-email',
      },
      idNotUploaded: {
        title: 'ID Verification Required',
        message: 'Please upload your valid ID for verification. This helps us ensure the security of our community.',
        icon: IdCard,
        actionLabel: 'Upload ID',
        actionPath: '/profile',
      },
      pendingApproval: {
        title: 'Verification Pending',
        message: 'Your account is pending verification. Please wait for admin approval. This usually takes 1-2 business days.',
        icon: Clock,
      },
      allowed: {
        title: 'Access Granted',
        message: 'You have full access to this feature.',
        icon: ShieldCheck,
      },
    }
    return contents[gateStatus]
  }, [gateStatus])

  const tooltipText = tooltip || (!allowed ? gateContent.message.split('.')[0] : '')

  const wrappedChild = useMemo(() => {
    if (!isValidElement(children)) return children
    const originalOnClick: any = (children as any).props?.onClick
    const injectedOnClick = (e: any) => {
      // Prevent form submission when gating
      if (!allowed) {
        e.preventDefault?.()
        e.stopPropagation?.()
        setOpen(true)
        return
      }
      if (disabled || loading) return
      if (typeof onAllowed === 'function') onAllowed()
      if (typeof originalOnClick === 'function') originalOnClick(e)
    }
    const ariaDisabled = (!allowed) || !!disabled
    const childClass = `${(children as any).props?.className || ''} ${className || ''} ${!allowed ? 'opacity-60 cursor-not-allowed' : ''}`.trim()
    return cloneElement(children as any, { onClick: injectedOnClick, 'aria-disabled': ariaDisabled, className: childClass })
  }, [children, allowed, disabled, loading, onAllowed, className])

  const IconComponent = gateContent.icon

  return (
    <div className="relative inline-block group">
      {wrappedChild}

      {!allowed && tooltipText && (
        <div className="pointer-events-none invisible group-hover:visible absolute z-50 left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded-md text-xs text-white bg-gray-900 shadow-lg whitespace-nowrap">
          {tooltipText}
        </div>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={gateContent.title}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200">Close</button>
            {gateStatus === 'notLoggedIn' && (
              <>
                <button onClick={() => navigate('/login')} className="px-3 py-1.5 rounded-lg bg-ocean-600 text-white hover:bg-ocean-700">Log In</button>
                <button onClick={() => navigate('/register')} className="px-3 py-1.5 rounded-lg bg-ocean-600 text-white hover:bg-ocean-700">Create Account</button>
              </>
            )}
            {gateContent.actionLabel && gateContent.actionPath && gateStatus !== 'notLoggedIn' && (
              <button onClick={() => navigate(gateContent.actionPath!)} className="px-3 py-1.5 rounded-lg bg-ocean-600 text-white hover:bg-ocean-700">
                {gateContent.actionLabel}
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-ocean-100 flex items-center justify-center">
              <IconComponent className="w-5 h-5 text-ocean-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-800 text-sm">{gateContent.message}</p>
              {featureDescription && (
                <p className="text-gray-600 text-sm mt-2">
                  <span className="font-medium">You're trying to:</span> {featureDescription}
                </p>
              )}
            </div>
          </div>

          {/* Progress indicator for verification steps */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Verification Progress</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${isAuthenticated ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {isAuthenticated ? '✓' : '1'}
                </div>
                <span className={`text-sm ${isAuthenticated ? 'text-green-700' : 'text-gray-600'}`}>Create account</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${emailVerified ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {emailVerified ? '✓' : '2'}
                </div>
                <span className={`text-sm ${emailVerified ? 'text-green-700' : 'text-gray-600'}`}>Verify email</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${hasUploadedId ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {hasUploadedId ? '✓' : '3'}
                </div>
                <span className={`text-sm ${hasUploadedId ? 'text-green-700' : 'text-gray-600'}`}>Upload ID</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${adminVerified ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {adminVerified ? '✓' : '4'}
                </div>
                <span className={`text-sm ${adminVerified ? 'text-green-700' : 'text-gray-600'}`}>Admin approval</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}


