// TanStack query hooks for the linked-providers surface.
//
// Only one query today: the caller's linked credentials list. The actual
// link mutation is driven by the popup-based OAuth flow in
// `useOAuthLinkPopup`; the success path invalidates this query so the
// Settings -> Security card re-renders.

import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { getLinkedProvidersApi } from "../LinkedProvidersApi";
import type { LinkedCredentialsReply } from "../models/linkedProviders";

const linkedProvidersApi = getLinkedProvidersApi();

export const linkedProvidersKeys = {
  all: ["linked-providers"] as const,
  credentials: () => [...linkedProvidersKeys.all, "credentials"] as const,
};

export function useLinkedCredentials(
  options?: Omit<
    UseQueryOptions<
      LinkedCredentialsReply,
      Error,
      LinkedCredentialsReply,
      ReturnType<typeof linkedProvidersKeys.credentials>
    >,
    "queryKey" | "queryFn"
  >,
): UseQueryResult<LinkedCredentialsReply, Error> {
  return useQuery({
    queryKey: linkedProvidersKeys.credentials(),
    queryFn: () => linkedProvidersApi.getLinkedCredentials(),
    ...options,
  });
}
