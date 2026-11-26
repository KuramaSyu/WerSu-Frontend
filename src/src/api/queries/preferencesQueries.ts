/*
  TanStack query hooks for `/api/preferences`.

  Thin wrappers around `PreferencesApi` that add query-key management and
  cache invalidation:

    - `usePreferences`         — read a blob (query).
    - `useReplacePreferences`  — replace wholesale (mutation).
    - `useMergePreferences`    — shallow-merge (mutation).
    - `useDeletePreferences`   — drop the blob (mutation).

  Rail personalization gets a dedicated pair on top of those primitives:

    - `usePersonalizationPreferences`      — read the rail settings.
    - `useSavePersonalizationPreferences`  — merge rail settings in.

  Every mutation invalidates the matching `preferencesKeys.detail(...)` entry
  on success so the next `usePreferences` read reflects the write. Wire types
  live in `../models/preferences`.
*/

import { useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { getPreferencesApi } from "../PreferencesApi";
import {
  PERSONALIZATION_PREFERENCE_KEY,
  parsePersonalizationData,
  serializePersonalizationData,
  type PersonalizationData,
} from "../../models/personalization";

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

  /** Key for a single `(scope, target_id, key?)` blob. */
  detail: (request: GetPreferencesEndpointRequest) =>
    [
      ...preferencesKeys.all,
      request.scope,
      request.target_id,
      request.key ?? null,
    ] as const,
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
          key: variables.key,
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
          key: variables.key,
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
          key: variables.key,
        }),
      });
      await userOnSuccess?.(data, variables, ...args);
    },
  });
}

// -----------------------------------------------------------------------------
// Rail personalization (`scope: "user"`, `key: "personalization"`)
// -----------------------------------------------------------------------------

/**
 * Request shape of `usePersonalizationPreferences`'s read. The rail settings
 * always live in the signed-in user's own scope, so callers only pass the id.
 */
export interface PersonalizationPreferenceOwner {
  /** Id of the signed-in user; empty/`null` disables the read. */
  userId: string | null;
}

/**
 * Read the Home left-rail personalization row.
 *
 * Stored as a *keyed* preference (`key: "personalization"`) under the user
 * scope rather than in a brand-new row: the keyed blob is the existing
 * mechanism for topic-scoped preference payloads (see `custom-themes`), so the
 * rail settings share the owner's preference budget instead of competing for
 * one of their key slots with an unrelated default blob.
 *
 * Returns the parsed payload (`null` when absent or written by an older
 * client) plus the raw TanStack state, so callers can tell "not loaded yet"
 * from "loaded, no row" via `isLoading`.
 */
export function usePersonalizationPreferences(
  owner: PersonalizationPreferenceOwner,
) {
  const request: GetPreferencesEndpointRequest = {
    scope: "user",
    target_id: owner.userId ?? "",
    key: PERSONALIZATION_PREFERENCE_KEY,
  };
  const query = useQuery({
    queryKey: preferencesKeys.detail(request),
    queryFn: () => preferencesApi.getPreferences(request),
    enabled: !!request.target_id,
  });

  const data = useMemo(
    () => parsePersonalizationData(query.data?.preferences_json),
    [query.data],
  );

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    /** Timestamp of the last successful read; advances on every `refetch`. */
    dataUpdatedAt: query.dataUpdatedAt,
    /** Re-read the row (e.g. after another client changed the settings). */
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Variables for `useSavePersonalizationPreferences`. */
export interface SavePersonalizationPreferencesRequest {
  /** Id of the signed-in user the row belongs to. */
  userId: string;
  /** Full rail payload to persist; encoded by the hook. */
  data: PersonalizationData;
}

/**
 * Merge rail settings into the existing `personalization` preference row.
 *
 * Uses `PATCH /api/preferences` (shallow merge) rather than a replace, so a
 * payload written by a newer client — or any other top-level key sharing the
 * row — survives. `useMergePreferences` invalidates the matching detail cache,
 * so `usePersonalizationPreferences` re-reads the saved blob.
 */
export function useSavePersonalizationPreferences(
  options?: UseMutationOptions<
    MergePreferencesEndpointReply,
    Error,
    SavePersonalizationPreferencesRequest
  >,
) {
  const merge = useMergePreferences();

  return useMutation({
    mutationFn: (request: SavePersonalizationPreferencesRequest) =>
      merge.mutateAsync({
        scope: "user",
        target_id: request.userId,
        key: PERSONALIZATION_PREFERENCE_KEY,
        preferences_json: serializePersonalizationData(request.data),
      }),
    ...options,
  });
}
