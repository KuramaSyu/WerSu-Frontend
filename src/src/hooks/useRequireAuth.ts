import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../api/queries/useUser";

/**
 * Returns whether the wrapped route subtree may render, and triggers a
 * redirect to `/login` if it may not.
 *
 * Behaviour:
 *
 *   - `useUser()` raises an error -> redirect to /login
 *   - `/public/*` is ignored
 */
export function useRequireAuth(): boolean {
  const { data: user, isLoading: userLoading, isError: userError } = useUser();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onPublicRoute = pathname.startsWith("/public/");
  const shouldRedirectToLogin = !onPublicRoute && !userLoading && userError;
  useEffect(() => {
    if (!shouldRedirectToLogin) return;
    navigate("/login", { replace: true });
  }, [shouldRedirectToLogin, navigate]);
  return !shouldRedirectToLogin;
}
