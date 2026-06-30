import { useCallback, useEffect, useRef } from "react";
import { publicSharingApi } from "../SharingApi";
import { useAuthStore } from "../../zustand/useAuthStore";

/**
 * Buffer (seconds) by which the share JWT is refreshed BEFORE its `exp` claim.
 * Mirrors `useAccessToken` so both tokens rotate on a similar cadence.
 */
const JWT_REFRESH_BUFFER = 60;

/**
 * Fallback interval when we can't recover the JWT's `exp` claim — keeps
 * the page from going silent on transient failures.
 */
const FALLBACK_REFRESH_MS = 30_000;

/**
 * Try to read the `exp` claim from a JWT without verifying the signature.
 * The backend embeds the share's `online_until` as `exp`, so this gives us
 * the exact moment we need to rotate.
 */
const jwtExpSeconds = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
};

/**
 * How many ms before `exp` (in epoch seconds) we should fire the next refresh.
 * Clamped at 0 so an already-expired token still triggers an immediate refetch.
 */
const scheduleRefreshMs = (expEpochSeconds: number): number => {
  const waitMs =
    expEpochSeconds * 1000 - Date.now() - JWT_REFRESH_BUFFER * 1000;
  return Math.max(0, waitMs);
};

export interface UseShareAccessTokenOptions {
  /** Opt in to fetching; pass the share ID. Empty/null disables the loop. */
  shareId?: string | null;
}

/**
 * Owns the lifecycle of the share JWT for the public-note page.
 *
 * - Mounts with a `shareId` → POSTs `/api/auth/public-access-token` and
 *   writes the returned JWT into `useAuthStore.shareAccessToken`.
 * - Re-schedules a refresh `JWT_REFRESH_BUFFER` seconds before `exp` so
 *   a long-running session never holds an expired token.
 * - Unmount / `shareId` clearing → clears the JWT from the store.
 *
 * Consumers should NOT depend on this hook's return value — read
 * `useAuthStore.shareAccessToken` directly (the share-token provider in
 * `Bootstrap` does the same). Mirrors the contract documented at the
 * top of `useAccessToken`.
 */
export function useShareAccessToken(
  options: UseShareAccessTokenOptions = {},
): void {
  const { shareId } = options;
  const handle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (handle.current !== null) {
      clearTimeout(handle.current);
      handle.current = null;
    }
  };

  const refresh = useCallback(async () => {
    if (!shareId) {
      console.debug("[share-jwt] refresh called with empty shareId — clearing");
      useAuthStore.getState().setShareAccessToken(null);
      return;
    }
    console.debug(
      "[share-jwt] refresh() starting POST /api/auth/public-access-token shareId=",
      shareId,
    );
    try {
      const { token } = await publicSharingApi.fetchPublicAccessToken(shareId);
      const exp = jwtExpSeconds(token);
      const expIso = exp !== null ? new Date(exp * 1000).toISOString() : null;
      console.debug(
        "[share-jwt] refresh() got token — exp=",
        exp,
        "expIso=",
        expIso,
        "tokenPrefix=",
        token ? token.slice(0, 12) + "..." : "(empty)",
      );
      useAuthStore.getState().setShareAccessToken(token);
      const stored = useAuthStore.getState().shareAccessToken;
      console.debug(
        "[share-jwt] refresh() wrote to store; store now has prefix=",
        stored ? stored.slice(0, 12) + "..." : "(null)",
      );
      if (exp !== null) {
        clearTimer();
        const waitMs = scheduleRefreshMs(exp);
        console.debug(
          "[share-jwt] scheduling next refresh in",
          waitMs,
          "ms (",
          Math.round(waitMs / 1000),
          "s)",
        );
        // `refresh` is a forward ref; the timer body only runs after
        // mount, so the ref is resolved by then.
        // eslint-disable-next-line react-hooks/immutability
        handle.current = setTimeout(refresh, waitMs);
      } else {
        // No readable exp -> fall back to a fixed cadence so we don't
        // hold an expired token indefinitely.
        clearTimer();
        console.debug(
          "[share-jwt] exp claim unreadable, using FALLBACK_REFRESH_MS=",
          FALLBACK_REFRESH_MS,
          "ms",
        );
        handle.current = setTimeout(refresh, FALLBACK_REFRESH_MS);
      }
    } catch (err) {
      console.error(
        "[share-jwt] refresh() FAILED — shareId=",
        shareId,
        "err=",
        err,
      );
      clearTimer();
      handle.current = setTimeout(refresh, FALLBACK_REFRESH_MS);
    }
  }, [shareId]);

  useEffect(() => {
    console.debug(
      "[share-jwt] useEffect mount/change — shareId=",
      shareId,
      "currentStoreToken=",
      useAuthStore.getState().shareAccessToken
        ? useAuthStore.getState().shareAccessToken!.slice(0, 12) + "..."
        : "(null)",
    );
    if (!shareId) {
      // No active share -> clear any leftover JWT from a previous mount
      // (e.g. navigating between two share URLs).
      useAuthStore.getState().setShareAccessToken(null);
      return;
    }
    void refresh();
    return () => {
      console.debug(
        "[share-jwt] useEffect cleanup — clearing timer, leaving store intact",
      );
      clearTimer();
    };
  }, [shareId, refresh]);
}
