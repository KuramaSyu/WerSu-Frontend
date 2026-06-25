import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUserStore } from "./zustand/userStore";
import { useAuthStore } from "./zustand/useAuthStore";
import { SearchNotesApi } from "./api/SearchNotesApi";
import { RestNotesSearchType } from "./api/models/search";
import { UserApi } from "./api/UserApi";
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

  useQuery({
    queryKey: ["search-notes-latest", user?.id],
    queryFn: async () =>
      new SearchNotesApi().search(RestNotesSearchType.LATEST, "", 100, 0),
    enabled: !!user?.id, // don't run when user is not loaded yet
    staleTime: Infinity, // cache forever
  });

  useQuery({
    queryKey: ["user-load"], // load once - there shouldn't be a reason to load a user multiple times
    queryFn: async () => await new UserApi().fetchUser(),
    staleTime: Infinity, // cache forever
  });
  return <></>;
};
