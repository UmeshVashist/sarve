import { lazy } from 'react';

/**
 * Enhanced React.lazy with automatic chunk-load retry and cache-bust recovery.
 * When a deployment updates asset hashes, dynamic imports in open browser tabs
 * can fail with "Failed to fetch dynamically imported module".
 * This helper automatically reloads the page once to pull fresh assets seamlessly.
 */
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      const msg = error?.message || String(error || '');
      const isChunkError =
        msg.includes('dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module') ||
        error?.name === 'ChunkLoadError';

      if (isChunkError && typeof window !== 'undefined') {
        const lastReload = Number(sessionStorage.getItem('chunk_reload_timestamp') || '0');
        const now = Date.now();
        // If we haven't auto-reloaded in the last 15 seconds, reload immediately
        if (now - lastReload > 15000) {
          sessionStorage.setItem('chunk_reload_timestamp', String(now));
          window.location.reload();
          // Return non-resolving promise so React stays in Suspense fallback instead of crashing
          return new Promise(() => {});
        }
      }
      throw error;
    }
  });
}
