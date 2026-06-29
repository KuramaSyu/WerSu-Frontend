import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useUserStore } from "./zustand/userStore";
import { useAuthStore } from "./zustand/useAuthStore";
import { getSearchNotesApi } from "./api/SearchNotesApi";
import { RestNotesSearchType } from "./api/models/search";
import { getUserApi } from "./api/UserApi";
import { useAccessToken } from "./api/queries/useAccessToken";
import { apiRegistry } from "./api/apiRegistry";

/**
 * Routes under `/public/*` are served by the share JWT only — never by
 * user cookies. Match by `pathname.startsWith("/public/")` so we catch
 * `/public/n/<share-id>` and any future siblings (e.g. `/public/d/...`).
 */
const isPublicRoute = (pathname: string): boolean =>
  pathname.startsWith("/public/");

/**
 * Installs / uninstalls the share-token provider on every registered API.
 *
 * Three cases (evaluated on every pathname / user change):
 *
 *   - on `/public/*`                -> install the share-JWT provider
 *     regardless of `user`. Logged-in viewers of a share link use the
 *     share grant, not their cookies — keeps the public route isolated.
 *
 *   - logged-in user, NOT on /public -> uninstall the share provider
 *     (user JWT + cookies are used, no share header is attached).
 *
 *   - anonymous viewer, NOT on /public -> install the share provider
 *     as well. The provider lazily returns `null` when no share JWT is
 *     in zustand, which collapses to "no header" without explicit
 *     uninstall. This mirrors the previous behaviour.
 *
 * The provider reads `useAuthStore.shareAccessToken` synchronously on
 * every request, so swapping the token mid-session doesn't require
 * re-installing the provider — only the route / user mode change does.
 */
function useShareTokenMode() {
  const user = useUserStore((s) => s.user);
  const { pathname } = useLocation();

  useEffect(() => {
    if (isPublicRoute(pathname)) {
      // /public/* — always use the share JWT. Logged-in users on this
      // route ignore their cookies to avoid leaking identity.
      apiRegistry.installShareTokenProvider(
        () => useAuthStore.getState().shareAccessToken,
      );
      return () => apiRegistry.installShareTokenProvider(null);
    }

    if (user) {
      // Logged in off a public route: explicitly disable share-token
      // injection so user JWT + cookies are the sole auth mechanism.
      apiRegistry.installShareTokenProvider(null);
      return;
    }

    // Anonymous off a public route: install the same provider. When
    // no share is active it returns null and no header is attached.
    apiRegistry.installShareTokenProvider(
      () => useAuthStore.getState().shareAccessToken,
    );
    return () => apiRegistry.installShareTokenProvider(null);
  }, [user, pathname]);
}

/**
 * Ensures, that on page load the user and notes get loaded
 */
export const Bootstrap: React.FC = () => {
  useShareTokenMode();
  const { user } = useUserStore();

  // Resolve once and reuse the references below. The helpers throw if the
  // API isn't registered — that surfaces missing-registration bugs at
  // startup instead of as silent fetch failures later.
  const searchNotesApi = getSearchNotesApi();
  const userApi = getUserApi();

  useQuery({
    queryKey: ["search-notes-latest", user?.id],
    queryFn: async () =>
      searchNotesApi.search(RestNotesSearchType.LATEST, "", 100, 0),
    enabled: !!user?.id, // don't run when user is not loaded yet
    staleTime: Infinity, // cache forever
  });

  const userQuery = useQuery({
    queryKey: ["user-load"], // load once - there shouldn't be a reason to load a user multiple times
    queryFn: async () => await userApi.fetchUser(),
    staleTime: Infinity, // cache forever
  });

  // Mount the access-token query at app boot so the JWT is in the auth
  // store by the time the user enters write mode. Without this, users who
  // land on a read-mode note and toggle to write see the badge stuck on
  // "Awaiting login" until the fetch resolves.
  useAccessToken();

  // Refetch the JWT once the user-load settles — the session cookie may
  // not have been valid when the query first fired. `useRef` latch
  // prevents Strict Mode's double-mount from triggering two refetches.
  const didRefetchAfterUserLoad = useRef(false);
  useEffect(() => {
    if (userQuery.isSuccess && !didRefetchAfterUserLoad.current) {
      didRefetchAfterUserLoad.current = true;
      // Lazy import: `useAccessToken` would re-create the query each
      // call, and its result object is reference-unstable, so we go
      // through the singleton client directly.
      void import("./api/queryClient").then(({ queryClient }) =>
        queryClient.invalidateQueries({ queryKey: ["accessToken"] }),
      );
    }
  }, [userQuery.isSuccess]);

  return <></>;
};
