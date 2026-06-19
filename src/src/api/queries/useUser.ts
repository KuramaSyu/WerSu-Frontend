import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { UserApi } from "../UserApi";
import { useAuthStore } from "../../zustand/useAuthStore";
import {
  DiscordUserImpl,
  type DiscordUser,
} from "../../components/DiscordLogin";

/**
 * Hook to fetch the current user with discord login authentication
 * @returns
 */
export function useUser(): UseQueryResult<DiscordUserImpl, Error> {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      return await new UserApi().fetchUser();
    },

    // the cached entry is plain JSON -> recreate class
    select: (data) => new DiscordUserImpl(data),
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
      return await new UserApi().fetchUsers(userIds);
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
