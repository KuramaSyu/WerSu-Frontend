// TanStack query hooks for the unauthenticated public-share surface
// (`PublicSharingApi` in `../SharingApi.ts`). Kept out of
// `sharingQueries.ts` so the public note page never accidentally
// hits the authenticated share-management endpoints.

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { getPublicSharingApi } from "../SharingApi";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const publicSharingApi = getPublicSharingApi();

import type {
  GetPublicShareEndpointReply,
  GetPublicShareEndpointRequest,
  PostPublicAccessTokenReply,
} from "../models/publicSharing";

// Query keys

export const publicSharingKeys = {
  all: ["publicShares"] as const,

  publicShare: (shareId: string) =>
    [...publicSharingKeys.all, "publicShare", shareId] as const,

  // JWT isn't cached here - lives in `useAuthStore.shareAccessToken`,
  // rotated by `useShareAccessToken`. Listed for symmetry with
  // `sharingKeys.all` and for any invalidate-on-public-share callers.
  accessToken: (shareId: string) =>
    [...publicSharingKeys.all, "accessToken", shareId] as const,
};

// Queries

/**
 * Resolve a share ID to the public grant.
 * Hits `GET /api/shares/public/?share_id=...` and returns the note,
 * permission, and active window. Disabled until `share_id` is non-empty.
 *
 * Public grant - do NOT use the authenticated `useShares` here; it
 * requires user cookies and 400/404s for a public share.
 */
export function usePublicShare(
  request: GetPublicShareEndpointRequest,
  options?: Omit<
    UseQueryOptions<
      GetPublicShareEndpointReply,
      Error,
      GetPublicShareEndpointReply,
      ReturnType<typeof publicSharingKeys.publicShare>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: publicSharingKeys.publicShare(request.share_id),
    queryFn: () => publicSharingApi.getPublicShare(request),
    enabled: !!request.share_id,
    // Fresh enough that a revoked share stops working on the next
    // page load, not so fresh that every keystroke refetches.
    staleTime: 30_000,
    ...options,
  });
}

/**
 * Issue a public-share JWT. Lower-level primitive - usually
 * `useShareAccessToken` (writes into `useAuthStore.shareAccessToken`)
 * is what callers want.
 */
export function usePublicAccessToken(
  shareId: string,
  options?: Omit<
    UseQueryOptions<
      PostPublicAccessTokenReply,
      Error,
      PostPublicAccessTokenReply,
      ReturnType<typeof publicSharingKeys.accessToken>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: publicSharingKeys.accessToken(shareId),
    queryFn: () => publicSharingApi.fetchPublicAccessToken(shareId),
    enabled: !!shareId,
    // JWTs rotate on their own exp-claim - don't let TanStack
    // background-refetch and stomp on the schedule.
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...options,
  });
}
