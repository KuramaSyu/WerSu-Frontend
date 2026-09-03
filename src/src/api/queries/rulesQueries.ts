// rules_queries.ts
//
// TanStack query hooks for the authenticated rule-management
// API (RuleApi in ../RuleApi.ts). Mirrors the shape of
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

import { getRuleApi } from "../RuleApi";

import type {
  CreateRuleEndpointReply,
  CreateRuleEndpointRequest,
  DeleteRuleEndpointRequest,
  GetRuleByIdEndpointReply,
  GetRuleByIdEndpointRequest,
  ListRulesEndpointReply,
  ListRulesEndpointRequest,
  UpdateRuleEndpointReply,
  UpdateRuleEndpointRequest,
} from "../models/rule";

// Use the registered singleton so the share-token provider installed on
// Bootstrap reaches this instance. See useNoteQueries for rationale.
const ruleApi = getRuleApi();

// Query keys

export const ruleKeys = {
  all: ["rules"] as const,

  list: (request: ListRulesEndpointRequest) =>
    [...ruleKeys.all, "list", request] as const,

  detail: (request: GetRuleByIdEndpointRequest) =>
    [...ruleKeys.all, "detail", request] as const,
};

// Queries

/**
 * Fetch rules via GET /api/rules with the given filter.
 * Every filter field is optional and combines with AND.
 * enabled_only=true filters the list down to enabled rules.
 */
export function useRules(
  request: ListRulesEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      ListRulesEndpointReply,
      Error,
      ListRulesEndpointReply,
      ReturnType<typeof ruleKeys.list>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ruleKeys.list(request),
    queryFn: () => ruleApi.listRules(request),
    ...options,
  });
}

/**
 * Fetch a single rule by id.
 */
export function useRule(
  request: GetRuleByIdEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      GetRuleByIdEndpointReply,
      Error,
      GetRuleByIdEndpointReply,
      ReturnType<typeof ruleKeys.detail>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ruleKeys.detail(request),
    queryFn: () => ruleApi.getRuleById(request),
    enabled: !!request.id,
    ...options,
  });
}

// Mutations
/**
 * Create a rule.

 *
 * Invalidates every rule query on success so the new row shows
 * up in the next list/detail fetch.
 */
export function useCreateRule(
  options?: UseMutationOptions<
    CreateRuleEndpointReply,
    Error,
    CreateRuleEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // Pull onSuccess out of options so we can compose it after the
  // invalidation. Spreading ...options AFTER our own onSuccess would
  // let the caller's handler silently replace ours - leaving the cache
  // stale and forcing a page reload to see the new rule.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => ruleApi.createRule(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: ruleKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Update a rule. Only the supplied fields are forwarded to the
 * backend; request.body is the full optional UpdateRuleBody.
 *
 * Invalidates every rule query on success.
 */
export function useUpdateRule(
  options?: UseMutationOptions<
    UpdateRuleEndpointReply,
    Error,
    UpdateRuleEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // See useCreateRule - keep onSuccess out of restOptions so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => ruleApi.updateRule(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: ruleKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}

/**
 * Delete a rule.
 */
export function useDeleteRule(
  options?: UseMutationOptions<void, Error, DeleteRuleEndpointRequest>,
) {
  const queryClient = useQueryClient();

  // See useCreateRule - keep onSuccess out of restOptions so the
  // invalidation wrapper can't be overridden by the caller.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => ruleApi.deleteRule(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: ruleKeys.all,
      });
      await userOnSuccess?.(...args);
    },
  });
}
