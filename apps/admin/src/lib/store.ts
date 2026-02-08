import { create } from 'zustand'
import { authApi, bootstrapAuth as apiBootstrap, clearAccessToken, setAccessToken, setAuthFailureHandler } from './api'

export type User = {
  id: number
  username: string
  email: string
  first_name: string
  middle_name?: string
  last_name: string
  role: string
  admin_municipality_id?: number
  admin_barangay_id?: number
  barangay_id?: number
  profile_picture?: string
  email_verified: boolean
  admin_verified: boolean
  municipality_name?: string
  municipality_slug?: string
  admin_municipality_name?: string
  admin_municipality_slug?: string
  barangay_name?: string
  barangay_slug?: string
  mobile_number?: string
  notify_email_enabled?: boolean
  notify_sms_enabled?: boolean
  permissions?: string[]
}

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
}

type AdminState = {
  user?: User
  accessToken?: string
  refreshToken?: string
  isAuthenticated: boolean
  isAuthBootstrapped: boolean
  setAuth: (user: User, accessToken: string) => void
  setTokens: (accessToken: string) => void
  logout: () => void
  updateUser: (user: User) => void
  setAuthBootstrapped: (v: boolean) => void
  bootstrapAuth: () => Promise<void>
}

export const useAdminStore = create<AdminState>((set, get) => {
  // Load user from localStorage on init (tokens managed by api.ts layer)
  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('admin:user') : null

  let initialUser: User | undefined
  try {
    initialUser = storedUser ? JSON.parse(storedUser) : undefined
  } catch {
    initialUser = undefined
  }

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin:user')
      try { sessionStorage.clear() } catch { }
    }
    clearAccessToken()
    set({ user: undefined, accessToken: undefined, refreshToken: undefined, isAuthenticated: false, isAuthBootstrapped: true })
  }

  // Allow API layer to trigger logout without importing the store
  setAuthFailureHandler(() => get().logout())

  return {
    user: initialUser,
    accessToken: undefined,
    refreshToken: undefined,
    isAuthenticated: false, // Will be set by bootstrapAuth
    isAuthBootstrapped: false,
    setAuth: (user, accessToken) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin:user', JSON.stringify(user))
      }
      // Hydrate access token in api layer (refresh token is httpOnly cookie)
      setAccessToken(accessToken)
      set({ user, accessToken, isAuthenticated: true, isAuthBootstrapped: true })
    },
    setTokens: (accessToken) => {
      // Update in-memory token via api layer
      setAccessToken(accessToken)
      set((state) => ({
        accessToken,
        isAuthenticated: !!accessToken && !!state.user,
      }))
    },
    logout,
    updateUser: (user) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin:user', JSON.stringify(user))
      }
      set({ user })
    },
    setAuthBootstrapped: (v) => set({ isAuthBootstrapped: v }),
    bootstrapAuth: async () => {
      if (typeof window === 'undefined') {
        set({ isAuthBootstrapped: true })
        return
      }

      // First, restore cached user from localStorage if available
      const storedUser = localStorage.getItem('admin:user')
      let cachedUser: User | undefined
      try {
        cachedUser = storedUser ? JSON.parse(storedUser) : undefined
      } catch {
        cachedUser = undefined
      }

      try {
        // Use cookie-based auth bootstrap from api layer
        const hasAuth = await apiBootstrap()

        if (hasAuth) {
          // We have a valid token, try to fetch fresh user profile
          try {
            const resp = await authApi.getProfile()
            const maybeWrapped = (resp as any)?.data
            const user = (
              maybeWrapped && typeof maybeWrapped === 'object' && 'id' in maybeWrapped
                ? maybeWrapped
                : resp
            ) as User

            if (user?.id) {
              localStorage.setItem('admin:user', JSON.stringify(user))
              set({ user, isAuthenticated: true })
            } else if (cachedUser) {
              // Profile fetch returned no data, but we have cached user - use it
              set({ user: cachedUser, isAuthenticated: true })
            } else {
              // No profile data and no cached user
              set({ isAuthenticated: false, user: undefined })
            }
          } catch {
            // Profile fetch failed (could be network, expired token, etc.)
            // If we have a cached user, use it and stay authenticated
            if (cachedUser) {
              set({ user: cachedUser, isAuthenticated: true })
            } else {
              // No cached user, clear auth
              set({ isAuthenticated: false, user: undefined })
            }
          }
        } else {
          // No valid auth token, clear state
          set({ isAuthenticated: false, user: undefined })
          if (typeof window !== 'undefined') {
            localStorage.removeItem('admin:user')
          }
        }
      } catch {
        // Bootstrap failed completely
        // If we have a cached user and a token might exist, stay authenticated
        if (cachedUser) {
          set({ user: cachedUser, isAuthenticated: true })
        } else {
          set({ isAuthenticated: false, user: undefined })
        }
      } finally {
        set({ isAuthBootstrapped: true })
      }
    },
  }
})
