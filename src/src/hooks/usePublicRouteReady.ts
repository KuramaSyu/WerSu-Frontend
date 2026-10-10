import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "../zustand/useAuthStore";
import { isPublicPathname } from "../utils/publicRoute";

// Default budget before we surface a "share unavailable" error.
const DEFAULT_TIMEOUT_MS = 30_000;

export interface UsePublicRouteReadyOptions {
  // Pass 0 to disable the timer when this hook gates a request.
  timeoutMs?: number;
}

export interface UsePublicRouteReadyResult {
  // Mirrors isPublicPathname for the current pathname.
  isPublic: boolean;
  // True once authed calls can fire on the current route.
  ready: boolean;
  // True after timeoutMs on a public route without the JWT.
  timedOut: boolean;
}

/**
 * Tri-state source of truth for the public-route auth setup:
 * request gating, page-level error UI, and the route predicate.
 */
export function usePublicRouteReady(
  options: UsePublicRouteReadyOptions = {},
): UsePublicRouteReadyResult {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const { pathname } = useLocation();
  const isPublic = isPublicPathname(pathname);
  const shareAccessToken = useAuthStore((s) => s.shareAccessToken);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Skip the timer when off /public, when the JWT is already in
    // the store, or when the timer is disabled.
    if (!isPublic || shareAccessToken !== null || timeoutMs <= 0) {
      return;
    }
    const handle = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(handle);
  }, [isPublic, shareAccessToken, timeoutMs]);

  if (!isPublic) {
    return { isPublic: false, ready: true, timedOut: false };
  }
  return {
    isPublic: true,
    ready: shareAccessToken !== null,
    timedOut,
  };
}
