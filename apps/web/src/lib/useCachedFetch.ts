/**
 * Reusable hook for cached data fetching
 * Automatically handles caching, staleness checks, and filter-specific keys
 */
import { useEffect, useCallback, useMemo, useRef } from 'react'
import { useDataStore } from './dataStore'

export function useCachedFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options?: {
    staleTime?: number
    enabled?: boolean
    dependencies?: any[] // For filter-specific keys
  }
) {
  const dataStore = useDataStore()
  const staleTime = options?.staleTime ?? 5 * 60 * 1000 // 5 minutes default
  const fetchingRef = useRef(false) // Track if we're currently fetching
  
  // Build filter-specific cache key
  const finalCacheKey = useMemo(() => {
    if (options?.dependencies && options.dependencies.length > 0) {
      const deps = options.dependencies
        .filter(Boolean)
        .map(d => String(d))
        .join('_')
      return deps ? `${cacheKey}_${deps}` : cacheKey
    }
    return cacheKey
  }, [cacheKey, ...(options?.dependencies || [])])
  
  const cached = dataStore.getCached<T>(finalCacheKey)
  const isLoading = dataStore.isLoading(finalCacheKey)
  const error = dataStore.getError(finalCacheKey)
  
  // Stable fetcher reference
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])
  
  const fetch = useCallback(async () => {
    if (options?.enabled === false) return
    
    // Read fresh values from store inside the callback
    const currentCached = dataStore.getCached<T>(finalCacheKey)
    const currentIsFresh = dataStore.isFresh(finalCacheKey, staleTime)
    
    if (currentIsFresh && currentCached !== null) return // Already have fresh data
    if (fetchingRef.current) return // Already fetching
    
    fetchingRef.current = true
    dataStore.setLoading(finalCacheKey, true)
    dataStore.setError(finalCacheKey, null)
    try {
      const result = await fetcherRef.current()
      dataStore.setData(finalCacheKey, result)
    } catch (e: any) {
      dataStore.setError(finalCacheKey, e?.message || 'Failed to fetch')
    } finally {
      dataStore.setLoading(finalCacheKey, false)
      fetchingRef.current = false
    }
  }, [finalCacheKey, staleTime, options?.enabled]) // Read isFresh and cached inside callback
  
  // Refetch when cache key changes or when enabled flips on (e.g., after auth bootstrap).
  useEffect(() => {
    fetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalCacheKey, options?.enabled]) // Avoid depending on fetch to prevent loops.
  
  return {
    data: cached,
    loading: isLoading && !cached, // Only show loading if no cached data
    error,
    refetch: fetch,
    invalidate: () => dataStore.invalidate(finalCacheKey),
    update: (updater: (data: T) => T) => dataStore.updateCached(finalCacheKey, updater),
  }
}
