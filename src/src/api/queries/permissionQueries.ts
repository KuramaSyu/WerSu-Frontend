// TanStack query hooks for the `/api/permissions` surface.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { getPermissionsApi } from "../PermissionsApi";
import type {
  CreatePermissionBody,
  DeletePermissionBody,
  PermissionObjectQueryType,
  PermissionsReply,
  ReplacePermissionsBody,
} from "../models/search";

const permissionsApi = getPermissionsApi();

export const permissionKeys = {
  all: ["permissions"] as const,
  detail: (objectType: PermissionObjectQueryType, objectId: string) =>
    [...permissionKeys.all, objectType, objectId] as const,
};

export interface PermissionsQueryRequest {
  object_type: PermissionObjectQueryType;
  object_id: string;
}

export function usePermissions(
  request: PermissionsQueryRequest,
  options?: Omit<
    UseQueryOptions<
      PermissionsReply,
      Error,
      PermissionsReply,
      ReturnType<typeof permissionKeys.detail>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: permissionKeys.detail(request.object_type, request.object_id),
    queryFn: () => permissionsApi.get(request.object_type, request.object_id),
    enabled: !!request.object_id,
    ...options,
  });
}

function invalidate(permissions: ReturnType<typeof useQueryClient>) {
  return permissions.invalidateQueries({ queryKey: permissionKeys.all });
}

export function useCreatePermission(
  options?: UseMutationOptions<PermissionsReply, Error, CreatePermissionBody>,
) {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...rest } = options ?? {};
  return useMutation({
    mutationFn: (body) => permissionsApi.post(body),
    ...rest,
    onSuccess: async (...args) => {
      await invalidate(queryClient);
      await userOnSuccess?.(...args);
    },
  });
}

export function useDeletePermission(
  options?: UseMutationOptions<PermissionsReply, Error, DeletePermissionBody>,
) {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...rest } = options ?? {};
  return useMutation({
    mutationFn: (body) => permissionsApi.delete(body),
    ...rest,
    onSuccess: async (...args) => {
      await invalidate(queryClient);
      await userOnSuccess?.(...args);
    },
  });
}

export function useReplacePermissions(
  options?: UseMutationOptions<PermissionsReply, Error, ReplacePermissionsBody>,
) {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...rest } = options ?? {};
  return useMutation({
    mutationFn: (body) => permissionsApi.put(body),
    ...rest,
    onSuccess: async (...args) => {
      await invalidate(queryClient);
      await userOnSuccess?.(...args);
    },
  });
}
