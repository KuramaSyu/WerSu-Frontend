import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getUserApi } from "../UserApi";
import { UserError } from "../models/UserError";
import { useAuthStore } from "../../zustand/useAuthStore";
import { useUserStore } from "../../zustand/userStore";
import { WersuUserImpl, type WersuUser } from "../../components/DiscordLogin";

// Resolve through the api registry so the share-token provider installed on Bootstrap reaches this instance.
const userApi = getUserApi();

const USER_FETCH_RETRY_LIMIT = 3;

// React-query retry predicate. Only "real" auth failures are final;
// a transient network error (fetch throws a `TypeError`, not a
// `UserError`) gets a few retries so a momentarily dropped connection
// does not immediately look like a logout.
const shouldRetryFetchUser = (
  failureCount: number,
  error: unknown,
): boolean => {
  if (error instanceof UserError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < USER_FETCH_RETRY_LIMIT;
};

// Identity key for queryKey tuples: user id, share JWT, or null.
// Embedding this in a queryKey forces a refetch when the viewer switches.
export function useUserKey(): string | null {
  const userId = useUserStore((s) => s.user?.id ?? null);
  const shareToken = useAuthStore((s) => s.shareAccessToken);
  return userId ?? shareToken;
}

// Hook to fetch the current user with discord login authentication.
export function useUser(): UseQueryResult<WersuUserImpl, Error> {
  // After an explicit logout the query must stay off so it can't
  // re-authenticate the viewer off a still-valid cookie (or the fake
  // backend). A real login calls `setUser(user)`, which clears this.
  const loggedOut = useUserStore((s) => s.loggedOut);
  return useQuery<WersuUser, Error, WersuUserImpl>({
    queryKey: ["user"],
    enabled: !loggedOut,
    queryFn: async () => {
      // Hard stop: never let a fetch that raced the logout latch
      // re-authenticate the viewer. `enabled` already gates this, but
      // an observer can briefly still be enabled during the logout
      // re-render.
      if (useUserStore.getState().loggedOut) {
        throw new UserError("Logged out", "Logged out", 401);
      }
      const result = await userApi.fetchUser();
      console.log("useUser: fetched user", result);
      return result;
    },

    // the cached entry is plain JSON -> recreate class
    select: (data) => new WersuUserImpl(data),
    retry: shouldRetryFetchUser,
  });
}

// True once useUser has resolved to a logged-in viewer.
// Use this to gate auth-required queries on the cold-start frame.
export function useIsAuthenticated(): boolean {
  return useUser().isSuccess;
}

/**
 * True when an error from `useUser` proves the viewer has no session
 * (401/403/404), as opposed to a transient network failure. Redirects
 * to the login page should key off this, never off `isError` alone.
 */
export function isAuthError(error: unknown): boolean {
  return (
    error instanceof UserError &&
    (error.status === 401 || error.status === 403 || error.status === 404)
  );
}

// Cache usersById by raw query-data identity so cache hits return the same Record ref.
const usersByIdCache = new WeakMap<object, Record<string, WersuUser>>();

// Hook to fetch all users the current user has access to, including their friends.
export function useUsers(
  userIds: string[],
): UseQueryResult<Record<string, WersuUser>, Error> {
  return useQuery({
    queryKey: ["users", userIds],
    queryFn: async () => {
      if (userIds.length === 0) {
        return [];
      }
      return await userApi.fetchUsers(userIds);
    },

    // the cached entry is plain JSON -> recreate class
    select: (data) => {
      const cached = usersByIdCache.get(data);
      if (cached) return cached;
      const next: Record<string, WersuUser> = {};
      for (const user of data) {
        next[user.id] = new WersuUserImpl(user);
      }
      usersByIdCache.set(data, next);
      return next;
    },
  });
}
