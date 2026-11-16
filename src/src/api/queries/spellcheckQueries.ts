/*
  TanStack Query hooks for the spell-check preference.

  Thin wrappers around `SpellcheckApi` that add query-key management
  and cache invalidation:

    - `useSpellcheckPreferenceQuery` — read a note's preference.
    - `useSetSpellcheckPreference`   — write it, invalidating the read.

  The API resolves through `apiRegistry`, so swapping the
  implementation (see `registerSpellcheckApi`) needs no change here.
*/

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { getSpellcheckApi } from "../SpellcheckApi";

import type {
  DeleteSpellcheckPreferenceReply,
  DeleteSpellcheckPreferenceRequest,
  GetSpellcheckPreferenceReply,
  SetSpellcheckPreferenceReply,
  SetSpellcheckPreferenceRequest,
  SpellcheckPreferenceTarget,
} from "../models/spellcheck";

// Capture the API lazily per call so a test-registered implementation
// is honoured even after import time.
function resolveSpellcheckApi() {
  return getSpellcheckApi();
}

/**
 * Query-key factory. The target pair is part of the key, so one note's
 * preference never leaks into another's cache entry.
 */
export const spellcheckKeys = {
  /** Root key for every spell-check preference query. */
  all: ["spellcheck"] as const,

  /** Key for one `(userId, noteId)` preference. */
  detail: (target: SpellcheckPreferenceTarget) =>
    [...spellcheckKeys.all, target.userId, target.noteId] as const,
};

/**
 * Read a note's spell-check preference.
 * Disabled while either id is empty, so callers can mount it
 * unconditionally.
 */
export function useSpellcheckPreferenceQuery(
  target: SpellcheckPreferenceTarget,
  options?: Omit<
    UseQueryOptions<
      GetSpellcheckPreferenceReply,
      Error,
      GetSpellcheckPreferenceReply,
      ReturnType<typeof spellcheckKeys.detail>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: spellcheckKeys.detail(target),
    queryFn: () =>
      resolveSpellcheckApi().getSpellcheckPreference({
        userId: target.userId,
        noteId: target.noteId,
      }),
    enabled: Boolean(target.userId) && Boolean(target.noteId),
    ...options,
  });
}

/**
 * Persist a note's spell-check preference and invalidate its cached
 * read. A caller `onSuccess` runs after invalidation.
 */
export function useSetSpellcheckPreference(
  options?: UseMutationOptions<
    SetSpellcheckPreferenceReply,
    Error,
    SetSpellcheckPreferenceRequest
  >,
) {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) =>
      resolveSpellcheckApi().setSpellcheckPreference(request),
    ...restOptions,
    onSuccess: async (data, variables, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: spellcheckKeys.detail({
          userId: variables.userId,
          noteId: variables.noteId,
        }),
      });
      await userOnSuccess?.(data, variables, ...args);
    },
  });
}

/** Drop a note's stored preference row (idempotent). */
export function useDeleteSpellcheckPreference(
  options?: UseMutationOptions<
    DeleteSpellcheckPreferenceReply,
    Error,
    DeleteSpellcheckPreferenceRequest
  >,
) {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) =>
      resolveSpellcheckApi().deleteSpellcheckPreference(request),
    ...restOptions,
    onSuccess: async (data, variables, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: spellcheckKeys.detail(variables),
      });
      await userOnSuccess?.(data, variables, ...args);
    },
  });
}