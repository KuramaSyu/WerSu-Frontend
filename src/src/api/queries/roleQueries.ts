// role_queries.ts
//
// TanStack query hooks for the authenticated role-management
// API (RoleApi in ../RoleApi.ts). Mirrors the shape of
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

import { getRoleApi } from "../RoleApi";

import type {
  AddUserToRoleEndpointReply,
  AddUserToRoleEndpointRequest,
  CreateRoleEndpointReply,
  CreateRoleEndpointRequest,
  DeleteRoleEndpointRequest,
  GetRoleByIdEndpointReply,
  GetRoleByIdEndpointRequest,
  GetRolesByUserEndpointReply,
  GetRolesByUserEndpointRequest,
  ListRoleMembersEndpointReply,
  ListRoleMembersEndpointRequest,
  ListRolesEndpointReply,
  ListRolesEndpointRequest,
  RemoveUserFromRoleEndpointRequest,
  UpdateRoleEndpointReply,
  UpdateRoleEndpointRequest,
} from "../models/role";

// Use the registered singleton so the share-token provider installed on
// Bootstrap reaches this instance. See useNoteQueries for rationale.
const roleApi = getRoleApi();

// Query keys

export const roleKeys = {
  all: ["roles"] as const,

  list: (request: ListRolesEndpointRequest) =>
    [...roleKeys.all, "list", request] as const,

  detail: (request: GetRoleByIdEndpointRequest) =>
    [...roleKeys.all, "detail", request] as const,

  byUser: (request: GetRolesByUserEndpointRequest) =>
    [...roleKeys.all, "byUser", request] as const,

  members: (request: ListRoleMembersEndpointRequest) =>
    [...roleKeys.all, "members", request] as const,
};

// Queries

/**
 * Fetch roles via GET /api/roles with the given filter.
 * Pass name for an exact-name match and member_id to
 * restrict to roles the given user belongs to.
 */
export function useRoles(
  request: ListRolesEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      ListRolesEndpointReply,
      Error,
      ListRolesEndpointReply,
      ReturnType<typeof roleKeys.list>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: roleKeys.list(request),
    queryFn: () => roleApi.listRoles(request),
    ...options,
  });
}

/**
 * Fetch a single role by id.
 */
export function useRole(
  request: GetRoleByIdEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      GetRoleByIdEndpointReply,
      Error,
      GetRoleByIdEndpointReply,
      ReturnType<typeof roleKeys.detail>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: roleKeys.detail(request),
    queryFn: () => roleApi.getRoleById(request),
    enabled: !!request.id,
    ...options,
  });
}

/**
 * Fetch every role a user is a member of.
 */
export function useRolesByUser(
  request: GetRolesByUserEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      GetRolesByUserEndpointReply,
      Error,
      GetRolesByUserEndpointReply,
      ReturnType<typeof roleKeys.byUser>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: roleKeys.byUser(request),
    queryFn: () => roleApi.getRolesByUser(request),
    enabled: !!request.subject_user_id,
    ...options,
  });
}

/**
 * Fetch every user that is a member of a role.
 */
export function useRoleMembers(
  request: ListRoleMembersEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      ListRoleMembersEndpointReply,
      Error,
      ListRoleMembersEndpointReply,
      ReturnType<typeof roleKeys.members>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: roleKeys.members(request),
    queryFn: () => roleApi.listRoleMembers(request),
    enabled: !!request.role_id,
    ...options,
  });
}

// Mutations
/**
 * Create a role. Super-admin only on the backend.

 *
 * Invalidates every role query on success.
 */
export function useCreateRole(
  options?: UseMutationOptions<
    CreateRoleEndpointReply,
    Error,
    CreateRoleEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // Pull onSuccess out of options so we can compose it after the
  // invalidation. Spreading ...options AFTER our own onSuccess would
  // let the caller's handler silently replace ours - leaving the cache
  // stale and forcing a page reload to see the new role.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => roleApi.createRole(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: roleKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Update a role. Caller must hold manage on the role.
 */
export function useUpdateRole(
  options?: UseMutationOptions<
    UpdateRoleEndpointReply,
    Error,
    UpdateRoleEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateRole - keep onSuccess out of restOptions so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => roleApi.updateRole(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: roleKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Delete a role. Caller must hold manage on the role.
 *
 * Invalidates every role query on success. Membership edges
 * become dangling references in SpiceDB (they silently evaluate
 * to nothing); cleanup of those is the caller's responsibility.
 */
export function useDeleteRole(
  options?: UseMutationOptions<void, Error, DeleteRoleEndpointRequest>,
) {
  const queryClient = useQueryClient();

  // See useCreateRole - keep onSuccess out of restOptions so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => roleApi.deleteRole(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: roleKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Add a user as a member of a role.
 *
 * Invalidates the role members list and the by-user list (both
 * surfaces change when a membership edge is created).
 */
export function useAddUserToRole(
  options?: UseMutationOptions<
    AddUserToRoleEndpointReply,
    Error,
    AddUserToRoleEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateRole - keep onSuccess out of restOptions so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => roleApi.addUserToRole(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: roleKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Remove a user from a role's membership.
 *
 * Invalidates the role members list and the by-user list (both
 * surfaces change when a membership edge is deleted).
 */
export function useRemoveUserFromRole(
  options?: UseMutationOptions<void, Error, RemoveUserFromRoleEndpointRequest>,
) {
  const queryClient = useQueryClient();

  // See useCreateRole - keep onSuccess out of restOptions so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => roleApi.removeUserFromRole(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: roleKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}
