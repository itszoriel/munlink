import { create } from 'zustand'
import { authApi } from './api'
import { setSessionAccessToken as setApiSessionAccessToken, getAccessToken as getApiAccessToken } from './api'

export type Province = {
  id: number
  name: string
  slug: string
  region_name?: string
}

export type Municipality = {
  id: number
  name: string
  slug: string
  province_id?: number
  province?: Province
  sealUrl?: string
}

export type Barangay = {
  id: number
  name: string
  slug: string
  municipality_id: number
}

type User = {
  id: number
  username: string
  role: 'public' | 'resident' | 'municipal_admin'
  municipality_id?: number
  municipality_name?: string
  barangay_id?: number
  barangay_name?: string
  email_verified?: boolean
  admin_verified?: boolean
  mobile_number?: string
  notify_email_enabled?: boolean
  notify_sms_enabled?: boolean
  profile_picture?: string
  valid_id_front?: string
  valid_id_back?: string
  selfie_with_id?: string
}

type AppState = {
  selectedProvince?: Province
  setProvince: (p?: Province) => void
  selectedMunicipality?: Municipality
  setMunicipality: (m?: Municipality) => void
  selectedBarangay?: Barangay
  setBarangay: (b?: Barangay) => void
  role: 'public' | 'resident' | 'admin'
  setRole: (r: 'public' | 'resident' | 'admin') => void
  user?: User
  accessToken?: string
  refreshToken?: string
  isAuthenticated: boolean
  isAuthBootstrapped: boolean
  setAuthBootstrapped: (v: boolean) => void
  emailVerified: boolean
  adminVerified: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  loginAs: (r: 'resident' | 'admin') => void
  logout: () => void
}

export const useAppStore = create<AppState>((set) => {
  const storedRole = (typeof window !== 'undefined' && (localStorage.getItem('munlink:role') as any)) || 'public'
  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('munlink:user') : null
  const storedMunicipality = typeof window !== 'undefined' ? localStorage.getItem('munlink:selectedMunicipality') : null
  const storedBarangay = typeof window !== 'undefined' ? localStorage.getItem('munlink:selectedBarangay') : null
  // no persisted tokens; use in-memory + sessionStorage handled in api layer

  let initialUser: User | undefined
  try {
    initialUser = storedUser ? JSON.parse(storedUser) : undefined
  } catch {
    initialUser = undefined
  }

  // Auto-select Zambales province (platform is Zambales-only)
  const initialProvince: Province = { id: 6, name: 'Zambales', slug: 'zambales', region_name: 'Zambales' }

  let initialMunicipality: Municipality | undefined
  try {
    initialMunicipality = storedMunicipality ? JSON.parse(storedMunicipality) : undefined
  } catch {
    initialMunicipality = undefined
  }

  let initialBarangay: Barangay | undefined
  try {
    initialBarangay = storedBarangay ? JSON.parse(storedBarangay) : undefined
  } catch {
    initialBarangay = undefined
  }

  const emailVerified = !!initialUser?.email_verified
  const adminVerified = !!initialUser?.admin_verified

  // Function to refresh user profile data
  const refreshUserProfile = async () => {
    if (typeof window !== 'undefined' && getApiAccessToken()) {
      try {
        const { authApi } = await import('./api')
        const response = await authApi.getProfile()
        const userData = response.data
        if (userData) {
          // Update localStorage and state
          localStorage.setItem('munlink:user', JSON.stringify(userData))
          set({
            user: userData,
            emailVerified: !!userData.email_verified,
            adminVerified: !!userData.admin_verified,
          })
        }
      } catch (error) {
        console.error('Failed to refresh user profile:', error)
      }
    }
  }

  // Refresh profile on app load if user is authenticated
  if (typeof window !== 'undefined' && getApiAccessToken() && initialUser) {
    // Check if user data is missing ID document fields (old data)
    if (!initialUser.valid_id_front && !initialUser.valid_id_back && !initialUser.selfie_with_id) {
      refreshUserProfile()
    }
  }

  return {
    selectedProvince: initialProvince,
    setProvince: (p) => {
      // Province is auto-selected to Zambales and cannot be changed
      // Keep this function for API compatibility but don't allow changes
      if (p && p.id !== 6) {
        console.warn('Only Zambales province is supported')
        return
      }
      set({ selectedProvince: initialProvince })
    },
    selectedMunicipality: initialMunicipality,
    setMunicipality: (m) => {
      if (typeof window !== 'undefined' && m) {
        localStorage.setItem('munlink:selectedMunicipality', JSON.stringify(m))
        localStorage.removeItem('munlink:selectedBarangay')
      } else if (typeof window !== 'undefined') {
        localStorage.removeItem('munlink:selectedMunicipality')
        localStorage.removeItem('munlink:selectedBarangay')
      }
      set({ selectedMunicipality: m, selectedBarangay: undefined })
    },
    selectedBarangay: initialBarangay,
    setBarangay: (b) => {
      if (typeof window !== 'undefined' && b) {
        localStorage.setItem('munlink:selectedBarangay', JSON.stringify(b))
      } else if (typeof window !== 'undefined') {
        localStorage.removeItem('munlink:selectedBarangay')
      }
      set({ selectedBarangay: b })
    },
    role: storedRole,
    setRole: (r) => {
      if (typeof window !== 'undefined') localStorage.setItem('munlink:role', r)
      set({ role: r, isAuthenticated: r !== 'public' })
    },
    user: initialUser,
    accessToken: undefined,
    refreshToken: undefined,
    isAuthenticated: !!getApiAccessToken() && storedRole !== 'public',
    isAuthBootstrapped: false,
    setAuthBootstrapped: (v) => set({ isAuthBootstrapped: v }),
    emailVerified,
    adminVerified,
    setAuth: (user, accessToken, _refreshToken) => {
      const mappedRole: 'public' | 'resident' | 'admin' = user.role === 'municipal_admin' ? 'admin' : (user.role as any)
      // Only allow resident sessions in web app
      if (mappedRole !== 'resident') {
        return
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('munlink:role', mappedRole)
        localStorage.setItem('munlink:user', JSON.stringify(user))
      }
      // hydrate in-memory token and schedule proactive refresh
      setApiSessionAccessToken(accessToken)
      set({
        user,
        accessToken,
        refreshToken: undefined,
        role: mappedRole,
        isAuthenticated: true,
        emailVerified: !!user.email_verified,
        adminVerified: !!user.admin_verified,
      })
    },
    loginAs: (r) => {
      if (typeof window !== 'undefined') localStorage.setItem('munlink:role', r)
      set({ role: r, isAuthenticated: true })
    },
    logout: () => {
      // best-effort server logout to clear cookie and blacklist token
      try {
        if (getApiAccessToken()) {
          void authApi.logout().catch(() => {})
        }
      } catch {}
      if (typeof window !== 'undefined') {
        localStorage.removeItem('munlink:role')
        localStorage.removeItem('munlink:user')
      }
      setApiSessionAccessToken(null)
      set({ role: 'public', isAuthenticated: false, user: undefined, accessToken: undefined, refreshToken: undefined, emailVerified: false, adminVerified: false })
    },
  }
})
