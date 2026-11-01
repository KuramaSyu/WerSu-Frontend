import { QueryClient } from "@tanstack/react-query";

/**
 * localStorage key used by the async-storage persister in
 * `main.tsx`. Exported so logout can drop the persisted cache
 * synchronously instead of waiting for the persister's throttle —
 * otherwise a reload right after logout could restore the previous
 * `["user"]` entry and show the old avatar.
 */
export const PERSIST_CACHE_STORAGE_KEY = "REACT_QUERY_OFFLINE_CACHE";

/**
 * Singleton React Query client. There must be exactly ONE per app —
 * hooks reading from `useQueryClient()` and imperative
 * `queryClient.invalidateQueries(...)` calls must target the same
 * cache. Owned here; `main.tsx` wraps the app in
 * `<PersistQueryClientProvider client={queryClient}>`.
 *
 * `gcTime: 24h` is required for the persist client to have anything to
 * restore on reload.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
});
