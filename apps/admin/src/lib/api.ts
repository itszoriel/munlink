/**
 * MunLink Zambales - Admin API Client
 * Centralized API client with authentication and error handling
 */
import axios from 'axios'
import type { AxiosResponse, AxiosError, AxiosInstance } from 'axios'
import { useAdminStore } from './store'

// API Configuration
// Production URL for Railway deployment
const PRODUCTION_API_URL = 'https://api-munlink.up.railway.app'
const isBrowser = typeof window !== 'undefined'
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (import.meta as any).env?.VITE_API_URL ||
  PRODUCTION_API_URL

// In-memory access token (sessionStorage for persistence across page loads)
let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null
let isBootstrapping = false // Flag to prevent redirects during bootstrap

// Flag to track if admin has ever logged in (avoids 401 errors on fresh loads)
const HAS_SESSION_KEY = 'admin:has_session'

// Token management helpers
export const getAccessToken = (): string | null => accessToken
export const setAccessToken = (token: string | null) => {
  accessToken = token
  try {
    if (token) {
      sessionStorage.setItem('admin:access_token', token)
      // Mark that admin has a session (for refresh attempts)
      localStorage.setItem(HAS_SESSION_KEY, 'true')
    } else {
      sessionStorage.removeItem('admin:access_token')
    }
  } catch { }
}
export const clearAccessToken = () => {
  accessToken = null
  try {
    sessionStorage.removeItem('admin:access_token')
    // Clear session flag on logout
    localStorage.removeItem(HAS_SESSION_KEY)
  } catch { }
}

