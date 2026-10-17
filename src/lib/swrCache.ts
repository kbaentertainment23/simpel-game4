import { useState, useEffect, useCallback, useRef } from 'react';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  error?: Error | null;
}

export interface SWROptions<T = any> {
  /**
   * Time in milliseconds before cached data is considered stale.
   * Default: 60,000 ms (1 minute).
   */
  staleTime?: number;
  /**
   * Optional custom localStorage key to persist and restore data across browser sessions.
   */
  persistKey?: string;
  /**
   * Whether to trigger background revalidation when cached data is stale or accessed.
   * Default: true.
   */
  revalidateOnMount?: boolean;
  /**
   * If true, bypasses the cached data freshness check and forces an immediate fresh network fetch.
   * Default: false.
   */
  forceRevalidate?: boolean;
  /**
   * Interval in milliseconds to deduplicate simultaneous identical requests.
   * Default: 2,000 ms.
   */
  dedupingInterval?: number;
  /**
   * Callback fired when data is retrieved (either from cache or fresh revalidation).
   */
  onSuccess?: (data: T, isFromCache: boolean) => void;
  /**
   * Callback fired if background or initial fetch fails.
   */
  onError?: (error: Error) => void;
}

// In-Memory Cache Store
const memoryCache = new Map<string, CacheEntry<any>>();

// In-Flight Request Deduplication Map
const inFlightPromises = new Map<string, Promise<any>>();

// Active Subscribers for cache keys
type Subscriber<T = any> = (data: T, error?: Error | null) => void;
const keySubscribers = new Map<string, Set<Subscriber>>();

/**
 * Helper to deep compare two JSON-serializable structures quickly
 */
function isDataEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Loads data from localStorage if available into memory
 */
function loadFromStorage<T>(storageKey: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw || raw === 'null' || raw === 'undefined') return null;
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return null;
    if (parsed && typeof parsed === 'object' && 'data' in parsed && 'timestamp' in parsed) {
      return parsed as CacheEntry<T>;
    }
    // Legacy storage without wrapper
    return {
      data: parsed as T,
      timestamp: 0, // Mark as initially stale to trigger revalidation
    };
  } catch {
    return null;
  }
}

/**
 * Saves data to localStorage
 */
function saveToStorage<T>(storageKey: string, entry: CacheEntry<T>): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(entry));
  } catch {
    // Storage quota or privacy mode handling
  }
}

/**
 * Broadcasts an update to all active subscribers of a key
 */
function notifySubscribers<T>(key: string, data: T, error?: Error | null): void {
  const subs = keySubscribers.get(key);
  if (subs && subs.size > 0) {
    subs.forEach((cb) => {
      try {
        cb(data, error);
      } catch (err) {
        console.warn(`Error in SWR subscriber for key "${key}":`, err);
      }
    });
  }
}

/**
 * Subscribes a callback to changes on a specific cache key
 */
export function subscribeToCache<T>(key: string, callback: Subscriber<T>): () => void {
  if (!keySubscribers.has(key)) {
    keySubscribers.set(key, new Set());
  }
  const subs = keySubscribers.get(key)!;
  subs.add(callback);
  return () => {
    subs.delete(callback);
    if (subs.size === 0) {
      keySubscribers.delete(key);
    }
  };
}

/**
 * Synchronously reads the cached data if it exists in memory or persistent storage.
 */
export function getCacheData<T>(key: string, persistKey?: string): T | undefined {
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!.data as T;
  }
  const storageKey = persistKey || `swr_cache_${key}`;
  const stored = loadFromStorage<T>(storageKey);
  if (stored) {
    memoryCache.set(key, stored);
    return stored.data;
  }
  return undefined;
}

/**
 * Safely retrieves an initial array from SWR cache or localStorage
 */
export function getInitialCacheArray<T>(key: string, persistKey?: string, fallback: T[] = []): T[] {
  const data = getCacheData<T[]>(key, persistKey);
  if (Array.isArray(data)) return data;
  if (persistKey) {
    try {
      const raw = localStorage.getItem(persistKey);
      if (!raw || raw === 'null' || raw === 'undefined') return fallback;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.data)) return parsed.data;
    } catch {}
  }
  return fallback;
}

/**
 * Safely retrieves an initial object/primitive from SWR cache or localStorage
 */
