// TanStack query hooks for authenticated user discovery via the
// `/api/users/*` read routes.

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { getUserManagementApi } from "../UserManagementApi";
import type { SearchUserReply } from "../models/userManagement";
import { useIsAuthenticated } from "./useUser";

const userManagementApi = getUserManagementApi();

export const userSearchKeys = {
  all: ["users", "search"] as const,
  query: (query: string) => [...userSearchKeys.all, query] as const,
};

export const usersByIdsKeys = {
  all: ["users", "byIds"] as const,
  ids: (ids: string[]) => [...usersByIdsKeys.all, ids] as const,
};

export function useSearchUsers(
  query: string,
  options?: Omit<
    UseQueryOptions<
      SearchUserReply[],
      Error,
      SearchUserReply[],
      ReturnType<typeof userSearchKeys.query>
    >,
    "queryKey" | "queryFn"
  >,
) {
  const isAuthed = useIsAuthenticated();
  const trimmed = query.trim();
  return useQuery({
    queryKey: userSearchKeys.query(trimmed),
    queryFn: () => userManagementApi.searchUsers({ query: trimmed }),
    ...options,
    // One-character queries are noisy; require at least two characters.
    enabled: (options?.enabled ?? true) && isAuthed && trimmed.length >= 2,
    staleTime: 30_000,
  });
}

const normalizeIds = (ids: readonly string[]): string[] =>
  [...new Set(ids.filter((id) => id.trim().length > 0))].sort();

/**
 * Batch-resolve user ids into username-bearing records.
 *
 * The backend returns records in request order and omits unknown ids, so
 * callers should map by `id` rather than relying on array position.
 */
export function useUsersByIds(
  ids: readonly string[],
  options?: Omit<
    UseQueryOptions<
      SearchUserReply[],
      Error,
      SearchUserReply[],
      ReturnType<typeof usersByIdsKeys.ids>
    >,
    "queryKey" | "queryFn"
  >,
) {
  const isAuthed = useIsAuthenticated();
  const normalized = normalizeIds(ids);
  return useQuery({
    queryKey: usersByIdsKeys.ids(normalized),
    queryFn: () => userManagementApi.getUsersByIds({ ids: normalized }),
    ...options,
    enabled: (options?.enabled ?? true) && isAuthed && normalized.length > 0,
    staleTime: 60_000,
  });
}
