/**
 * Global Data Cache Store
 * 
 * Solves two related issues:
 * 1. Data persistence across navigation - prevents unnecessary refetches
 * 2. Global UI state (modal visibility) - allows hiding FAB when modal is open
 * 
 * Data is cached with timestamps and only refetched when stale (default: 5 minutes)
 */
import { create } from 'zustand'

// Cache entry with timestamp for staleness checking
interface CacheEntry<T = any> {
  data: T
  fetchedAt: number
  isLoading: boolean
  error: string | null
}

// Stale time in milliseconds (5 minutes)
const DEFAULT_STALE_TIME = 5 * 60 * 1000

interface DataCacheState {
  // Data cache by key
  cache: Record<string, CacheEntry>
  
  // UI State - tracks which FAB-triggered modals are open
  openModals: Set<string>
  
  // Check if any modal is open (for FAB visibility)
  isAnyModalOpen: () => boolean
  
  // Modal controls
  openModal: (modalId: string) => void
  closeModal: (modalId: string) => void
  
  // Cache operations
  getCached: <T>(key: string) => T | null
  isFresh: (key: string, staleTime?: number) => boolean
  isLoading: (key: string) => boolean
  getError: (key: string) => string | null
  
  setLoading: (key: string, loading: boolean) => void
  setData: <T>(key: string, data: T) => void
  setError: (key: string, error: string | null) => void
  
  // Invalidate cache (force refetch on next access)
  invalidate: (key: string) => void
  invalidateAll: () => void
  
  // Update cached data without full refetch (for optimistic updates)
  updateCached: <T>(key: string, updater: (data: T) => T) => void
}

export const useDataStore = create<DataCacheState>((set, get) => ({
  cache: {},
  openModals: new Set<string>(),
  
  isAnyModalOpen: () => get().openModals.size > 0,
  
  openModal: (modalId) => set((state) => {
    const newSet = new Set(state.openModals)
    newSet.add(modalId)
    return { openModals: newSet }
  }),
  
  closeModal: (modalId) => set((state) => {
    const newSet = new Set(state.openModals)
    newSet.delete(modalId)
    return { openModals: newSet }
  }),
  
  getCached: <T>(key: string): T | null => {
    const entry = get().cache[key]
    return entry?.data ?? null
  },
  
  isFresh: (key: string, staleTime = DEFAULT_STALE_TIME): boolean => {
    const entry = get().cache[key]
    if (!entry || !entry.data) return false
    return Date.now() - entry.fetchedAt < staleTime
  },
  
  isLoading: (key: string): boolean => {
    return get().cache[key]?.isLoading ?? false
  },
  
  getError: (key: string): string | null => {
    return get().cache[key]?.error ?? null
  },
  
  setLoading: (key: string, loading: boolean) => set((state) => ({
    cache: {
      ...state.cache,
      [key]: {
        ...state.cache[key],
        data: state.cache[key]?.data ?? null,
        fetchedAt: state.cache[key]?.fetchedAt ?? 0,
        isLoading: loading,
        error: loading ? null : state.cache[key]?.error ?? null,
      },
    },
  })),
  
  setData: <T>(key: string, data: T) => set((state) => ({
    cache: {
      ...state.cache,
      [key]: {
        data,
        fetchedAt: Date.now(),
        isLoading: false,
        error: null,
      },
    },
  })),
  
  setError: (key: string, error: string | null) => set((state) => ({
    cache: {
      ...state.cache,
      [key]: {
        ...state.cache[key],
        data: state.cache[key]?.data ?? null,
        fetchedAt: state.cache[key]?.fetchedAt ?? 0,
        isLoading: false,
        error,
      },
    },
  })),
  
  invalidate: (key: string) => set((state) => {
    const newCache = { ...state.cache }
    delete newCache[key]
    return { cache: newCache }
  }),
  
  invalidateAll: () => set({ cache: {} }),
  
  updateCached: <T>(key: string, updater: (data: T) => T) => set((state) => {
    const entry = state.cache[key]
    if (!entry?.data) return state
    return {
      cache: {
        ...state.cache,
        [key]: {
          ...entry,
          data: updater(entry.data as T),
        },
      },
    }
  }),
}))

/**
 * Hook to use cached data with automatic fetching
 * 
 * Usage:
 * const { data, loading, error, refetch } = useCachedData('programs', fetchPrograms)
 */
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { staleTime?: number; enabled?: boolean }
) {
  const store = useDataStore()
  const staleTime = options?.staleTime ?? DEFAULT_STALE_TIME
  const enabled = options?.enabled ?? true
  
  const data = store.getCached<T>(key)
  const loading = store.isLoading(key)
  const error = store.getError(key)
  const isFresh = store.isFresh(key, staleTime)
  
  // Fetch if needed (data missing or stale)
  const fetchIfNeeded = async () => {
    if (!enabled) return
    if (isFresh && data !== null) return // Data exists and is fresh
    if (loading) return // Already fetching
    
    store.setLoading(key, true)
    try {
      const result = await fetcher()
      store.setData(key, result)
    } catch (e: any) {
      store.setError(key, e?.message || 'Failed to fetch data')
    }
  }
  
  // Force refetch regardless of cache state
  const refetch = async () => {
    store.setLoading(key, true)
    try {
      const result = await fetcher()
      store.setData(key, result)
    } catch (e: any) {
      store.setError(key, e?.message || 'Failed to fetch data')
    }
  }
  
  return {
    data,
    loading: loading && !data, // Only show loading if no cached data
    error,
    isFresh,
    fetchIfNeeded,
    refetch,
    invalidate: () => store.invalidate(key),
  }
}

// Cache keys for type safety
export const CACHE_KEYS = {
  PROGRAMS: 'programs',
  APPLICATIONS: 'applications',
  ANNOUNCEMENTS: 'announcements',
  RESIDENTS: 'residents',
  ISSUES: 'issues',
  DOCUMENT_REQUESTS: 'document_requests',
  MARKETPLACE_ITEMS: 'marketplace_items',
  TRANSACTIONS: 'transactions',
  ADMINS: 'admins',
  TRANSFERS: 'transfers',
  DASHBOARD: 'dashboard',
  DASHBOARD_ACTIVITY: 'dashboard_activity',
  PENDING_VERIFICATIONS: 'pending_verifications',
  PENDING_ITEMS: 'pending_items',
} as const

// Modal IDs for type safety
export const MODAL_IDS = {
  CREATE_PROGRAM: 'create_program',
  CREATE_ANNOUNCEMENT: 'create_announcement',
  CREATE_ISSUE: 'create_issue',
} as const

/**
 * Invalidate multiple cache keys at once
 * Use this after mutations to ensure UI reflects changes immediately
 *
 * @example
 * await api.approveRequest(id)
 * invalidateMultiple(['document_requests', 'dashboard'])
 */
export function invalidateMultiple(keys: string[]) {
  const store = useDataStore.getState()
  keys.forEach(key => store.invalidate(key))
}

/**
 * Get a function to invalidate cache keys
 * Useful when you need to pass invalidation as a callback
 *
 * @example
 * const invalidate = useInvalidator()
 * await api.approveRequest(id)
 * invalidate(['document_requests', 'dashboard'])
 */
export function useInvalidator() {
  const store = useDataStore()
  return (keys: string[]) => {
    keys.forEach(key => store.invalidate(key))
  }
}

