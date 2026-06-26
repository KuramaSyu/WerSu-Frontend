import { QueryClient } from "@tanstack/react-query";

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
