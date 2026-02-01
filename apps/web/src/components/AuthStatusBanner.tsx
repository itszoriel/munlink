import { Link } from 'react-router-dom'
import { useAppStore } from '@/lib/store'

export default function AuthStatusBanner() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const emailVerified = useAppStore((s) => s.emailVerified)
  const adminVerified = useAppStore((s) => s.adminVerified)
  const user = useAppStore((s) => s.user)

  // Check if user already has ID documents uploaded
  const hasIdDocuments = user?.valid_id_front || user?.valid_id_back

  if (!isAuthenticated) return null
  if (emailVerified && adminVerified) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="container mx-auto px-4 py-2 text-sm text-amber-900 flex items-center justify-between gap-4">
        {!emailVerified ? (
          <div>
            <span className="font-medium">Verify your Gmail account</span> to unlock features like posting items, requesting documents, and reporting issues.
          </div>
        ) : hasIdDocuments ? (
          <div>
            <span className="font-medium">Your account is under admin review.</span> You'll be notified once approved.
          </div>
        ) : (
          <div>
            <span className="font-medium">Upload your ID documents</span> to complete your account verification.
          </div>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {!emailVerified && (
            <Link to="/verify-email" className="px-3 py-1.5 rounded-lg bg-ocean-600 text-white hover:bg-ocean-700">Verify Email</Link>
          )}
          {emailVerified && !adminVerified && !hasIdDocuments && (
            <Link to="/upload-id" className="px-3 py-1.5 rounded-lg bg-ocean-600 text-white hover:bg-ocean-700">Upload ID</Link>
          )}
          <Link to="/dashboard" className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200">Dashboard</Link>
        </div>
      </div>
    </div>
  )
}


