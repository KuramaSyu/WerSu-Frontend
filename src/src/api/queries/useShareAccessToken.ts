import {
  useQuery,
  type QueryKey,
  type UseQueryResult,
} from "@tanstack/react-query";
import { sharingApi } from "../SharingApi";
import { useAuthStore } from "../../zustand/useAuthStore";

const isExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    return typeof exp === "number" && exp < now;
  } catch {
    return false;
  }
};

/**
 * Buffer (seconds) by which the share JWT is refreshed BEFORE its `exp` claim.
 * Mirrors `useAccessToken` so both tokens rotate on a similar cadence.
 */
const JWT_REFRESH_BUFFER = 60;

export const SHARE_TOKEN_QUERY_KEY: QueryKey = ["shareAccessToken"];

/**
 * Options for `useShareAccessToken`.
 *
 * Pass `shareId` to opt in to fetching. When omitted (or empty), the query
 * is disabled — the caller's intent is "no public share active right now",
 * so nothing is fetched and `useAuthStore.shareAccessToken` is cleared.
 */
export interface UseShareAccessTokenOptions {
  shareId?: string | null;
  /** Optional explicit JWT to seed the cache with (e.g. from `getPublicShare`). */
  initialToken?: string | null;
  /**
   * Optional override of the refresh interval (ms). Defaults to
   * "15 minutes minus buffer" — the same cadence as the user JWT.
   */
  refetchIntervalMs?: number;
}

/**
 * Hook that owns the lifecycle of the share access JWT.
 *
 * - When `shareId` is provided, fetches a JWT from
 *   `SharingApi.fetchShareAccessToken(shareId)` and writes it into
 *   `useAuthStore.shareAccessToken`.
 * - When `shareId` becomes empty/null, clears the token from the store.
 * - Re-fetches periodically so a long-running session never holds an
 *   expired JWT.
 *
 * Consumers should NOT read this hook's `data` directly — read
 * `useAuthStore.shareAccessToken` instead. This mirrors the pattern that
 * `useAccessToken` already documents at the top of its file.
 */
export function useShareAccessToken(
  options: UseShareAccessTokenOptions = {},
): UseQueryResult<string, Error> {
  const { shareId, initialToken, refetchIntervalMs } = options;
  const interval =
    refetchIntervalMs ?? 15 * 60 * 1000 - JWT_REFRESH_BUFFER * 1000;

  return useQuery({
    queryKey: [...SHARE_TOKEN_QUERY_KEY, shareId ?? null],
    enabled: !!shareId,

    // Use the initial token as the seed so consumers don't see a blank state
    // immediately after `getPublicShare` resolves.
    initialData: initialToken ?? undefined,

    queryFn: async () => {
      if (!shareId) {
        useAuthStore.getState().setShareAccessToken(null);
        return "" as string;
      }

      const data = await sharingApi.fetchShareAccessToken(shareId);
      const token = data.token;

      // Skip the write when the cached value is still fresh — keeps the
      // zustand listeners from firing needlessly.
      const current = useAuthStore.getState().shareAccessToken;
      if (current !== token && !isExpired(token)) {
        console.log(
          "Fetched new share access token:",
          token.substring(0, 10) + "...",
        );
        useAuthStore.getState().setShareAccessToken(token);
      }

      return token;
    },

    staleTime: interval,
    refetchInterval: interval,
  });
}