export function getInitialCacheValue<T>(key: string, persistKey?: string, fallback?: T): T {
  const data = getCacheData<T>(key, persistKey);
  if (data !== undefined && data !== null) return data;
  if (persistKey) {
    try {
      const raw = localStorage.getItem(persistKey);
      if (!raw || raw === 'null' || raw === 'undefined') return fallback as T;
      const parsed = JSON.parse(raw);
      if (parsed === null || parsed === undefined) return fallback as T;
      if (parsed && typeof parsed === 'object' && 'data' in parsed) return (parsed.data ?? fallback) as T;
      return (parsed ?? fallback) as T;
    } catch {}
  }
  return fallback as T;
}

/**
 * Sets or optimistically updates cache data for a given key.
 */
export function setCacheData<T>(
  key: string,
  updater: T | ((prev: T | undefined) => T),
  persistKey?: string,
  broadcast = true
): T {
  const current = getCacheData<T>(key, persistKey);
  const nextData = typeof updater === 'function' ? (updater as (prev: T | undefined) => T)(current) : updater;
  const entry: CacheEntry<T> = {
    data: nextData,
    timestamp: Date.now(),
    error: null,
  };
  memoryCache.set(key, entry);

  const storageKey = persistKey || `swr_cache_${key}`;
  saveToStorage(storageKey, entry);

  if (broadcast) {
    notifySubscribers(key, nextData, null);
  }
  return nextData;
}

/**
 * Invalidates cache for a specific key or keys matching a regex/prefix.
 * Fully removes the key from memoryCache, inFlightPromises, and localStorage
 * so subsequent fetches immediately read fresh data.
 */
export function invalidateCache(keyOrPattern?: string | RegExp): void {
  if (!keyOrPattern) {
    memoryCache.clear();
    inFlightPromises.clear();
    return;
  }

  if (typeof keyOrPattern === 'string') {
    memoryCache.delete(keyOrPattern);
    inFlightPromises.delete(keyOrPattern);
    try {
      localStorage.removeItem(`swr_cache_${keyOrPattern}`);
    } catch {}
  } else if (keyOrPattern instanceof RegExp) {
    for (const k of Array.from(memoryCache.keys())) {
      if (keyOrPattern.test(k)) {
        memoryCache.delete(k);
        inFlightPromises.delete(k);
        try {
          localStorage.removeItem(`swr_cache_${k}`);
        } catch {}
      }
    }
  }
}

/**
 * Specifically purges a key from memoryCache and any custom persistKey.
 */
export function deleteCacheKey(key: string, persistKey?: string): void {
  memoryCache.delete(key);
  inFlightPromises.delete(key);
  try {
    localStorage.removeItem(`swr_cache_${key}`);
    if (persistKey) {
      localStorage.removeItem(persistKey);
    }
  } catch {}
}

/**
 * Completely purges all in-memory and persistent SWR cache.
 */
export function clearAllSWRCache(): void {
  memoryCache.clear();
  inFlightPromises.clear();
}

/**
 * Core Stale-While-Revalidate Fetcher
 *
 * 1. Checks memory & localStorage for cached data.
 * 2. If fresh, returns immediately without network request.
 * 3. If stale, returns stale data immediately AND initiates background revalidation.
 * 4. If no cache exists, fetches from network and caches the result.
 * 5. Deduplicates concurrent in-flight requests for the same key.
 */
