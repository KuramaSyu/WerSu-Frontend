import { BACKEND_BASE } from "../statics";
import { queryClient, PERSIST_CACHE_STORAGE_KEY } from "../api/queryClient";
import { useAuthStore } from "../zustand/useAuthStore";
import { useUserStore, useUsersStore } from "../zustand/userStore";
import { useSelectedShelfStore } from "../zustand/useSelectedShelfStore";
import { useDirectoryTreeStore } from "../zustand/useDirectoryTreeStore";

/**
 * clears all relevant stores
 *
 * Order matters: cancel in-flight queries *before* dropping the
 * caches, otherwise an in-flight `/api/auth/user` refetch could
 * resolve after the stores were cleared and re-hydrate the previous
 * identity (avatar flashing back into the top bar).
 */
export async function handleLogout(): Promise<void> {
  // 1. Stop everything that is currently fetching so it can't write
  //    the old user back into the cache after we clear it.
  await queryClient.cancelQueries();

  // 2. Invalidate the session on the backend (best-effort). Even if
  //    this fails we still drop local identity below so the UI never
  //    shows the previous user's data.
  try {
    const response = await fetch(`${BACKEND_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      console.error(
        `Logout request failed (HTTP ${response.status}); clearing local session anyway`,
      );
    }
  } catch (error) {
    console.error("Error logging out:", error);
  }

  // 3. Drop identity in zustand so every selector that depends on
  //    `user` / JWTs re-renders against the new (empty) state. The
  //    `setLoggedOut` latch also disables the `useUser` query so the
  //    still-mounted observer can't refetch and re-hydrate the old
  //    user off a still-valid cookie / fake backend.
  useUserStore.getState().setLoggedOut();
  useUsersStore.setState({ users: {}, friendsLoaded: false });
  useAuthStore.getState().setAccessToken(null);
  useAuthStore.getState().setShareAccessToken(null);
  useAuthStore.getState().resetShareAttachmentTokens();
  useSelectedShelfStore.getState().setSelectedShelfId(null);
  useDirectoryTreeStore.getState().clear();

  // 4. Clear the React Query cache so the previous user's data
  //    (notes, search results, activity, ...) doesn't flash on the
  //    next session. This also drops the persisted `["user"]` entry
  //    so a hard reload can't resurrect the old identity.
  queryClient.clear();

  // 5. Drop the persisted cache synchronously as well. The persister
  //    throttles its writes, so a reload immediately after logout
  //    could otherwise restore the old `["user"]` entry before the
  //    empty cache is flushed. Removing the key guarantees the next
  //    boot starts logged out.
  try {
    window.localStorage.removeItem(PERSIST_CACHE_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear persisted query cache:", error);
  }
}
