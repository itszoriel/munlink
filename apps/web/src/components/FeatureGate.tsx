import type { ReactNode } from 'react'
import { useAppStore } from '@/lib/store'

type Props = {
  children: ReactNode
}

export default function FeatureGate({ children }: Props) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const emailVerified = useAppStore((s) => s.emailVerified)
  const adminVerified = useAppStore((s) => s.adminVerified)

  if (!isAuthenticated) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
        Please log in first.
      </div>
    )
  }

  if (!emailVerified) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800">
        Please verify your email first.
      </div>
    )
  }

  if (!adminVerified) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-800">
        Please wait, your account is under review by the admin.
      </div>
    )
  }

  return <>{children}</>
}