export async function swrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: SWROptions<T> = {}
): Promise<T> {
  const {
    staleTime = 60_000, // 1 minute default stale time
    persistKey,
    revalidateOnMount = true,
    forceRevalidate = false,
    onSuccess,
    onError,
  } = options;

  const storageKey = persistKey || `swr_cache_${key}`;
  const now = Date.now();

  // 1. Check in-memory cache
  let cachedEntry = memoryCache.get(key) as CacheEntry<T> | undefined;

  // 2. Hydrate from persistent storage if not in memory
  if (!cachedEntry) {
    const stored = loadFromStorage<T>(storageKey);
    if (stored) {
      cachedEntry = stored;
      memoryCache.set(key, stored);
    }
  }

  // Define the network revalidation executor
  const revalidate = async (isBackground = false): Promise<T> => {
    // Check if there is already an in-flight fetch for this key
    if (inFlightPromises.has(key)) {
      return inFlightPromises.get(key)!;
    }

    const promise = (async () => {
      try {
        const freshData = await fetcher();
        const newEntry: CacheEntry<T> = {
          data: freshData,
          timestamp: Date.now(),
          error: null,
        };

        const prevData = cachedEntry?.data;
        const hasChanged = !isDataEqual(prevData, freshData);

        // Update memory and persistent storage
        memoryCache.set(key, newEntry);
        saveToStorage(storageKey, newEntry);

        if (hasChanged || !isBackground) {
          notifySubscribers(key, freshData, null);
        }

        if (onSuccess) {
          onSuccess(freshData, false);
        }

        return freshData;
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (cachedEntry) {
          cachedEntry.error = error;
        }
        if (onError) {
          onError(error);
        }
        notifySubscribers(key, cachedEntry?.data as T, error);
        throw error;
      } finally {
        inFlightPromises.delete(key);
      }
    })();

    inFlightPromises.set(key, promise);
    return promise;
  };

  // If forceRevalidate is requested, bypass cached data and await fresh network result
  if (forceRevalidate) {
    return revalidate(false);
  }

  // If cache exists
  if (cachedEntry && cachedEntry.data !== undefined) {
    const isFresh = now - cachedEntry.timestamp < staleTime;
    if (onSuccess) {
      onSuccess(cachedEntry.data, true);
    }

    // If stale and revalidation enabled, trigger revalidation silently in background
    if (!isFresh && revalidateOnMount) {
      revalidate(true).catch(() => {
        // Silently retain current cache on network revalidation failure
      });
    }

    // Return stale or fresh data immediately (0ms delay!)
    return cachedEntry.data;
  }

  // If no cache exists, perform initial fetch and await it
  return revalidate(false);
}

/**
 * React Hook for declarative Stale-While-Revalidate Firestore queries
 */
export function useFirestoreSWR<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: SWROptions<T> = {}
) {
  const {
    staleTime = 60_000,
    persistKey,
    revalidateOnMount = true,
  } = options;

  const storageKey = persistKey || (key ? `swr_cache_${key}` : undefined);

  // Initialize state with cached data if available (0ms layout render)
  const [data, setData] = useState<T | undefined>(() => {
    if (!key) return undefined;
    return getCacheData<T>(key, storageKey);
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!key) return false;
    const cached = getCacheData<T>(key, storageKey);
    return cached === undefined;
  });

  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const performFetch = useCallback(
    async (force = false): Promise<T | undefined> => {
      if (!key) return undefined;
      setIsValidating(true);
      try {
        const result = await swrFetch<T>(key, fetcherRef.current, {
          ...optionsRef.current,
          staleTime: force ? 0 : staleTime,
          revalidateOnMount: true,
        });
        setData(result);
        setError(null);
        return result;
      } catch (err: any) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        return undefined;
      } finally {
        setIsLoading(false);
        setIsValidating(false);
      }
    },
    [key, staleTime]
  );

  // Subscribe to external cache updates & background revalidations for this key
  useEffect(() => {
    if (!key) return;

    // Listen for broadcasts from mutations or background fetches
    const unsubscribe = subscribeToCache<T>(key, (newData, newError) => {
      if (newData !== undefined) {
        setData(newData);
      }
      if (newError !== undefined) {
        setError(newError);
      }
      setIsValidating(false);
      setIsLoading(false);
    });

    // If we don't have fresh data, initiate fetch
    if (revalidateOnMount) {
      performFetch(false);
    }

    return () => {
      unsubscribe();
    };
  }, [key, performFetch, revalidateOnMount]);

  // Mutate helper for optimistic updates
  const mutate = useCallback(
    async (
      updater?: T | ((prev: T | undefined) => T),
      shouldRevalidate = false
    ): Promise<T | undefined> => {
      if (!key) return undefined;
      if (updater !== undefined) {
        const next = setCacheData<T>(key, updater, storageKey, true);
        setData(next);
      }
      if (shouldRevalidate) {
        return performFetch(true);
      }
      return undefined;
    },
    [key, storageKey, performFetch]
  );

  return {
    data,
    isLoading,
    isValidating,
    error,
    mutate,
    revalidate: () => performFetch(true),
  };
}