// Check if admin has ever had a session (to avoid unnecessary refresh calls on fresh loads)
const hasHadSession = (): boolean => {
  try {
    return localStorage.getItem(HAS_SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

// Cookie-based refresh using httpOnly cookie (like web app)
async function doRefresh(): Promise<string | null> {
  try {
    const resp = await axios.post(
      `${API_BASE_URL}/api/auth/refresh`,
      {},
      {
        withCredentials: true,
        validateStatus: () => true
      }
    )
    if (resp.status !== 200) return null
    const newToken: string | undefined = resp?.data?.access_token
    if (newToken) {
      setAccessToken(newToken)
      return newToken
    }
  } catch {
    // ignore; caller handles logout
  }
  return null
}

// Bootstrap auth from sessionStorage + cookie refresh
export async function bootstrapAuth(): Promise<boolean> {
  isBootstrapping = true

  try {
    // First, hydrate from sessionStorage if present for immediate UX
    try {
      const saved = sessionStorage.getItem('admin:access_token')
      if (saved) {
        setAccessToken(saved)
        // Attempt background refresh to extend session
        void doRefresh()
        return true
      }
    } catch { }

    // Only attempt refresh if admin has had a session before
    // This prevents 401 errors on fresh loads when user has never logged in
    if (!hasHadSession()) {
      return false
    }

    // Attempt to hydrate from refresh cookie once on app load
    const token = await doRefresh()
    return !!token
  } finally {
    isBootstrapping = false
  }
}

// Create axios instance with longer timeout for admin operations
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds for admin panel (was 10s, causing timeouts)
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Required for CORS with credentials
})

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for token refresh and richer error logging
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Use cookie-based refresh (not localStorage token!)
        refreshPromise = refreshPromise || doRefresh()
        const newToken = await refreshPromise.finally(() => { refreshPromise = null })
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`
          return apiClient(originalRequest)
        }
      } catch { }

      // Refresh failed - if we're bootstrapping, don't redirect (let the store handle it)
      if (!isBootstrapping) {
        const { logout } = useAdminStore.getState()
        logout()
        // Only redirect if we're not already on a public/login page
        const publicPaths = /^\/(login|register|superadmin\/login|provincial|barangay)?(\/.*)?$/
        if (!publicPaths.test(window.location.pathname) && window.location.pathname !== '/') {
          window.location.href = '/'
        }
      }
      return Promise.reject(error)
    }

    // Handle role mismatch
    if (error.response?.status === 403) {
      try {
        const data: any = error.response?.data
        if (data?.code === 'ROLE_MISMATCH') {
          const { logout } = useAdminStore.getState()
          logout()
          window.location.href = '/'
          return Promise.reject(error)
        }
      } catch { }
    }

    // Log detailed error info for debugging (422 and others)
    try {
      const status = error.response?.status
      const data: any = error.response?.data
      const url = (error.config as any)?.url
      console.error('API Error:', { status, url, data })
    } catch { }

    return Promise.reject(error)
  }
)

// API Response Types
export interface ApiResponse<T = any> {
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
  }
}

// Auth API
export const authApi = {
  adminLogin: async (payload: { username?: string; email?: string; password: string }): Promise<ApiResponse & { access_token: string; refresh_token: string; user: any }> => {
    // Prefer generic login endpoint (exists), avoids preflight to non-existent admin route
    try {
      const res = await apiClient.post('/api/auth/login', payload)
      return res.data
    } catch (e: any) {
      // If generic login is missing, try admin-specific
      try {
        const res = await apiClient.post('/api/auth/admin/login', payload)
        return res.data
      } catch (e2) {
        throw e
      }
    }
  },
  getProfile: async (): Promise<ApiResponse<any>> =>
    apiClient.get('/api/auth/profile').then(res => res.data),
  updateProfile: async (data: Partial<{ first_name: string; middle_name?: string; last_name: string; suffix?: string; phone_number?: string; mobile_number?: string }>): Promise<ApiResponse<any>> =>
    apiClient.put('/api/auth/profile', data).then(res => res.data),
  uploadProfilePhoto: async (file: File): Promise<ApiResponse<any>> => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post('/api/auth/profile/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data)
  },
}

// Media helper
export const mediaUrl = (p?: string): string => {
  if (!p) return ''
  const normalized = p.replace(/\\/g, '/').replace(/^\/+/, '')
  if (/^https?:\/\//i.test(normalized)) return normalized
  const withUploads = normalized.startsWith('uploads/') ? normalized : `uploads/${normalized}`
  return `${API_BASE_URL}/${withUploads}`
}

// User Management API
export const userApi = {
  // Get pending users for verification
  getPendingUsers: (): Promise<ApiResponse<{ users: any[]; count: number }>> =>
    apiClient.get('/api/admin/users/pending').then(res => res.data),

  // Get verified users with pagination
  getVerifiedUsers: (page = 1, perPage = 20): Promise<PaginatedResponse<any>> =>
    apiClient.get(`/api/admin/users/verified?page=${page}&per_page=${perPage}`).then(res => res.data),

  // Verify a user
  verifyUser: (userId: number): Promise<ApiResponse> =>
    apiClient.post(`/api/admin/users/${userId}/verify`).then(res => res.data),

  // Reject a user
  rejectUser: (userId: number, reason: string): Promise<ApiResponse> =>
    apiClient.post(`/api/admin/users/${userId}/reject`, { reason }).then(res => res.data),

  // Get user statistics
  getUserStats: (): Promise<ApiResponse<{
    total_users: number
    pending_verifications: number
    verified_users: number
    recent_registrations: number
  }>> =>
    apiClient.get('/api/admin/users/stats').then(res => res.data),

  // Get user by id (detail for modal)
  getUserById: (userId: number): Promise<ApiResponse<any>> =>
    apiClient.get(`/api/admin/users/${userId}`).then(res => res.data),

  // Upload verification documents for a user (admin re-upload)
  uploadUserVerificationDocs: async (userId: number, files: { valid_id_front?: File, valid_id_back?: File }): Promise<ApiResponse<any>> => {
    const form = new FormData()
    if (files.valid_id_front) form.append('valid_id_front', files.valid_id_front)
    if (files.valid_id_back) form.append('valid_id_back', files.valid_id_back)
    return apiClient.post(`/api/admin/users/${userId}/verification-docs`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data)
  },

  // Get resident document (secure, with audit)
  getResidentDocument: (userId: number, docType: string, reason: string) =>
    apiClient.get(`/api/admin/residents/${userId}/documents/${docType}`, {
      params: { reason },
      responseType: 'blob'  // Important for binary image data
    }).then(res => res.data),
}

// Issue Management API
export const issueApi = {
  // Get issues with filters
  getIssues: (filters: {
    status?: string
    category?: string
    page?: number
    per_page?: number
  } = {}): Promise<PaginatedResponse<any>> => {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.category) params.append('category', filters.category)
    if (filters.page) params.append('page', filters.page.toString())
    if (filters.per_page) params.append('per_page', filters.per_page.toString())

    return apiClient.get(`/api/admin/issues?${params.toString()}`).then(res => res.data)
  },

  // Get issue details
  getIssue: (issueId: number): Promise<ApiResponse<any>> =>
    apiClient.get(`/api/admin/issues/${issueId}`).then(res => res.data),

  // Update issue status
  updateIssueStatus: (issueId: number, status: string): Promise<ApiResponse> =>
    apiClient.put(`/api/admin/issues/${issueId}/status`, { status }).then(res => res.data),

  // Add admin response to issue
  addIssueResponse: (issueId: number, response: string): Promise<ApiResponse> =>
    apiClient.post(`/api/admin/issues/${issueId}/response`, { response }).then(res => res.data),

  // Get issue statistics
  getIssueStats: (): Promise<ApiResponse<{
    total_issues: number
    pending_issues: number
    active_issues: number
    resolved_issues: number
  }>> =>
    apiClient.get('/api/admin/issues/stats').then(res => res.data),
}

// Marketplace API
export const marketplaceApi = {
  // Get pending marketplace items
  getPendingItems: (): Promise<ApiResponse<{ items: any[]; count: number }>> =>
    apiClient.get('/api/admin/marketplace/pending').then(res => res.data),

  // Approve marketplace item
  approveItem: (itemId: number): Promise<ApiResponse> =>
    apiClient.post(`/api/admin/marketplace/${itemId}/approve`).then(res => res.data),

  // Reject marketplace item
  rejectItem: (itemId: number, reason: string): Promise<ApiResponse> =>
    apiClient.post(`/api/admin/marketplace/${itemId}/reject`, { reason }).then(res => res.data),

  // Get marketplace statistics
  getMarketplaceStats: (): Promise<ApiResponse<{
    total_items: number
    pending_items: number
    approved_items: number
    rejected_items: number
  }>> =>
    apiClient.get('/api/admin/marketplace/stats').then(res => res.data),
  // Public list (scoped by municipality/status) via public endpoint
  listPublicItems: (params: { municipality_id?: number; status?: string; page?: number; per_page?: number; category?: string; transaction_type?: string } = {}): Promise<ApiResponse<{ items: any[]; total: number; page: number; per_page: number; pages: number }>> =>
    apiClient.get('/api/marketplace/items', { params }).then(res => res.data),
}

// Transactions (Admin)
export const transactionsAdminApi = {
  list: (params: { status?: string; page?: number; per_page?: number } = {}): Promise<ApiResponse<{ transactions: any[]; total: number; page: number; pages: number; per_page: number }>> =>
    apiClient.get('/api/admin/transactions', { params }).then(res => res.data),
  get: (id: number): Promise<ApiResponse<{ transaction: any; audit: any[] }>> =>
    apiClient.get(`/api/admin/transactions/${id}`).then(res => res.data),
  setStatus: (id: number, status: 'under_review' | 'resolved' | 'confirmed_scam', notes?: string): Promise<ApiResponse<{ message: string }>> =>
    apiClient.put(`/api/admin/transactions/${id}/status`, { status, notes }).then(res => res.data),
}

// Announcements API
export const announcementApi = {
  // Get all announcements
  getAnnouncements: (): Promise<ApiResponse<{ announcements: any[]; count: number }>> =>
    apiClient.get('/api/admin/announcements').then(res => res.data),

  // Create announcement
  createAnnouncement: (data: {
    title: string
    content: string
    priority: 'high' | 'medium' | 'low'
    external_url?: string
    scope?: 'PROVINCE' | 'MUNICIPALITY' | 'BARANGAY'
    municipality_id?: number
    barangay_id?: number
    status?: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'
    publish_at?: string
    expire_at?: string
    pinned?: boolean
    pinned_until?: string
  } | FormData): Promise<ApiResponse> => {
    const isForm = (typeof FormData !== 'undefined') && (data instanceof FormData)
    return apiClient.post('/api/admin/announcements', data, isForm ? {
      headers: { 'Content-Type': 'multipart/form-data' },
    } : undefined).then(res => res.data)
  },

  // Upload announcement image
  uploadImage: (id: number, file: File): Promise<ApiResponse<{ path: string; announcement: any }>> => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post(`/api/admin/announcements/${id}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data)
  },

  // Upload multiple images (batch)
  uploadImages: (id: number, files: File[]): Promise<ApiResponse<{ paths: string[]; announcement: any }>> => {
    const form = new FormData()
    // Use repeated 'file' parts to match backend getlist handling
    files.forEach((f) => form.append('file', f))
    return apiClient.post(`/api/admin/announcements/${id}/uploads`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data)
  },

  // Update announcement
  updateAnnouncement: (id: number, data: {
    title?: string
    content?: string
    priority?: 'high' | 'medium' | 'low'
    is_active?: boolean
    status?: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'
    scope?: 'PROVINCE' | 'MUNICIPALITY' | 'BARANGAY'
    municipality_id?: number
    barangay_id?: number
    publish_at?: string
    expire_at?: string
    pinned?: boolean
    pinned_until?: string
    images?: string[]
    external_url?: string
  } | FormData): Promise<ApiResponse> => {
    const isForm = (typeof FormData !== 'undefined') && (data instanceof FormData)
    return apiClient.put(`/api/admin/announcements/${id}`, data, isForm ? {
      headers: { 'Content-Type': 'multipart/form-data' },
    } : undefined).then(res => res.data)
  },

  // Delete announcement
  deleteAnnouncement: (id: number): Promise<ApiResponse> =>
    apiClient.delete(`/api/admin/announcements/${id}`).then(res => res.data),

  // Get announcement statistics
  getAnnouncementStats: (): Promise<ApiResponse<{
    total_announcements: number
    published_announcements: number
    active_announcements: number
    draft_announcements: number
    archived_announcements: number
    pinned_active: number
  }>> =>
    apiClient.get('/api/admin/announcements/stats').then(res => res.data),
}

