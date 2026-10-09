// shelf_queries.ts - TanStack query hooks for the authenticated shelf-management API.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { getShelfApi } from "../ShelfApi";
import { useIsAuthenticated } from "./useUser";

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

// Resolve through the api registry so the share-token provider installed on Bootstrap reaches this instance.
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
// Fetch shelves via GET /api/shelves. include_books fills book_ids on every row.
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
  const isAuthed = useIsAuthenticated();
  return useQuery({
    queryKey: shelfKeys.list(request),
    queryFn: () => shelfApi.listShelves(request),
    // AND the caller's enabled with the auth gate so the cold-start protection composes with caller-side gating.
    ...options,
    enabled: (options?.enabled ?? true) && isAuthed,
  });
}

// Fetch a single shelf by id.
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

// Fetch multiple shelves by id in a single request.
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

// Fetch the book ids bound to a single shelf.
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

// Resolve the shelves a book sits on.
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
// Create a shelf. Invalidates every shelf query on success.
export function useCreateShelf(
  options?: UseMutationOptions<
    CreateShelfEndpointReply,
    Error,
    CreateShelfEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // Pull onSuccess out so the invalidation wrapper cannot be silently replaced by the caller's handler.
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

// Update a shelf. Invalidates every shelf query on success.
export function useUpdateShelf(
  options?: UseMutationOptions<
    UpdateShelfEndpointReply,
    Error,
    UpdateShelfEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateShelf - keep onSuccess out of restOptions.
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

// Delete a shelf. Surfaces the cascade reply from the backend as-is.
export function useDeleteShelf(
  options?: UseMutationOptions<
    DeleteShelfEndpointReply,
    Error,
    DeleteShelfEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateShelf - keep onSuccess out of restOptions.
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

// Replace the books bound to a shelf. Invalidates the shelf namespace.
export function useSetShelfBooks(
  options?: UseMutationOptions<
    SetShelfBooksEndpointReply,
    Error,
    SetShelfBooksEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateShelf - keep onSuccess out of restOptions.
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

// Attach a single book to a shelf.
export function useAttachBook(
  options?: UseMutationOptions<
    AttachBookEndpointReply,
    Error,
    AttachBookEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateShelf - keep onSuccess out of restOptions.
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

// Detach a single book from a shelf.
export function useDetachBook(
  options?: UseMutationOptions<
    DetachBookEndpointReply,
    Error,
    DetachBookEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateShelf - keep onSuccess out of restOptions.
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
