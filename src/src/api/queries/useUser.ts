import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getUserApi } from "../UserApi";
import { UserError } from "../models/UserError";
import { useAuthStore } from "../../zustand/useAuthStore";
import { useUserStore } from "../../zustand/userStore";
import { WersuUserImpl, type WersuUser } from "../../components/DiscordLogin";

// Resolve through the api registry so the share-token provider installed on Bootstrap reaches this instance.
const userApi = getUserApi();

const USER_FETCH_RETRY_LIMIT = 1;

// react-query retry predicate.
const shouldRetryFetchUser = (
  failureCount: number,
  error: unknown,
): boolean => {
  if (error instanceof UserError && error.status === 404) {
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

// True once useUser has resolved to a logged-in viewer.
// Use this to gate auth-required queries on the cold-start frame.
export function useIsAuthenticated(): boolean {
  return useUser().isSuccess;
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