// Benefits API
export const benefitsApi = {
  // Get benefit programs (public), optionally scoped by municipality
  getPrograms: (municipalityId?: number): Promise<ApiResponse<{ programs: any[]; count: number }>> =>
    apiClient
      .get('/api/benefits/programs', {
        params: municipalityId ? { municipality_id: municipalityId } : undefined,
      })
      .then((res) => res.data),
  // Get single program (public)
  getProgramById: (id: number): Promise<ApiResponse<any>> =>
    apiClient.get(`/api/benefits/programs/${id}`).then((res) => res.data),
}

// Admin Benefits API
export const benefitsAdminApi = {
  listPrograms: (): Promise<ApiResponse<{ programs: any[]; count: number }>> =>
    apiClient.get('/api/admin/benefits/programs').then((res) => res.data),
  createProgram: (data: any): Promise<ApiResponse> => {
    const isForm = (typeof FormData !== 'undefined') && (data instanceof FormData)
    return apiClient.post('/api/admin/benefits/programs', data, isForm ? {
      headers: { 'Content-Type': 'multipart/form-data' },
    } : undefined).then((res) => res.data)
  },
  updateProgram: (id: number, data: any): Promise<ApiResponse> => {
    const isForm = (typeof FormData !== 'undefined') && (data instanceof FormData)
    return apiClient.put(`/api/admin/benefits/programs/${id}`, data, isForm ? {
      headers: { 'Content-Type': 'multipart/form-data' },
    } : undefined).then((res) => res.data)
  },
  completeProgram: (id: number): Promise<ApiResponse> =>
    apiClient.put(`/api/admin/benefits/programs/${id}/complete`, {}).then((res) => res.data),
  deleteProgram: (id: number): Promise<ApiResponse> =>
    apiClient.delete(`/api/admin/benefits/programs/${id}`).then((res) => res.data),
}

