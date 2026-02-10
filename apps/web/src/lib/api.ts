import axios from 'axios'

// Default to Vite proxy in dev; use explicit env or production URL in prod
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : 'https://api-munlink.up.railway.app')

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// In-memory access token (no localStorage)
let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

// Callback for when auth expires (wired up by App.tsx to trigger Zustand logout)
let onAuthExpired: (() => void) | null = null
export const setOnAuthExpired = (cb: (() => void) | null) => { onAuthExpired = cb }

/**
 * Get CSRF token from cookies (for CSRF-protected endpoints)
 * Flask-JWT-Extended sets csrf_refresh_token cookie when CSRF protection is enabled
 */
function getCsrfToken(): string | null {
  try {
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      // Look for csrf_refresh_token (set by Flask-JWT-Extended)
      if (name === 'csrf_refresh_token') {
        return decodeURIComponent(value)
      }
      // Fallback to csrf_access_token
      if (name === 'csrf_access_token') {
        return decodeURIComponent(value)
      }
    }
  } catch {
    // Cookie parsing failed
  }
  return null
}

// Flag to track if user has ever logged in (avoids 401 errors for guests)
const HAS_SESSION_KEY = 'munlink:has_session'

export const getAccessToken = (): string | null => accessToken
export const setAccessToken = (token: string | null) => {
  accessToken = token
  try {
    if (token) {
      sessionStorage.setItem('access_token', token)
      // Mark that user has a session (for refresh attempts)
      localStorage.setItem(HAS_SESSION_KEY, 'true')
    } else {
      sessionStorage.removeItem('access_token')
    }
  } catch { }
}
export const clearAccessToken = () => {
  accessToken = null
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  try {
    sessionStorage.removeItem('access_token')
    // Clear session flag on logout
    localStorage.removeItem(HAS_SESSION_KEY)
  } catch { }
}

