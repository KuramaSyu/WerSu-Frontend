import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getUserApi } from "../UserApi";
import { useAuthStore } from "../../zustand/useAuthStore";

const userApi = getUserApi();

const JWT_REFRESH_BUFFER = 60; // seconds

/**
 * Owns the lifecycle of the user's JWT. The token is written into
 * `useAuthStore.accessToken` so non-hook code (e.g. the Hocuspocus
 * provider's `token` callback) can read it synchronously.
 *
 * On rejection, `setAccessToken` is **not** called — the previous token
 * (if any) stays in the store, so callers fall back to the stale token
 * instead of spuriously clearing it.
 */
export function useAccessToken(): UseQueryResult<string, Error> {
  return useQuery({
    queryKey: ["accessToken"],
    retry: 5,
    // Exponential backoff capped at 15s, so transient 401s (e.g. cookie
    // just expired) recover in ~30s instead of locking the user out for
    // the full `refetchInterval` (14 min).
    retryDelay: (i) => Math.min(15_000, 1_000 * 2 ** i),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // `always` so the query still runs when navigator.onLine is false and
    // the badge can show the user a useful diagnostic instead of silence.
    networkMode: "always",
    queryFn: async () => {
      const data = await userApi.fetchAccessToken();
      const token = data.token;
      if (!token) {
        throw new Error("Backend returned 2xx but no JWT in body");
      }

      const current = useAuthStore.getState().accessToken;
      if (current !== token) {
        useAuthStore.getState().setAccessToken(token);
      }
      return token;
    },
    staleTime: 15 * 60 * 1000 - JWT_REFRESH_BUFFER * 1000,
    refetchInterval: 15 * 60 * 1000 - JWT_REFRESH_BUFFER * 1000,
  });
}