// Dashboard API
export const dashboardApi = {
  // Get dashboard statistics
  getDashboardStats: (): Promise<ApiResponse<{
    pending_verifications: number
    active_issues: number
    marketplace_items: number
    announcements: number
  }>> =>
    apiClient.get('/api/admin/dashboard/stats').then(res => res.data),
  getUserGrowth: (range: string = 'last_30_days'): Promise<ApiResponse<{ series: Array<{ day: string; count: number }> }>> =>
    apiClient.get('/api/admin/users/growth', { params: { range } }).then(res => res.data),
}

// Transfers (Resident Municipality Transfers)
export const transferAdminApi = {
  list: (params: { status?: string; q?: string; page?: number; per_page?: number; sort?: string; order?: 'asc' | 'desc' } = {}): Promise<ApiResponse<{ transfers: any[]; count?: number; page?: number; pages?: number; per_page?: number; total?: number }>> =>
    apiClient.get('/api/admin/transfers', { params }).then(res => res.data),
  updateStatus: (id: number, status: 'approved' | 'rejected' | 'accepted'): Promise<ApiResponse<{ transfer: any }>> =>
    apiClient.put(`/api/admin/transfers/${id}/status`, { status }).then(res => res.data),
}

export const municipalitiesApi = {
  list: (): Promise<ApiResponse<{ municipalities: any[] }>> =>
    apiClient.get('/api/municipalities').then(res => res.data),
}

