import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useUserStore } from "./zustand/userStore";
import { useAuthStore } from "./zustand/useAuthStore";
import { getSearchNotesApi } from "./api/SearchNotesApi";
import { RestNotesSearchType } from "./api/models/search";
import { getUserApi } from "./api/UserApi";
import { useShareAccessToken } from "./api/queries/useShareAccessToken";
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
    const publicRoute = isPublicRoute(pathname);
    console.debug(
      "[share-token-mode] effect — pathname=",
      pathname,
      "isPublic=",
      publicRoute,
      "user=",
      user ? user.id : null,
    );
    if (publicRoute) {
      // /public/* -> always use the share JWT. Logged-in users on this
      // route ignore their cookies to avoid leaking identity.
      const provider = () => {
        const tok = useAuthStore.getState().shareAccessToken;
        console.debug(
          "[share-token-mode] provider invoked on public route, returning token prefix=",
          tok ? tok.slice(0, 12) + "..." : "(null)",
        );
        return tok;
      };
      apiRegistry.installShareTokenProvider(provider);
      console.debug("[share-token-mode] installed share-token provider");
      return () => {
        console.debug("[share-token-mode] uninstalling share-token provider");
        apiRegistry.installShareTokenProvider(null);
      };
    }

    if (user) {
      // Logged in off a public route: explicitly disable share-token
      // injection so user JWT + cookies are the sole auth mechanism.
      console.debug(
        "[share-token-mode] logged-in user off /public - clearing share provider",
      );
      apiRegistry.installShareTokenProvider(null);
      return;
    }

    // Anonymous off a public route: install the same provider. When
    // no share is active it returns null and no header is attached.
    console.debug(
      "[share-token-mode] anonymous off /public - installing same share provider (returns null when no share is active)",
    );
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
  // Mount `useShareAccessToken` here (before any page-level query)
  // so the share JWT lands in the auth store before `useNote` fires
  // GET /api/notes/:id - otherwise the request goes out without an
  // Authorization header and falls back to session-based auth (401).
  const { pathname } = useLocation();
  const onPublicRoute = isPublicRoute(pathname);
  const shareIdMatch = pathname.match(/^\/public\/n\/([^/?#]+)/);
  const shareId = shareIdMatch ? shareIdMatch[1] : null;
  // Hook no-ops on null `shareId`, so the conditional is in the arg.
  useShareAccessToken({ shareId: onPublicRoute ? shareId : null });

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

  // `userQuery` and the access-token query only run off /public/* -
  // there the user is anonymous, the cookie session is missing, and
  // these calls would just 401 and clutter the log.
  const userQuery = useQuery({
    queryKey: ["user-load"], // load once - there shouldn't be a reason to load a user multiple times
    queryFn: async () => await userApi.fetchUser(),
    enabled: !onPublicRoute,
    staleTime: Infinity, // cache forever
  });

  // Mount the access-token query at app boot so the JWT is in the auth
  // store by the time the user enters write mode. Without this, users who
  // land on a read-mode note and toggle to write see the badge stuck on
  // "Awaiting login" until the fetch resolves.
  useQuery({
    queryKey: ["accessToken"],
    // Same as `useAccessToken()` but with `enabled: !onPublicRoute`
    // so /public/* doesn't fire a doomed /api/auth/access-token call.
    enabled: !onPublicRoute,
    retry: 5,
    // Exponential backoff capped at 15s, so transient 401s recover in
    // ~30s instead of locking the user out for the full refetchInterval.
    retryDelay: (i) => Math.min(15_000, 1_000 * 2 ** i),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // `always` so the query still runs when navigator.onLine is false
    // and the badge can show a useful diagnostic instead of silence.
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
    staleTime: 15 * 60 * 1000 - 60 * 1000,
    refetchInterval: 15 * 60 * 1000 - 60 * 1000,
  });

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
