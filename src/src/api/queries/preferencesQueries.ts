// TanStack query hooks for /api/preferences.

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

export const preferencesKeys = {
  all: ["preferences"] as const,

  detail: (request: GetPreferencesEndpointRequest) =>
    [...preferencesKeys.all, request.scope, request.target_id] as const,
};

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

/** Read the stored blob for a (scope, target_id) pair. */
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

/** Replace the blob wholesale; invalidates the matching detail cache on success. */
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

/** Shallow-merge the payload into the blob; invalidates the matching detail cache on success. */
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

/** Drop the blob; invalidates the matching detail cache on success. */
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
