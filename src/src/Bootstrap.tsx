import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUserStore } from "./zustand/userStore";
import { useAuthStore } from "./zustand/useAuthStore";
import { getSearchNotesApi } from "./api/SearchNotesApi";
import { RestNotesSearchType } from "./api/models/search";
import { getUserApi } from "./api/UserApi";
import { useAccessToken } from "./api/queries/useAccessToken";
import { apiRegistry } from "./api/apiRegistry";

/**
 * Installs / uninstalls the share-token provider on every registered API
 * based on whether the current viewer is logged in.
 *
 *   - logged-in user  -> provider = null
 *     (the user JWT + cookies are used; no share header is attached)
 *
 *   - anonymous viewer -> provider = () => useAuthStore.getState().shareAccessToken
 *     (lazily reads the share JWT from zustand; returns null when no share
 *      is active, which collapses to "no header" without explicit uninstall)
 *
 * The provider re-reads from zustand at request time, so swapping the token
 * mid-session doesn't require re-installing the provider — only the
 * "logged in / anonymous" mode change does.
 */
function useShareTokenMode() {
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    if (user) {
      // Logged in: explicitly disable share-token injection so the user
      // JWT + cookies are the sole auth mechanism.
      apiRegistry.installShareTokenProvider(null);
      return;
    }

    // Anonymous: install a provider that reads the share token from
    // zustand on every request. When `shareAccessToken` is null (no share
    // active) the provider returns null and no header is attached.
    apiRegistry.installShareTokenProvider(
      () => useAuthStore.getState().shareAccessToken,
    );
  }, [user]);
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
