// sharing_queries.ts

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { sharingApi } from "../SharingApi";

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

  return useMutation({
    mutationFn: (request) => sharingApi.createShare(request),

    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: sharingKeys.all,
      });

      await options?.onSuccess?.(...args);
    },

    ...options,
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

  return useMutation({
    mutationFn: (request) => sharingApi.updateShare(request),

    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: sharingKeys.all,
      });

      await options?.onSuccess?.(...args);
    },

    ...options,
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

  return useMutation({
    mutationFn: (request) => sharingApi.deleteShares(request),

    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: sharingKeys.all,
      });

      await options?.onSuccess?.(...args);
    },

    ...options,
  });
}
