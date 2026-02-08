import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import AdminLoginPage from './pages/AdminLoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SuperAdminPanel from './pages/SuperAdminPanel'
import SuperAdminLoginPage from './pages/SuperAdminLoginPage'
import SuperAdminAuditLog from './pages/SuperAdminAuditLog'
import ProtectedRoute from './components/ProtectedRoute'
import { useAdminStore } from './lib/store'
import AdminLayout from './components/layout/AdminLayout'
import Dashboard from './pages/Dashboard'
import Residents from './pages/Residents'
import Programs from './pages/Programs'
import Requests from './pages/Requests'
import Admins from './pages/Admins'
import Reports from './pages/Reports'
import Profile from './pages/Profile'
import Announcements from './pages/Announcements'
import Problems from './pages/Problems'
import TransactionsPage from './pages/Transactions'
import VerifyTicket from './pages/VerifyTicket'

// Provincial Admin
import ProvincialAdminLoginPage from './pages/ProvincialAdminLoginPage'
import ProvincialAdminDashboard from './pages/ProvincialAdminDashboard'
import ProvincialAdminAnnouncements from './pages/ProvincialAdminAnnouncements'
import ProvincialAdminReports from './pages/ProvincialAdminReports'

// Barangay Admin
import BarangayAdminLoginPage from './pages/BarangayAdminLoginPage'
import BarangayAdminDashboard from './pages/BarangayAdminDashboard'
import BarangayAdminAnnouncements from './pages/BarangayAdminAnnouncements'
import BarangayAdminPrograms from './pages/BarangayAdminPrograms'
import BarangayAdminReports from './pages/BarangayAdminReports'

// Role Selector
import RoleSelector from './pages/RoleSelector'

export default function App() {
  const isAuthBootstrapped = useAdminStore((s) => s.isAuthBootstrapped)
  const bootstrapAuth = useAdminStore((s) => s.bootstrapAuth)
  const navigate = useNavigate()

  // Bootstrap auth on mount (restore session from httpOnly cookie + sessionStorage)
  useEffect(() => {
    bootstrapAuth()
  }, [bootstrapAuth])

  // Prevent accessing private routes after logout via back button/history cache
  useEffect(() => {
    const recheckAuth = () => {
      const { isAuthenticated: auth, user } = useAdminStore.getState()
      if (!auth || !user) {
        navigate('/', { replace: true })
      }
    }

    window.addEventListener('pageshow', recheckAuth)
    window.addEventListener('popstate', recheckAuth)
    return () => {
      window.removeEventListener('pageshow', recheckAuth)
      window.removeEventListener('popstate', recheckAuth)
    }
  }, [navigate])

  // Show nothing while bootstrapping to prevent flash of unauthenticated state
  if (!isAuthBootstrapped) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-ocean-50 to-white">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-ocean-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-ocean-50 to-white">
      <Routes>
        {/* Admin routes (modern layout) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/residents"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Residents />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/programs"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Programs />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Requests />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/verify-ticket"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <VerifyTicket />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <TransactionsPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/problems"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Problems />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admins"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Admins />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Profile />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/announcements"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Announcements />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Reports />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Audit Log (super admin only) */}
        <Route
          path="/audit-log"
          element={
            <Navigate to="/superadmin" replace />
          }
        />

        {/* Role Selector Landing Page */}
        <Route path="/" element={<RoleSelector />} />

        {/* Auth pages */}
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute>
              <SuperAdminPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/audit"
          element={
            <ProtectedRoute>
              <SuperAdminAuditLog />
            </ProtectedRoute>
          }
        />
        <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />

        {/* Provincial Admin routes */}
        <Route path="/provincial/login" element={<ProvincialAdminLoginPage />} />
        <Route
          path="/provincial/dashboard"
          element={
            <ProtectedRoute>
              <ProvincialAdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/provincial/announcements"
          element={
            <ProtectedRoute>
              <ProvincialAdminAnnouncements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/provincial/reports"
          element={
            <ProtectedRoute>
              <ProvincialAdminReports />
            </ProtectedRoute>
          }
        />

        {/* Barangay Admin routes */}
        <Route path="/barangay/login" element={<BarangayAdminLoginPage />} />
        <Route
          path="/barangay/dashboard"
          element={
            <ProtectedRoute>
              <BarangayAdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/barangay/announcements"
          element={
            <ProtectedRoute>
              <BarangayAdminAnnouncements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/barangay/programs"
          element={
            <ProtectedRoute>
              <BarangayAdminPrograms />
            </ProtectedRoute>
          }
        />
        <Route
          path="/barangay/reports"
          element={
            <ProtectedRoute>
              <BarangayAdminReports />
            </ProtectedRoute>
          }
        />

        {/* Fallback: always land on portal for unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}


