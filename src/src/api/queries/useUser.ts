import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getUserApi } from "../UserApi";
import { UserError } from "../models/UserError";
import { useAuthStore } from "../../zustand/useAuthStore";
import {
  DiscordUserImpl,
  type DiscordUser,
} from "../../components/DiscordLogin";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. `UserApi` doesn't extend the bearer
// mixin yet, but resolving through the registry keeps wiring consistent and
// lets us add share-token support later without touching call sites.
const userApi = getUserApi();

const USER_FETCH_RETRY_LIMIT = 3;

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
 * Hook to fetch the current user with discord login authentication.
 */
export function useUser(): UseQueryResult<DiscordUserImpl, Error> {
  return useQuery<DiscordUser, Error, DiscordUserImpl>({
    queryKey: ["user"],
    queryFn: async () => {
      return await userApi.fetchUser();
    },

    // the cached entry is plain JSON -> recreate class
    select: (data) => new DiscordUserImpl(data),
    retry: shouldRetryFetchUser,
  });
}

/**
 * Hook to fetch all users the current user has access to, including their friends
 * @returns
 */
export function useUsers(
  userIds: string[],
): UseQueryResult<Record<string, DiscordUser>, Error> {
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
      var users: Record<string, DiscordUser> = {};
      for (const user of data) {
        users[user.id] = new DiscordUserImpl(user);
      }
      return users;
    },
  });
}
