// TanStack query hooks for the authenticated passkey-management surface
// (`GET /auth/passkey/list`, `DELETE /auth/passkey/{id}`).
//
// The ceremony endpoints (`register`, `login`, `link`) live in
// `usePasskeyCeremony.ts` because they wrap the browser WebAuthn APIs
// in addition to the transport. List/revoke are pure transport calls.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { getPasskeyApi } from "../PasskeyApi";
import type {
  ListPasskeysEndpointReply,
  ListPasskeysEndpointRequest,
  RevokePasskeyEndpointRequest,
} from "../models/passkey";

// Use the registered singleton so the share-token provider installed on
// Bootstrap reaches this instance. Mirrors `useUserQueries`.
const passkeyApi = getPasskeyApi();

// -----------------------------------------------------------------------------
// Query keys
// -----------------------------------------------------------------------------

export const passkeyKeys = {
  all: ["passkeys"] as const,
  list: (request: ListPasskeysEndpointRequest) =>
    [...passkeyKeys.all, "list", request] as const,
};

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

/**
 * Fetch the caller's passkeys. Revoked rows are excluded unless
 * `request.include_revoked` is true.
 */
export function usePasskeyList(
  request: ListPasskeysEndpointRequest = {},
  options?: Omit<
    UseQueryOptions<
      ListPasskeysEndpointReply,
      Error,
      ListPasskeysEndpointReply,
      ReturnType<typeof passkeyKeys.list>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: passkeyKeys.list(request),
    queryFn: () => passkeyApi.listPasskeys(request),
    ...options,
  });
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

/**
 * Revoke one of the caller's passkeys. Invalidates `passkeyKeys.all` so
 * every list view (`usePasskeyList` with any `include_revoked` value)
 * refetches and reflects the revoked state.
 */
export function useRevokePasskey(
  options?: UseMutationOptions<
    void,
    Error,
    RevokePasskeyEndpointRequest
  >,
) {
  const queryClient = useQueryClient();

  // Keep the caller's `onSuccess` out of `restOptions` so the
  // invalidation wrapper below can't be silently overridden. See
  // `useDeleteShares` for the same pattern.
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (request) => passkeyApi.revokePasskey(request),
    ...restOptions,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: passkeyKeys.all });
      await userOnSuccess?.(...args);
    },
  });
}