// Admin aggregate API matching requested endpoints
export const adminApi = {
  // Users (generic list)
  getUsers: async (params: Record<string, any> = {}): Promise<{ users: any[]; pagination?: any }> => {
    // Prefer verified users endpoint that exists
    try {
      const page = params.page || 1
      const perPage = params.per_page || 20
      const verified = await userApi.getVerifiedUsers(page, perPage)
      return { users: verified.data, pagination: verified.pagination }
    } catch {
      // Try generic users endpoint if available
      const res = await apiClient.get('/api/admin/users', { params })
      return res.data
    }
  },
  // Requests (documents)
  getRequests: async (params: Record<string, any> = {}): Promise<{ requests: any[]; pagination?: any }> => {
    try {
      const res = await apiClient.get('/api/admin/documents/requests', { params })
      return res.data
    } catch (error) {
      console.error('Failed to fetch document requests:', error)
      throw error
    }
  },
  // Document request stats - single optimized endpoint instead of 5 concurrent calls
  getRequestStats: async (): Promise<{
    total_requests: number
    pending_requests: number
    barangay_processing_requests: number
    barangay_approved_requests: number
    barangay_rejected_requests: number
    processing_requests: number
    ready_requests: number
    completed_requests: number
    rejected_requests: number
  }> => {
    const res = await apiClient.get('/api/admin/documents/stats')
    return res.data
  },
  // Marketplace items
  getItems: async (params: Record<string, any> = {}): Promise<{ items: any[]; pagination?: any }> => {
    // Prefer marketplace pending items endpoint that exists
    try {
      const pending = await marketplaceApi.getPendingItems()
      const data = (pending as any)?.data || pending
      return { items: data?.items || data || [], pagination: undefined }
    } catch {
      const res = await apiClient.get('/api/admin/items', { params })
      return res.data
    }
  },
  // Transactions (for reports)
  getTransactions: async (params: Record<string, any> = {}): Promise<{ transactions: any[]; pagination?: any }> => {
    const res = await apiClient.get('/api/admin/transactions', { params })
    return res.data
  },
  // Reports aggregate
  getReports: async (): Promise<any> => {
    // Prefer composing from known endpoints to avoid CORS preflight failures on non-existent routes
    const [dashRes, userRes] = await Promise.allSettled([
      dashboardApi.getDashboardStats(),
      userApi.getUserStats(),
    ])

    const dash = dashRes.status === 'fulfilled' ? (dashRes.value as any)?.data || dashRes.value : undefined
    const users = userRes.status === 'fulfilled' ? (userRes.value as any)?.data || userRes.value : undefined

    if (dash || users) {
      return { dashboard: dash, users }
    }

    // As a last resort, try a backend aggregate endpoint if present
    const res = await apiClient.get('/api/admin/reports')
    return res.data
  },
}

