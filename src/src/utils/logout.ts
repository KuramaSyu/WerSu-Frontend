import { BACKEND_BASE } from "../statics";
import { queryClient } from "../api/queryClient";
import { useAuthStore } from "../zustand/useAuthStore";
import { useUserStore } from "../zustand/userStore";
import { useSelectedShelfStore } from "../zustand/useSelectedShelfStore";

/**
 * clears all relevant stores
 */
export async function handleLogout(): Promise<void> {
  try {
    await fetch(`${BACKEND_BASE}/api/auth/logout`, {
      credentials: "include",
    });
  } catch (error) {
    console.error("Error logging out:", error);
  }

  // Drop identity in zustand so every selector that depends on
  // `user` / JWTs re-renders against the new (empty) state.
  useUserStore.getState().setUser(null);
  useAuthStore.getState().setAccessToken(null);
  useAuthStore.getState().setShareAccessToken(null);
  useAuthStore.getState().resetShareAttachmentTokens();
  useSelectedShelfStore.getState().setSelectedShelfId(null);

  // Clear the React Query cache so the previous user's data
  // (notes, search results, activity, ...) doesn't flash on the
  // next session.
  queryClient.clear();
}
