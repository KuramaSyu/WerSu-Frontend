// Id-parameterised directory mutations.
//
// Lifted out of useDirectoryFeatures so cards on other pages can
// delete a directory without owning the whole directory-view state.
// Behaviour is unchanged: same API call, same cache surgery, same
// invalidation.

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DirectoryApi } from "../DirectoryApi";
import { removeDirectory } from "./directoryQueries";
import { useUserKey } from "./useUser";

/**
 * Returns an async `deleteDirectory(id)` that calls the REST API,
 * drops the directory from every cached list, and invalidates the
 * queries other pages depend on. Resolves `true` on success and
 * `false` when the API declined.
 */
export function useDirectoryDelete(): (
  directoryId: string,
) => Promise<boolean> {
  const queryClient = useQueryClient();
  const userKey = useUserKey();

  return useCallback(
    async (directoryId: string): Promise<boolean> => {
      const deleted = await new DirectoryApi().delete(directoryId);
      if (!deleted) {
        return false;
      }
      removeDirectory(queryClient, directoryId);
      queryClient.invalidateQueries({ queryKey: ["directories"] });
      queryClient.invalidateQueries({
        queryKey: ["directory", directoryId, userKey],
      });
      return true;
    },
    [queryClient, userKey],
  );
}
