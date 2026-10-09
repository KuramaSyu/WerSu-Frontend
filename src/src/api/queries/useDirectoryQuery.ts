import { useQuery } from "@tanstack/react-query";
import { getDirectoryApi } from "../DirectoryApi";
import { UserError } from "../models/UserError";
import { useIsAuthenticated, useUserKey } from "./useUser";

// Resolve through the api registry so the share-token provider installed on Bootstrap reaches this instance.
const directoryApi = getDirectoryApi();

// 403 is permanent (access denied) - skip retries to surface it sooner.
const shouldRetryFetchDirectory = (
  failureCount: number,
  error: unknown,
): boolean => {
  if (error instanceof UserError && error.status === 403) {
    return false;
  }
  return failureCount < 3;
};

export const directoryQueryKeys = {
  all: ["directory"] as const,
  detail: (userKey: string | null, directoryId: string) =>
    ["directory", directoryId, userKey] as const,
};

// Fetches a single directory by id. Returns undefined while loading, DirectoryReply on success, UserError on non-OK.
export function useDirectory(directoryId?: string) {
  const userKey = useUserKey();
  const isAuthed = useIsAuthenticated();
  return useQuery({
    queryKey: directoryQueryKeys.detail(userKey, directoryId ?? ""),
    queryFn: async () => {
      if (!directoryId) {
        return null;
      }
      return await directoryApi.get(directoryId);
    },
    enabled: !!directoryId && isAuthed,
    retry: shouldRetryFetchDirectory,
  });
}
