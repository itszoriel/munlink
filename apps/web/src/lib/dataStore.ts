/**
 * Global Data Cache Store for Web App
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

// Cache keys for type safety
export const CACHE_KEYS = {
  MARKETPLACE_ITEMS: 'marketplace_items',
  MY_ITEMS: 'my_items',
  MY_TRANSACTIONS: 'my_transactions',
  ISSUES: 'issues',
  MY_ISSUES: 'my_issues',
  ISSUE_CATEGORIES: 'issue_categories',
  ANNOUNCEMENTS: 'announcements',
  DOCUMENT_REQUESTS: 'document_requests',
  BENEFITS_PROGRAMS: 'benefits_programs',
  MY_APPLICATIONS: 'my_applications',
  HOME_ANNOUNCEMENTS: 'home_announcements',
  HOME_MARKETPLACE: 'home_marketplace',
} as const

