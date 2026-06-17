import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { UserApi } from "../UserApi";
import { useAuthStore } from "../../zustand/useAuthStore";
import { DiscordUserImpl } from "../../components/DiscordLogin";

/**
 * Hook to fetch the current user with discord login authentication
 * @returns
 */
export function useUser(): UseQueryResult<DiscordUserImpl, Error> {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const data = await new UserApi().fetchUser();
      return new DiscordUserImpl(data);
    },

    // the cached entry is plain JSON -> recreate class
    select: (data) => new DiscordUserImpl(data),
  });
}
