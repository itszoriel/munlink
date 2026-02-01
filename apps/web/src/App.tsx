import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { bootstrapAuth, getAccessToken, authApi, startKeepAlive } from '@/lib/api'
import { useAppStore } from '@/lib/store'

let hasBootstrappedAuth = false
let hasStartedKeepAlive = false
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import MarketplacePage from './pages/MarketplacePage'
import Layout from './components/Layout'
import AnnouncementsPage from './pages/AnnouncementsPage'
import About from '@/pages/About'
import DocumentsPage from './pages/DocumentsPage'
import DocumentRequestPage from './pages/DocumentRequestPage'
import ProblemsPage from './pages/ProblemsPage'
import ProgramsPage from './pages/ProgramsPage'
import VerifyDocumentPage from './pages/VerifyDocumentPage'
import ProtectedRoute from './components/ProtectedRoute'
import VerifyEmailPage from './pages/VerifyEmailPage'
import UploadIdPage from './pages/UploadIdPage'
import ErrorBoundary from './components/ErrorBoundary'
import ProfilePage from './pages/ProfilePage'
import MyMarketplacePage from './pages/MyMarketplacePage'
import MarketplaceItemPage from './pages/MarketplaceItemPage'
import AnnouncementDetailPage from './pages/AnnouncementDetailPage'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'

function App() {
  const setAuth = useAppStore((s) => s.setAuth)
  const setAuthBootstrapped = useAppStore((s) => s.setAuthBootstrapped)
  const logout = useAppStore((s) => s.logout)
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      // Start keep-alive ping to prevent cold starts
      if (!hasStartedKeepAlive) {
        startKeepAlive()
        hasStartedKeepAlive = true
      }
      
      if (hasBootstrappedAuth) { setAuthBootstrapped(true); return }
      try {
        await bootstrapAuth()
        const token = getAccessToken()
        if (token) {
          try {
            const resp = await authApi.getProfile()
            if (!cancelled && resp?.data) {
              setAuth(resp.data, token, '')
            }
          } catch (err: any) {
            const status = err?.response?.status
            if (!cancelled && (status === 401 || status === 403)) {
              logout()
            }
          }
        } else if (!cancelled) {
          // Clear any stale local session data if refresh/access token is missing
          logout()
        }
      } catch {
        if (!cancelled) logout()
      }
      hasBootstrappedAuth = true
      if (!cancelled) setAuthBootstrapped(true)
    }
    void init()
    return () => { cancelled = true }
  }, [setAuth])
  return (
    <BrowserRouter>
      <Routes>
        {/* Public verify route - outside Layout to avoid auth redirect */}
        <Route path="verify/:requestNumber" element={<VerifyDocumentPage />} />
        
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="announcements/:id" element={<AnnouncementDetailPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<ErrorBoundary><RegisterPage /></ErrorBoundary>} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="upload-id" element={<ProtectedRoute allow={["resident"]}><UploadIdPage /></ProtectedRoute>} />
          <Route path="dashboard" element={<ProtectedRoute allow={["resident"]}><DashboardPage /></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute allow={["resident"]}><ProfilePage /></ProtectedRoute>} />
          <Route path="my-marketplace" element={<ProtectedRoute allow={["resident"]}><MyMarketplacePage /></ProtectedRoute>} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="marketplace/:id" element={<MarketplaceItemPage />} />
          <Route path="about" element={<About />} />
          <Route path="terms-of-service" element={<TermsOfService />} />
          <Route path="privacy-policy" element={<PrivacyPolicy />} />
          <Route path="documents" element={<ProtectedRoute allow={["resident","admin","public"]}><DocumentsPage /></ProtectedRoute>} />
          <Route path="documents/requests/:id" element={<LegacyDocRedirect />} />
          <Route path="dashboard/requests/:id" element={<ProtectedRoute allow={["resident"]}><DocumentRequestPage /></ProtectedRoute>} />
          <Route path="problems" element={<ProtectedRoute allow={["resident","admin","public"]}><ProblemsPage /></ProtectedRoute>} />
          <Route path="programs" element={<ProtectedRoute allow={["resident","admin","public"]}><ProgramsPage /></ProtectedRoute>} />
          {/* Legacy redirects for old routes */}
          <Route path="issues" element={<Navigate to="/problems" replace />} />
          <Route path="benefits" element={<Navigate to="/programs" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

function LegacyDocRedirect() {
  const location = useLocation()
  const to = location.pathname.replace('/documents/requests', '/dashboard/requests')
  return <Navigate to={to} replace />
}
