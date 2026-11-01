/*
  TanStack query hooks for `/api/preferences`.

  Thin wrappers around `PreferencesApi` that add query-key management and
  cache invalidation:

    - `usePreferences`         — read a blob (query).
    - `useReplacePreferences`  — replace wholesale (mutation).
    - `useMergePreferences`    — shallow-merge (mutation).
    - `useDeletePreferences`   — drop the blob (mutation).

  Every mutation invalidates the matching `preferencesKeys.detail(...)` entry
  on success so the next `usePreferences` read reflects the write. Wire types
  live in `../models/preferences`.
*/

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { getPreferencesApi } from "../PreferencesApi";

import type {
  DeletePreferencesEndpointReply,
  DeletePreferencesEndpointRequest,
  GetPreferencesEndpointReply,
  GetPreferencesEndpointRequest,
  MergePreferencesEndpointReply,
  MergePreferencesEndpointRequest,
  ReplacePreferencesEndpointReply,
  ReplacePreferencesEndpointRequest,
} from "../models/preferences";

// Use the registered singleton so the share-token provider reaches this instance.
const preferencesApi = getPreferencesApi();

// -----------------------------------------------------------------------------
// Query keys
// -----------------------------------------------------------------------------

/**
 * Query-key factory for preferences.
 *
 * `detail` keys include both `scope` and `target_id`, so each stored blob
 * gets its own cache entry and invalidating one scope never clobbers another.
 */
export const preferencesKeys = {
  /** Root key for all preference queries. */
  all: ["preferences"] as const,

  /** Key for a single `(scope, target_id)` blob. */
  detail: (request: GetPreferencesEndpointRequest) =>
    [...preferencesKeys.all, request.scope, request.target_id] as const,
};

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

/**
 * Read the stored blob for a `(scope, target_id)` pair.
 * `GET /api/preferences`
 *
 * Disabled while `target_id` is empty (e.g. before the current user/shelf has
 * resolved), so callers can mount the hook unconditionally. The backend
 * returns `{}` when no row exists, meaning a successful query may carry empty
 * `data`.
 *
 * @param request - `(scope, target_id)` to read.
 * @param options - Extra TanStack query options; `queryKey` and `queryFn` are
 *   managed by the hook and cannot be overridden.
 */
export function usePreferences(
  request: GetPreferencesEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      GetPreferencesEndpointReply,
      Error,
      GetPreferencesEndpointReply,
      ReturnType<typeof preferencesKeys.detail>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: preferencesKeys.detail(request),
    queryFn: () => preferencesApi.getPreferences(request),
    enabled: !!request.target_id,
    ...options,
  });
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

/**
 * Replace the stored blob wholesale.
 * `POST /api/preferences`
 *
 * Invalidates the matching detail cache on success before delegating to the
 * caller's `onSuccess` (if any). Pass a caller `onSuccess` via `options`; it
 * runs after invalidation and receives the same arguments.
 */
export function useReplacePreferences(
  options?: UseMutationOptions<
    ReplacePreferencesEndpointReply,
    Error,
    ReplacePreferencesEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // Keep onSuccess out of restOptions so the invalidation wrapper cannot be overridden.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => preferencesApi.replacePreferences(request),
    ...restOptions,
    onSuccess: async (data, variables, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: preferencesKeys.detail({
          scope: variables.scope,
          target_id: variables.target_id,
        }),
      });
      await userOnSuccess?.(data, variables, ...args);
    },
  });
}

/**
 * Shallow-merge the payload into the stored blob.
 * `PATCH /api/preferences`
 *
 * Top-level keys overwrite the same keys in storage; nested objects and lists
 * are replaced wholesale. Invalidates the matching detail cache on success
 * before delegating to the caller's `onSuccess` (if any).
 */
export function useMergePreferences(
  options?: UseMutationOptions<
    MergePreferencesEndpointReply,
    Error,
    MergePreferencesEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // Keep onSuccess out of restOptions so the invalidation wrapper cannot be overridden.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => preferencesApi.mergePreferences(request),
    ...restOptions,
    onSuccess: async (data, variables, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: preferencesKeys.detail({
          scope: variables.scope,
          target_id: variables.target_id,
        }),
      });
      await userOnSuccess?.(data, variables, ...args);
    },
  });
}

/**
 * Drop the stored blob. Idempotent.
 * `DELETE /api/preferences`
 *
 * The reply's `success` is `true` iff a row was actually removed. Invalidates
 * the matching detail cache on success before delegating to the caller's
 * `onSuccess` (if any).
 */
export function useDeletePreferences(
  options?: UseMutationOptions<
    DeletePreferencesEndpointReply,
    Error,
    DeletePreferencesEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // Keep onSuccess out of restOptions so the invalidation wrapper cannot be overridden.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => preferencesApi.deletePreferences(request),
    ...restOptions,
    onSuccess: async (data, variables, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: preferencesKeys.detail({
          scope: variables.scope,
          target_id: variables.target_id,
        }),
      });
      await userOnSuccess?.(data, variables, ...args);
    },
  });
}
