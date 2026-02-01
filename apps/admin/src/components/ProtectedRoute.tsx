import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminStore } from '../lib/store'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate()
  const { isAuthenticated, user, isAuthBootstrapped, bootstrapAuth } = useAdminStore()

  useEffect(() => {
    if (!isAuthBootstrapped) {
      void bootstrapAuth()
      return
    }

    if (!isAuthenticated || !user) {
      navigate('/', { replace: true })
      return
    }

    // Verify user has admin role
    const allowedRoles = ['municipal_admin', 'admin', 'superadmin', 'provincial_admin', 'barangay_admin']
    if (!allowedRoles.includes(user.role)) {
      console.error('Access denied: User is not an admin')
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, user, navigate, isAuthBootstrapped, bootstrapAuth])

  if (!isAuthBootstrapped) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-gray-500">
        Checking session...
      </div>
    )
  }

  const allowedRoles = ['municipal_admin', 'admin', 'superadmin', 'provincial_admin', 'barangay_admin']
  if (!isAuthenticated || !user || !allowedRoles.includes(user.role)) {
    return null
  }

  return <>{children}</>
}
