import { Outlet } from "react-router-dom";
import { useRequireAuth } from "../hooks/useRequireAuth";

/**
 * Gates the wrapped route subtree behind an authenticated user.
 *
 * Behaviour:
 *
 *   - `useUser()` resolves with no user / errors -> redirect to
 *     `/login` (replace, so the failed URL doesn't pollute history).
 *   - while the user-load query is still in flight, render the
 *     children so the splash animation has something to fade out
 *     of. We deliberately don't render a spinner here to keep this
 *     component layout-agnostic.
 *   - `/public/*` is exempt: the share JWT, not user cookies, is
 *     the auth source on that subtree, so a missing user cookie
 *     must never bounce a share-link viewer to the login page.
 *
 * Use as a layout route:
 *
 *   <Route element={<RequireAuth />}>
 *     <Route path="/" element={<HomePage />} />
 *     ...
 *   </Route>
 */
export const RequireAuth: React.FC = () => {
  const allowed = useRequireAuth();
  if (!allowed) return null;
  return <Outlet />;
};
