import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../api/queries/useUser";
import { useUserStore } from "../zustand/userStore";

// Redirect to /login when identity is missing. Two signals, same gate:
// store flips on logout, query 401s on cold start. /public/* and
// /settings are exempt: share links use a JWT, and settings must stay
// reachable when logged out.
export function useRequireAuth(): boolean {
  const { data: user, isLoading: userLoading, isError: userError } = useUser();
  // const storeUser = useUserStore((s) => s.user);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onPublicRoute = pathname.startsWith("/public/");
  const onSettingsRoute = pathname === "/settings";

  // Store flips on setUser(null), independent of react query.
  // const storeIsLoggedOut = storeUser === null;

  // Query 401s on cold start with no session cookie.
  const queryIsLoggedOut = !userLoading && userError;

  const shouldRedirectToLogin =
    !onPublicRoute && !onSettingsRoute && queryIsLoggedOut;
  useEffect(() => {
    if (!shouldRedirectToLogin) return;
    navigate("/login", { replace: true });
  }, [shouldRedirectToLogin, navigate]);
  // Exempt routes render even when logged out: share-link subtree
  // is auth'd by JWT, and settings must stay reachable unauthenticated.
  if (onPublicRoute || onSettingsRoute) return true;
  // Return true while loading; false once we know identity is gone.
  return !queryIsLoggedOut;
}
