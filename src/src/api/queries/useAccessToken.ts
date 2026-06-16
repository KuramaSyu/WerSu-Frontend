import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { UserApi } from "../UserApi";
import { useAuthStore } from "../../zustand/useAuthStore";

const isExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));

    // expires at
    const exp = payload.exp;

    const now = Math.floor(Date.now() / 1000);
    return exp < now;
  } catch (error) {
    console.error("Error parsing JWT token:", error);
    return false;
  }
};

const JWT_REFRESH_BUFFER = 60; // seconds

/**
 * TRY TO USE `useAuthStore` INSTEAD OF THIS HOOK and register given listeners there.
 * This hooks main purpose is to fetch the access token regularly and set it in the zustand store.
 *
 * A React Query hook for fetching and managing the user's JWT access token.
 */
export function useAccessToken(): UseQueryResult<string, Error> {
  return useQuery({
    queryKey: ["accessToken"],
    queryFn: async () => {
      // i am sorry, but I will directly update zustand in here. I want to avoid
      // extra react components with a useEffect to transfer the token from react query to zustand
      const token = await new UserApi().fetchAccessToken().then((data) => {
        console.log(
          "Fetched new access token:",
          data.token.substring(0, 10) + "...",
        );
        return data.token;
      });

      // set zustand directly
      // setAccessToken will notify all listeners
      useAuthStore.getState().setAccessToken(token);

      // return token anyways
      return token;
    },

    staleTime: 15 * 60 * 1000 - JWT_REFRESH_BUFFER * 1000, // 15 minutes - 1 minute buffer
    refetchInterval: 15 * 60 * 1000 - JWT_REFRESH_BUFFER * 1000,
  });
}
