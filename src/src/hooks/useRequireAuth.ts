import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isAuthError, useUser } from "../api/queries/useUser";
import { useUserStore } from "../zustand/userStore";

// Redirect to /login when identity is missing. Two signals, same gate:
// the explicit-logout latch flips on logout, and the query resolves an
// actual auth rejection (401/403/404) on cold start. A transient
// network error must NOT redirect: the connection may simply be down,
// and `useUser` retries those. /public/* and /settings are exempt:
// share links use a JWT, and settings must stay reachable when logged
// out.
export function useRequireAuth(): boolean {
  const { isLoading: userLoading, isError: userError, error } = useUser();
  const loggedOut = useUserStore((s) => s.loggedOut);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onPublicRoute = pathname.startsWith("/public/");
  const onSettingsRoute = pathname === "/settings";

  // Explicit logout latch, independent of react query. The `useUser`
  // query is disabled while latched, so it never reports an error.
  // Otherwise, only a real auth rejection counts as logged out — a
  // dropped connection (`TypeError: Failed to fetch`) keeps the app on
  // the current route.
  const queryIsLoggedOut = !userLoading && userError && isAuthError(error);
  const isLoggedOut = loggedOut || queryIsLoggedOut;

  const shouldRedirectToLogin = !onPublicRoute && !onSettingsRoute && isLoggedOut;
  useEffect(() => {
    if (!shouldRedirectToLogin) return;
    navigate("/login", { replace: true });
  }, [shouldRedirectToLogin, navigate]);
  // Exempt routes render even when logged out: share-link subtree
  // is auth'd by JWT, and settings must stay reachable unauthenticated.
  if (onPublicRoute || onSettingsRoute) return true;
  // Return true while loading; false once we know identity is gone.
  return !isLoggedOut;
}