// Error handling utility
export const handleApiError = (error: any, _context?: string): string => {
  // Prefer Flask-JWT-Extended default error shape
  const data: any = error.response?.data || {}
  const base = data?.msg || data?.error || error.message || 'An unexpected error occurred'
  if (data?.details) {
    return `${base}: ${data.details}`
  }
  return base
}

// Toast helper for consistent notifications
export const showToast = (message: string, _type: 'success' | 'error' | 'info' = 'info') => {
  // Use browser alert for now - in a real app you'd use a toast library
  alert(message)
}

// Export the main API client for custom requests
export default apiClient

// Admin Reports supplemental APIs
export const documentsAdminApi = {
  getStats: (range: string = 'last_30_days'): Promise<ApiResponse<{ total_requests: number; top_requested: Array<{ name: string; count: number }> }>> =>
    apiClient.get('/api/admin/documents/stats', { params: { range } }).then(res => res.data),
  listRequests: (params: Record<string, any> = {}): Promise<ApiResponse<{ requests: any[]; pagination?: any }>> =>
    apiClient.get('/api/admin/documents/requests', { params }).then(res => res.data),
  generatePdf: (id: number): Promise<ApiResponse<{ url: string; request: any }>> =>
    apiClient.post(`/api/admin/documents/requests/${id}/generate-pdf`).then(res => res.data),
  downloadPdf: (id: number): Promise<ApiResponse<{ url: string }>> =>
    apiClient.get(`/api/admin/documents/requests/${id}/download`).then(res => res.data),
  updateStatus: (id: number, status: string, admin_notes?: string, rejection_reason?: string): Promise<ApiResponse<{ request: any }>> =>
    apiClient.put(`/api/admin/documents/requests/${id}/status`, { status, admin_notes, rejection_reason }).then(res => res.data),
  updateContent: (id: number, data: { purpose?: string; remarks?: string; civil_status?: string; age?: number }): Promise<ApiResponse<{ request: any }>> =>
    apiClient.put(`/api/admin/documents/requests/${id}/content`, data).then(res => res.data),
  readyForPickup: (id: number, window?: { window_start?: string; window_end?: string }): Promise<ApiResponse<{ claim: { qr_path: string; code_masked: string; window_start?: string; window_end?: string; token: string }, request: any }>> =>
    apiClient.post(`/api/admin/documents/requests/${id}/ready-for-pickup`, window || {}).then(res => res.data),
  claimToken: (id: number, window?: { window_start?: string; window_end?: string }): Promise<ApiResponse<{ claim: { qr_path: string; code_masked: string; window_start?: string; window_end?: string; token: string }, request: any }>> =>
    apiClient.post(`/api/admin/documents/requests/${id}/claim-token`, window || {}).then(res => res.data),
  verifyClaim: (payload: { token?: string; code?: string; request_id?: number }): Promise<ApiResponse<{ ok: boolean; request?: any }>> =>
    apiClient.post('/api/admin/claim/verify', payload).then(res => res.data),
}

export const municipalitiesAdminApi = {
  getPerformance: (range: string = 'last_30_days'): Promise<ApiResponse<{ municipalities: Array<{ id: number; name: string; users: number; listings: number; documents: number; benefits_active?: number; disputes?: number }> }>> =>
    apiClient.get('/api/admin/municipalities/performance', { params: { range } }).then(res => res.data),
}

// Admin Exports & Audit
export const exportAdminApi = {
  exportPdf: (entity: 'users' | 'benefits' | 'requests' | 'issues' | 'items' | 'announcements' | 'audit', filters?: any): Promise<ApiResponse<{ url: string; summary?: any }>> =>
    apiClient.post(`/api/admin/exports/${entity}.pdf`, filters || {}).then(res => res.data),
  exportExcel: (entity: 'users' | 'benefits' | 'requests' | 'issues' | 'items' | 'announcements' | 'audit', filters?: any): Promise<ApiResponse<{ url: string; summary?: any }>> =>
    apiClient.post(`/api/admin/exports/${entity}.xlsx`, filters || {}).then(res => res.data),
  cleanup: (payload: { entity: 'announcements' | 'requests' | 'users' | 'benefits' | 'issues' | 'items'; before?: string; confirm: 'DELETE'; archive?: boolean }): Promise<ApiResponse<{ deleted_count: number; archived_url?: string }>> =>
    apiClient.post('/api/admin/cleanup', payload).then(res => res.data),
}