// Check if user has ever had a session (to avoid unnecessary refresh calls for guests)
const hasHadSession = (): boolean => {
  try {
    return localStorage.getItem(HAS_SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

export const setSessionAccessToken = (token: string | null) => {
  setAccessToken(token)
  if (token) scheduleRefresh(token)
}

function base64UrlDecode(input: string): string {
  const pad = (str: string) => str + '='.repeat((4 - (str.length % 4)) % 4)
  const b64 = pad(input).replace(/-/g, '+').replace(/_/g, '/')
  try {
    return decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  } catch {
    return ''
  }
}

function decodeJwt(token: string): any | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(base64UrlDecode(parts[1]) || 'null')
    return payload
  } catch {
    return null
  }
}

function scheduleRefresh(token: string) {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  const payload = decodeJwt(token)
  const expSec = payload?.exp
  if (!expSec || typeof expSec !== 'number') return
  const nowSec = Math.floor(Date.now() / 1000)
  const bufferSec = 60 // refresh 60s before expiry to account for skew
  const delayMs = Math.max((expSec - nowSec - bufferSec) * 1000, 0)
  refreshTimer = setTimeout(() => {
    // fire and forget
    void doRefresh().catch(() => { })
  }, delayMs)
}

async function doRefreshInternal(): Promise<string | null> {
  try {
    // Include CSRF token if available (for CSRF-protected backends)
    const csrfToken = getCsrfToken()
    const headers: Record<string, string> = {}
    if (csrfToken) {
      headers['X-CSRF-TOKEN'] = csrfToken
    }

    const resp = await axios.post(
      `${API_BASE_URL}/api/auth/refresh`,
      {},
      {
        withCredentials: true,
        validateStatus: () => true,
        headers,
        timeout: 5000
      }
    )
    if (resp.status !== 200) return null
    const newToken: string | undefined = resp?.data?.access_token
    if (newToken) {
      setAccessToken(newToken)
      scheduleRefresh(newToken)
      return newToken
    }
  } catch {
    // ignore; caller handles logout
  }
  return null
}

function doRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefreshInternal().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

export async function bootstrapAuth(): Promise<boolean> {
  // First, hydrate from sessionStorage if present for immediate UX
  try {
    const saved = sessionStorage.getItem('access_token')
    if (saved) {
      setAccessToken(saved)
      // Check if token is expired or near-expiry (within 60s buffer)
      const payload = decodeJwt(saved)
      const expSec = payload?.exp
      const nowSec = Math.floor(Date.now() / 1000)
      const isExpiredOrNearExpiry = !expSec || (expSec - nowSec) < 60

      if (isExpiredOrNearExpiry) {
        // Token expired/near-expiry: await refresh to get fresh token before profile call
        await doRefresh()
      } else {
        // Token still valid: schedule future refresh and proceed immediately
        scheduleRefresh(saved)
      }
      return true
    }
  } catch { }

  // Only attempt refresh if user has had a session before
  // This prevents 401 errors for guests who have never logged in
  if (!hasHadSession()) {
    return false
  }

  // Attempt to hydrate from refresh cookie once on app load
  const token = await doRefresh()
  return !!token
}

// Add auth token to requests
api.interceptors.request.use((config: any) => {
  if (!config.headers) config.headers = {}
  if (accessToken) {
    try {
      config.headers['Authorization'] = `Bearer ${accessToken}`
    } catch {
      ; (config.headers as any).Authorization = `Bearer ${accessToken}`
    }
  }
  return config
})

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {}

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const newToken = await doRefresh()
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {}
          try {
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`
          } catch {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
          }
          return api(originalRequest)
        }
      } catch { }
      // If refresh failed, clear tokens and notify React (no hard redirect)
      clearAccessToken()
      if (onAuthExpired) onAuthExpired()
      return Promise.reject(error)
    }

    // Handle role mismatch: clear tokens and redirect to login
    if (error.response?.status === 403) {
      try {
        const data: any = error.response?.data
        if (data?.code === 'ROLE_MISMATCH') {
          try {
            // best-effort client cleanup; cookies cleared server-side on logout
            if (typeof window !== 'undefined') {
              localStorage.removeItem('munlink:role')
              localStorage.removeItem('munlink:user')
            }
          } catch { }
          window.location.href = '/login'
          return Promise.reject(error)
        }
      } catch { }
    }

    return Promise.reject(error)
  }
)

// API methods
export const authApi = {
  register: (data: any, files?: { profile_picture?: File, valid_id_front?: File, valid_id_back?: File, selfie_with_id?: File, municipality_slug?: string }) => {
    if (files) {
      const form = new FormData()
      Object.entries(data || {}).forEach(([k, v]) => form.append(k, String(v ?? '')))
      if (files.municipality_slug) form.append('municipality_slug', files.municipality_slug)
      if (files.profile_picture) form.append('profile_picture', files.profile_picture)
      // Optional: accept verification docs at registration if provided
      if (files.valid_id_front) form.append('valid_id_front', files.valid_id_front)
      if (files.valid_id_back) form.append('valid_id_back', files.valid_id_back)
      if (files.selfie_with_id) form.append('selfie_with_id', files.selfie_with_id)
      return api.post('/api/auth/register', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    }
    return api.post('/api/auth/register', data)
  },
  login: (data: any) => api.post('/api/auth/login', data),
  logout: () => api.post('/api/auth/logout'),
  getProfile: () => api.get('/api/auth/profile'),
  updateProfile: (data: any) => api.put('/api/auth/profile', data),
  uploadProfilePhoto: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/api/auth/profile/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  resendVerification: () => api.post('/api/auth/resend-verification'),
  resendVerificationPublic: (email: string) => api.post('/api/auth/resend-verification-public', { email }),
  requestPasswordReset: (email: string) => api.post('/api/auth/password-reset/request', { email }),
  validatePasswordReset: (token: string) => api.post('/api/auth/password-reset/validate', { token }),
  confirmPasswordReset: (token: string, new_password: string, confirm_password?: string) =>
    api.post('/api/auth/password-reset/confirm', { token, new_password, confirm_password }),
  uploadVerificationDocs: (files: { valid_id_front?: File, valid_id_back?: File, selfie_with_id?: File, municipality_slug?: string }) => {
    const form = new FormData()
    if (files.municipality_slug) form.append('municipality_slug', files.municipality_slug)
    if (files.valid_id_front) form.append('valid_id_front', files.valid_id_front)
    if (files.valid_id_back) form.append('valid_id_back', files.valid_id_back)
    if (files.selfie_with_id) form.append('selfie_with_id', files.selfie_with_id)
    return api.post('/api/auth/verification-docs', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export const provinceApi = {
  getAll: () => api.get('/api/provinces'),
  getById: (id: number) => api.get(`/api/provinces/${id}`),
  getBySlug: (slug: string) => api.get(`/api/provinces/slug/${slug}`),
  getMunicipalities: (id: number, params?: any) => api.get(`/api/provinces/${id}/municipalities`, { params }),
}

export const municipalityApi = {
  getAll: (params?: any) => api.get('/api/municipalities', { params }),
  getById: (id: number) => api.get(`/api/municipalities/${id}`),
  getBySlug: (slug: string) => api.get(`/api/municipalities/slug/${slug}`),
  getBarangays: (id: number) => api.get(`/api/municipalities/${id}/barangays`),
}

export const marketplaceApi = {
  getItems: (params?: any) => api.get('/api/marketplace/items', { params }),
  getItem: (id: number) => api.get(`/api/marketplace/items/${id}`),
  createItem: (data: any) => api.post('/api/marketplace/items', data),
  updateItem: (id: number, data: any) => api.put(`/api/marketplace/items/${id}`, data),
  deleteItem: (id: number) => api.delete(`/api/marketplace/items/${id}`),
  getMyItems: () => api.get('/api/marketplace/my-items'),
  createTransaction: (data: any) => api.post('/api/marketplace/transactions', data),
  // New proposal/confirmation flow
  proposeTransaction: (id: number, data: { pickup_at: string, pickup_location: string }) => api.post(`/api/marketplace/transactions/${id}/propose`, data),
  confirmTransaction: (id: number) => api.post(`/api/marketplace/transactions/${id}/confirm`),
  buyerRejectProposal: (id: number) => api.post(`/api/marketplace/transactions/${id}/reject-buyer`),
  // Dual-confirmation handover/returns
  handoverSeller: (id: number, notes?: string) => api.post(`/api/marketplace/transactions/${id}/handover-seller`, { notes }),
  handoverBuyer: (id: number, notes?: string) => api.post(`/api/marketplace/transactions/${id}/handover-buyer`, { notes }),
  returnBuyer: (id: number, notes?: string) => api.post(`/api/marketplace/transactions/${id}/return-buyer`, { notes }),
  returnSeller: (id: number, notes?: string) => api.post(`/api/marketplace/transactions/${id}/return-seller`, { notes }),
  complete: (id: number, notes?: string) => api.post(`/api/marketplace/transactions/${id}/complete`, { notes }),
  dispute: (id: number, reason: string) => api.post(`/api/marketplace/transactions/${id}/dispute`, { reason }),
  getAudit: (id: number) => api.get(`/api/marketplace/transactions/${id}/audit`),
  // Legacy accept (kept for compatibility in case other screens still call it)
  acceptTransaction: (id: number, data: { pickup_at: string, pickup_location: string }) => api.post(`/api/marketplace/transactions/${id}/accept`, data),
  rejectTransaction: (id: number) => api.post(`/api/marketplace/transactions/${id}/reject`),
  getMyTransactions: () => api.get('/api/marketplace/my-transactions'),
  uploadItemImage: (id: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/api/marketplace/items/${id}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export const announcementsApi = {
  getAll: (params?: any) => api.get('/api/announcements', { params }),
  getById: (id: number, params?: any) => api.get(`/api/announcements/${id}`, { params }),
}

export const documentsApi = {
  getTypes: (params?: { municipality_id?: number; barangay_id?: number }) =>
    api.get('/api/documents/types', { params }),
  getType: (id: number) => api.get(`/api/documents/types/${id}`),
  createRequest: (data: any) => api.post('/api/documents/requests', data),
  getMyRequests: () => api.get('/api/documents/my-requests'),
  getRequest: (id: number) => api.get(`/api/documents/requests/${id}`),
  downloadDocument: (id: number) => api.get(`/api/documents/requests/${id}/download`, { responseType: 'blob' }),
  uploadSupportingDocs: (id: number, form: FormData) => api.post(`/api/documents/requests/${id}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getClaimTicket: (id: number, params?: any) => api.get(`/api/documents/requests/${id}/claim-ticket`, { params }),
  publicVerify: (requestNumber: string) => api.get(`/api/documents/verify/${encodeURIComponent(requestNumber)}`),
  // Fee calculation
  calculateFee: (params: { document_type_id: number, purpose_type?: string, business_type?: string, requirements_submitted?: boolean }) =>
    api.get('/api/documents/calculate-fee', { params }),
  // Payment
  getPaymentConfig: () => api.get('/api/documents/payment-config'),
  setPaymentMethod: (requestId: number, payment_method: 'stripe' | 'manual_qr') =>
    api.post(`/api/documents/requests/${requestId}/payment-method`, { payment_method }),
  createPaymentIntent: (requestId: number) => api.post(`/api/documents/requests/${requestId}/payment-intent`),
  confirmPayment: (requestId: number, paymentIntentId: string) =>
    api.post(`/api/documents/requests/${requestId}/confirm-payment`, { payment_intent_id: paymentIntentId }),
  uploadManualPaymentProof: (requestId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/api/documents/requests/${requestId}/manual-payment/proof`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  resendManualPaymentId: (requestId: number) =>
    api.post(`/api/documents/requests/${requestId}/manual-payment/resend-id`),
  submitManualPaymentId: (requestId: number, payment_id: string) =>
    api.post(`/api/documents/requests/${requestId}/manual-payment/submit`, { payment_id }),
  getManualPaymentProof: (requestId: number) =>
    api.get(`/api/documents/requests/${requestId}/manual-payment/proof`, { responseType: 'blob' }),
  getManualQrImage: (url?: string) =>
    api.get(url || '/api/documents/manual-qr-image', { responseType: 'blob' }),
}

export const specialStatusApi = {
  // Get my statuses
  getMyStatuses: () => api.get('/api/user/special-statuses'),
  // Apply for student status
  applyStudent: (data: FormData) => api.post('/api/user/special-statuses/student', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  // Apply for PWD status
  applyPwd: (data: FormData) => api.post('/api/user/special-statuses/pwd', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  // Apply for senior status
  applySenior: (data: FormData) => api.post('/api/user/special-statuses/senior', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  // Renew student status
  renewStudent: (statusId: number, data: FormData) => api.put(`/api/user/special-statuses/${statusId}/renew`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  // Get status types info (public)
  getStatusTypes: () => api.get('/api/special-status-types'),
}

export const issuesApi = {
  getAll: (params?: any) => api.get('/api/issues', { params }),
  getById: (id: number) => api.get(`/api/issues/${id}`),
  create: (data: any) => api.post('/api/issues', data),
  getMine: () => api.get('/api/issues/my'),
  upload: (id: number, form: FormData) => api.post(`/api/issues/${id}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getCategories: () => api.get('/api/issues/categories'),
}

export const benefitsApi = {
  getPrograms: (params?: any) => api.get('/api/benefits/programs', { params }),
  getProgram: (id: number) => api.get(`/api/benefits/programs/${id}`),
  createApplication: (data: any) => api.post('/api/benefits/applications', data),
  getMyApplications: () => api.get('/api/benefits/my-applications'),
  downloadApplicationDocument: (id: number, index: number) =>
    api.get(`/api/benefits/applications/${id}/documents/${index}`, { responseType: 'blob' }),
  uploadDocs: (id: number, form: FormData) => api.post(`/api/benefits/applications/${id}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  resubmitApplication: (id: number) => api.post(`/api/benefits/applications/${id}/resubmit`),
}

export const transferApi = {
  request: (to_municipality_id: number, notes: string, to_barangay_id?: number) => api.post('/api/auth/transfer', { to_municipality_id, notes, to_barangay_id }),
  listAdmin: (): Promise<any> => api.get('/api/admin/transfers'),
  updateAdmin: (id: number, status: 'approved' | 'rejected' | 'accepted') => api.put(`/api/admin/transfers/${id}/status`, { status }),
}

// Toast helper for consistent notifications
export const showToast = (message: string, _type: 'success' | 'error' | 'info' = 'info') => {
  // Use browser alert for now - in a real app you'd use a toast library
  alert(message)
}

export const mediaUrl = (p?: string): string => {
  if (!p) return ''
  let s = p.replace(/\\/g, '/').replace(/^\/+/, '')
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('api/')) return `${API_BASE_URL}/${s}`
  const idx = s.indexOf('/uploads/')
  if (idx !== -1) s = s.slice(idx + 9)
  s = s.replace(/^uploads\//, '')
  return `${API_BASE_URL}/uploads/${s}`
}

/**
 * Keep-alive ping to prevent Render cold starts.
 * Pings the API health endpoint every 10 minutes when the page is visible.
 * This keeps the server warm so users don't experience slow initial loads.
 */
let keepAliveInterval: ReturnType<typeof setInterval> | null = null

export const startKeepAlive = () => {
  if (keepAliveInterval) return // Already running

  const ping = async () => {
    // Only ping if the page is visible (don't waste resources when tab is hidden)
    if (document.visibilityState === 'visible') {
      try {
        await axios.get(`${API_BASE_URL}/health`, { timeout: 30000 })
        console.debug('[KeepAlive] Server pinged successfully')
      } catch (err) {
        console.debug('[KeepAlive] Ping failed (server may be waking up)')
      }
    }
  }

  // Initial ping to warm up the server immediately
  void ping()

  // Ping every 10 minutes (600,000ms) to keep server warm
  // Render's free tier spins down after ~15 mins of inactivity
  keepAliveInterval = setInterval(ping, 10 * 60 * 1000)

  // Also ping when the page becomes visible again (user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void ping()
    }
  })
}

export const stopKeepAlive = () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
  }
}

export default api
