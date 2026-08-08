import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getUserApi } from "../UserApi";
import { UserError } from "../models/UserError";
import { useAuthStore } from "../../zustand/useAuthStore";
import { useUserStore } from "../../zustand/userStore";
import { WersuUserImpl, type WersuUser } from "../../components/DiscordLogin";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. `UserApi` doesn't extend the bearer
// mixin yet, but resolving through the registry keeps wiring consistent and
// lets us add share-token support later without touching call sites.
const userApi = getUserApi();

const USER_FETCH_RETRY_LIMIT = 1;

/**
 * `react-query` retry predicate. Returns `false` to skip further
 * retries for a given error.
 */
const shouldRetryFetchUser = (
  failureCount: number,
  error: unknown,
): boolean => {
  if (error instanceof UserError && error.status === 404) {
    return false;
  }
  return failureCount < USER_FETCH_RETRY_LIMIT;
};

/**
 * Identity key for `queryKey` tuples: the logged-in user id when
 * one is known, otherwise the public-share JWT, otherwise `null`.
 * Embedding this in a queryKey forces a refetch when the viewer
 * switches (anonymous -> login, login -> logout, share -> different
 * share).
 */
export function useUserKey(): string | null {
  const userId = useUserStore((s) => s.user?.id ?? null);
  const shareToken = useAuthStore((s) => s.shareAccessToken);
  return userId ?? shareToken;
}

/**
 * Hook to fetch the current user with discord login authentication.
 */
export function useUser(): UseQueryResult<WersuUserImpl, Error> {
  return useQuery<WersuUser, Error, WersuUserImpl>({
    queryKey: ["user"],
    queryFn: async () => {
      const result = await userApi.fetchUser();
      console.log("useUser: fetched user", result);
      return result;
    },

    // the cached entry is plain JSON -> recreate class
    select: (data) => new WersuUserImpl(data),
    retry: shouldRetryFetchUser,
  });
}

/**
 * Hook to fetch all users the current user has access to, including their friends
 * @returns
 */
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
      var users: Record<string, WersuUser> = {};
      for (const user of data) {
        users[user.id] = new WersuUserImpl(user);
      }
      return users;
    },
  });
}