export const auditAdminApi = {
  list: (params: { entity_type?: string; entity_id?: number; actor_role?: string; action?: string; from?: string; to?: string; page?: number; per_page?: number } = {}): Promise<ApiResponse<{ logs: any[]; page: number; pages: number; per_page: number; total: number }>> =>
    apiClient.get('/api/admin/audit', { params }).then(res => res.data),
}

// =============================================================================
// SUPER ADMIN API (2FA Authentication + Audit Log)
// =============================================================================

export interface SuperAdminLoginResponse {
  message: string
  session_id: string
  expires_in: number
}

export interface SuperAdmin2FAResponse {
  message: string
  access_token: string
  refresh_token: string
  user: any
}

export interface AuditLogEntry {
  id: number
  admin_id: number | null
  admin_email: string
  admin_role?: string | null
  action: string
  resource_type: string | null
  resource_id: number | null
  ip_address: string | null
  user_agent: string | null
  details: Record<string, any> | null
  created_at: string
}

export interface AuditLogPagination {
  page: number
  per_page: number
  total: number
  pages: number
  has_next: boolean
  has_prev: boolean
  next_page?: number | null
  prev_page?: number | null
}

export const superAdminApi = {
  /**
   * Step 1: Login with email and password, receive 2FA code via email
   */
  login: async (email: string, password: string): Promise<SuperAdminLoginResponse> => {
    const res = await apiClient.post('/api/auth/superadmin/login', { email, password })
    return res.data
  },

  /**
   * Step 2: Verify 2FA code and get tokens
   */
  verify2FA: async (sessionId: string, code: string): Promise<SuperAdmin2FAResponse> => {
    const res = await apiClient.post('/api/auth/superadmin/verify-2fa', {
      session_id: sessionId,
      code: code
    })
    return res.data
  },

  /**
   * Resend 2FA code
   */
  resendCode: async (sessionId: string): Promise<SuperAdminLoginResponse> => {
    const res = await apiClient.post('/api/auth/superadmin/resend-code', {
      session_id: sessionId
    })
    return res.data
  },

  /**
   * Get list of all admin accounts (requires JWT auth as super admin)
   */
  getAdmins: async (params: { page?: number; per_page?: number } = {}): Promise<{ admins: any[]; pagination?: AuditLogPagination }> => {
    const res = await apiClient.get('/api/superadmin/admins', {
      params: {
        page: params.page || 1,
        per_page: params.per_page || 10
      }
    })
    return res.data
  },

  /**
   * Get audit log entries (requires JWT auth as super admin)
   */
  getAuditLog: async (params: {
    page?: number
    per_page?: number
    action?: string
    start_date?: string
    end_date?: string
    search?: string
  } = {}): Promise<{ audit_logs: AuditLogEntry[]; pagination: AuditLogPagination }> => {
    const res = await apiClient.get('/api/superadmin/audit-log', { params })
    return res.data
  },

  /**
   * Get available action types for filtering
   */
  getAuditActions: async (): Promise<{ actions: string[] }> => {
    const res = await apiClient.get('/api/superadmin/audit-log/actions')
    return res.data
  },

  /**
   * Export audit log as CSV
   */
  exportAuditLog: (params: {
    start_date?: string
    end_date?: string
    action?: string
  } = {}): string => {
    const searchParams = new URLSearchParams()
    if (params.start_date) searchParams.append('start_date', params.start_date)
    if (params.end_date) searchParams.append('end_date', params.end_date)
    if (params.action) searchParams.append('action', params.action)
    return `${API_BASE_URL}/api/superadmin/audit-log/export?${searchParams.toString()}`
  }
}
