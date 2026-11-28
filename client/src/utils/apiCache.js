// Centralized in-memory API Cache with TTL and pattern invalidation for ultra-fast navigation
const cache = new Map();

/**
 * Fetch from cache if fresh, otherwise fetch from network and cache
 * @param {string} url 
 * @param {RequestInit} [options={}] 
 * @param {number} [ttlMs=30000] Default 30 seconds
 * @returns {Promise<any>} Parsed JSON or Response
 */
export async function fetchWithCache(url, options = {}, ttlMs = 30000) {
  const method = (options.method || 'GET').toUpperCase();

  // Only GET requests are cached
  if (method !== 'GET') {
    const res = await fetch(url, options);
    invalidateCacheByUrl(url);
    return res;
  }

  // Check if cache entry exists and is still fresh
  const now = Date.now();
  const cached = cache.get(url);

  if (cached && (now - cached.timestamp < cached.ttl)) {
    return cached.data;
  }

  // Fetch fresh data
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();

  // Store in cache
  cache.set(url, {
    timestamp: now,
    ttl: ttlMs,
    data
  });

  return data;
}

/**
 * Invalidate cache keys matching substring or regex pattern
 * @param {string|RegExp} [pattern] 
 */
export function invalidateCache(pattern) {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (typeof pattern === 'string' && key.includes(pattern)) {
      cache.delete(key);
    } else if (pattern instanceof RegExp && pattern.test(key)) {
      cache.delete(key);
    }
  }
}

/**
 * Automatically invalidate related cache entries when mutations happen
 */
function invalidateCacheByUrl(url) {
  if (url.includes('/questions')) {
    invalidateCache('/questions');
  }
  if (url.includes('/court-types')) {
    invalidateCache('/court-types');
  }
  if (url.includes('/case-types')) {
    invalidateCache('/case-types');
  }
  if (url.includes('/advocate-types')) {
    invalidateCache('/advocate-types');
  }
  if (url.includes('/advocate-questions')) {
    invalidateCache('/advocate-questions');
  }
  if (url.includes('/new-questions')) {
    invalidateCache('/new-questions');
  }
  if (url.includes('/chat/')) {
    invalidateCache('/chat/');
  }
}
