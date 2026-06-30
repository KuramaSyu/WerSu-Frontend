// sharing_queries.ts
//
// TanStack query hooks for the **private** (authenticated) share
// management API (`SharingApi` in `../SharingApi.ts`). The public
// share grant + JWT hooks live in `./publicSharingQueries.ts`.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { getSharingApi } from "../SharingApi";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const sharingApi = getSharingApi();

import type {
  CreateShareEndpointReply,
  CreateShareEndpointRequest,
  DeleteSharesEndpointReply,
  DeleteSharesEndpointRequest,
  GetShareByIdEndpointReply,
  GetShareByIdEndpointRequest,
  GetSharesByIdEndpointReply,
  GetSharesByIdEndpointRequest,
  GetSharesEndpointReply,
  GetSharesEndpointRequest,
  UpdateShareEndpointReply,
  UpdateShareEndpointRequest,
} from "../models/sharing";

// -----------------------------------------------------------------------------
// Query keys
// -----------------------------------------------------------------------------

export const sharingKeys = {
  all: ["shares"] as const,

  list: (request: GetSharesEndpointRequest) =>
    [...sharingKeys.all, "list", request] as const,

  byIds: (request: GetSharesByIdEndpointRequest) =>
    [...sharingKeys.all, "byIds", request] as const,

  detail: (id: string) => [...sharingKeys.all, "detail", id] as const,
};

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

/**
 * Fetch shares using backend filters.
 */
export function useShares(
  request: GetSharesEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      GetSharesEndpointReply,
      Error,
      GetSharesEndpointReply,
      ReturnType<typeof sharingKeys.list>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: sharingKeys.list(request),
    queryFn: () => sharingApi.getShares(request),
    ...options,
  });
}

/**
 * Fetch shares by exact IDs.
 */
export function useSharesById(
  request: GetSharesByIdEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      GetSharesByIdEndpointReply,
      Error,
      GetSharesByIdEndpointReply,
      ReturnType<typeof sharingKeys.byIds>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: sharingKeys.byIds(request),
    queryFn: () => sharingApi.getSharesById(request),
    enabled: request.share_ids.length > 0,
    ...options,
  });
}

/**
 * Fetch a single share by ID.
 */
export function useShare(
  request: GetShareByIdEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      GetShareByIdEndpointReply,
      Error,
      GetShareByIdEndpointReply,
      ReturnType<typeof sharingKeys.detail>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: sharingKeys.detail(request.id),
    queryFn: () => sharingApi.getShareById(request),
    enabled: !!request.id,
    ...options,
  });
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

/**
 * Create a share.
 *
 * Invalidates all share lists after success.
 */
export function useCreateShare(
  options?: UseMutationOptions<
    CreateShareEndpointReply,
    Error,
    CreateShareEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // Pull `onSuccess` out of `options` so we can compose it after the
  // invalidation. Spreading `...options` AFTER our own `onSuccess` would
  // let the caller's handler silently replace ours — leaving the cache
  // stale and forcing a page reload to see the new shares list.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => sharingApi.createShare(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: sharingKeys.all,
      });

      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Update a share.
 *
 * Invalidates all share queries after success.
 * If the response contains the full updated share you can replace
 * the detail cache directly instead.
 */
export function useUpdateShare(
  options?: UseMutationOptions<
    UpdateShareEndpointReply,
    Error,
    UpdateShareEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See `useCreateShare` — keep `onSuccess` out of `restOptions` so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => sharingApi.updateShare(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: sharingKeys.all,
      });

      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Delete shares.
 *
 * Invalidates all share queries after success.
 */
export function useDeleteShares(
  options?: UseMutationOptions<
    DeleteSharesEndpointReply,
    Error,
    DeleteSharesEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See `useCreateShare` — keep `onSuccess` out of `restOptions` so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => sharingApi.deleteShares(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: sharingKeys.all,
      });

      await userOnSuccess?.(...args);
    },
  });
}
