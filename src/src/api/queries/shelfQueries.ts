// shelf_queries.ts
//
// TanStack query hooks for the authenticated shelf-management
// API (ShelfApi in ../ShelfApi.ts). Mirrors the shape of
// sharingQueries.ts: a xxxKeys object for query-key
// composition, useXxx query hooks, and useXxx mutation hooks
// that invalidate the matching namespace on success.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { getShelfApi } from "../ShelfApi";

import type {
  AttachBookEndpointReply,
  AttachBookEndpointRequest,
  CreateShelfEndpointReply,
  CreateShelfEndpointRequest,
  DeleteShelfEndpointReply,
  DeleteShelfEndpointRequest,
  DetachBookEndpointReply,
  DetachBookEndpointRequest,
  GetShelfBooksEndpointReply,
  GetShelfBooksEndpointRequest,
  GetShelfByIdEndpointReply,
  GetShelfByIdEndpointRequest,
  GetShelvesByBookEndpointReply,
  GetShelvesByBookEndpointRequest,
  GetShelvesByIdsEndpointReply,
  GetShelvesByIdsEndpointRequest,
  ListShelvesEndpointReply,
  ListShelvesEndpointRequest,
  SetShelfBooksEndpointReply,
  SetShelfBooksEndpointRequest,
  UpdateShelfEndpointReply,
  UpdateShelfEndpointRequest,
} from "../models/shelf";

// Use the registered singleton so the share-token provider installed on
// Bootstrap reaches this instance. See useNoteQueries for rationale.
const shelfApi = getShelfApi();

// Query keys

export const shelfKeys = {
  all: ["shelves"] as const,

  list: (request: ListShelvesEndpointRequest) =>
    [...shelfKeys.all, "list", request] as const,

  detail: (request: GetShelfByIdEndpointRequest) =>
    [...shelfKeys.all, "detail", request] as const,

  byIds: (request: GetShelvesByIdsEndpointRequest) =>
    [...shelfKeys.all, "byIds", request] as const,

  books: (request: GetShelfBooksEndpointRequest) =>
    [...shelfKeys.all, "books", request] as const,

  byBook: (request: GetShelvesByBookEndpointRequest) =>
    [...shelfKeys.all, "byBook", request] as const,
};

// Queries
/**
 * Fetch shelves via GET /api/shelves with the given filter.
 * include_books=true makes the backend fill book_ids on
 * every row.
 */
export function useShelves(
  request: ListShelvesEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      ListShelvesEndpointReply,
      Error,
      ListShelvesEndpointReply,
      ReturnType<typeof shelfKeys.list>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: shelfKeys.list(request),
    queryFn: () => shelfApi.listShelves(request),
    ...options,
  });
}

/**
 * Fetch a single shelf by id.
 */
export function useShelf(
  request: GetShelfByIdEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      GetShelfByIdEndpointReply,
      Error,
      GetShelfByIdEndpointReply,
      ReturnType<typeof shelfKeys.detail>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: shelfKeys.detail(request),
    queryFn: () => shelfApi.getShelfById(request),
    enabled: !!request.id,
    ...options,
  });
}

/**
 * Fetch multiple shelves by id in a single request.
 * Skipped when request.ids is empty so an empty arg does not
 * hit the backend.
 */
export function useShelvesById(
  request: GetShelvesByIdsEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      GetShelvesByIdsEndpointReply,
      Error,
      GetShelvesByIdsEndpointReply,
      ReturnType<typeof shelfKeys.byIds>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: shelfKeys.byIds(request),
    queryFn: () => shelfApi.getShelvesByIds(request),
    enabled: request.ids.length > 0,
    ...options,
  });
}

/**
 * Fetch the book ids bound to a single shelf.
 */
export function useShelfBooks(
  request: GetShelfBooksEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      GetShelfBooksEndpointReply,
      Error,
      GetShelfBooksEndpointReply,
      ReturnType<typeof shelfKeys.books>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: shelfKeys.books(request),
    queryFn: () => shelfApi.getShelfBooks(request),
    enabled: !!request.id,
    ...options,
  });
}

/**
 * Resolve the shelves a book sits on.
 */
export function useShelvesByBook(
  request: GetShelvesByBookEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      GetShelvesByBookEndpointReply,
      Error,
      GetShelvesByBookEndpointReply,
      ReturnType<typeof shelfKeys.byBook>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: shelfKeys.byBook(request),
    queryFn: () => shelfApi.getShelvesByBook(request),
    enabled: !!request.book_id,
    ...options,
  });
}

// Mutations
/**
 * Create a shelf.

 *
 * Invalidates every shelf query on success so the new row shows
 * up in the next list/detail fetch.
 */
export function useCreateShelf(
  options?: UseMutationOptions<
    CreateShelfEndpointReply,
    Error,
    CreateShelfEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // Pull onSuccess out of options so we can compose it after the
  // invalidation. Spreading ...options AFTER our own onSuccess would
  // let the caller's handler silently replace ours - leaving the cache
  // stale and forcing a page reload to see the new shelf.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => shelfApi.createShelf(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: shelfKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Update a shelf.
 *
 * Invalidates every shelf query on success.
 */
export function useUpdateShelf(
  options?: UseMutationOptions<
    UpdateShelfEndpointReply,
    Error,
    UpdateShelfEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateShelf - keep onSuccess out of restOptions so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => shelfApi.updateShelf(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: shelfKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Delete a shelf. The backend returns the would-be / was-been
 * cascade in DeleteShelfReply; we surface it as-is.
 */
export function useDeleteShelf(
  options?: UseMutationOptions<
    DeleteShelfEndpointReply,
    Error,
    DeleteShelfEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateShelf - keep onSuccess out of restOptions so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => shelfApi.deleteShelf(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: shelfKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Replace the set of books bound to a shelf.
 *
 * Invalidates the shelf namespace so both the shelf row and
 * the books sub-query refresh.
 */
export function useSetShelfBooks(
  options?: UseMutationOptions<
    SetShelfBooksEndpointReply,
    Error,
    SetShelfBooksEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateShelf - keep onSuccess out of restOptions so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => shelfApi.setShelfBooks(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: shelfKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Attach a single book to a shelf.
 */
export function useAttachBook(
  options?: UseMutationOptions<
    AttachBookEndpointReply,
    Error,
    AttachBookEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateShelf - keep onSuccess out of restOptions so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => shelfApi.attachBook(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: shelfKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Detach a single book from a shelf.
 */
export function useDetachBook(
  options?: UseMutationOptions<
    DetachBookEndpointReply,
    Error,
    DetachBookEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateShelf - keep onSuccess out of restOptions so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => shelfApi.detachBook(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: shelfKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}
