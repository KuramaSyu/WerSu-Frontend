// TanStack query hooks for the linked-providers surface.
//
// Today the SPA consumes exactly one endpoint, GET /api/auth/me/credentials,
// which returns the caller's linked credentials and registered passkeys.
// The actual link mutation is driven by the popup-based OAuth flow in
// `useOAuthLinkPopup`; the success path invalidates this query so the
// Settings -> Security card re-renders.
//
// `useLinkedProvidersSummary` layers derived state on top of the raw
// reply (Discord linked?, password set?, how many active passkeys?)
// so consumer components never touch `c.kind` directly.

import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { getLinkedProvidersApi } from "../LinkedProvidersApi";
import {
  discordIdFromCredential,
  linkedProviderKindLabel,
  linkedProvidersSelectors,
  type CredentialLinkState,
  type LinkedCredentialsReply,
  type LinkedProvider,
} from "../models/linkedProviders";
import {
  DiscordLinkedAccountImpl,
  type DiscordLinkedAccount,
} from "../../utils/DiscordLinkedAccount";

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

export interface LinkedProvidersSummary {
  ready: boolean;
  discordLinked: CredentialLinkState;
  passwordSet: CredentialLinkState;
  activePasskeyCount: number | null;
  /**
   * `DiscordLinkedAccount` once the credentials response lands and a
   * Discord row is present; `undefined` while loading or when Discord
   * is not linked.
   */
  discord?: DiscordLinkedAccount;
}

/**
 * Pull the Discord linked-account out of a single credential row.
 * Returns `undefined` when the row isn't Discord or the snowflake
 * is missing. Exported so test mocks for `useLinkedProvidersSummary`
 * can reuse the production class without re-implementing the math.
 */
export function buildDiscordLinkedAccount(
  credential: LinkedProvider,
): DiscordLinkedAccount | undefined {
  const id = discordIdFromCredential(credential);
  if (id === undefined) return undefined;
  return new DiscordLinkedAccountImpl(id);
}

/**
 * Derived view of `useLinkedCredentials` for Settings -> Security.
 * Components consume this rather than picking apart the raw reply;
 * the type forces the renderer to handle the loading state.
 */
export function useLinkedProvidersSummary(): LinkedProvidersSummary {
  const query = useLinkedCredentials();
  const reply = query.data;
  const discordCredential = reply?.credentials.find(
    (c) => linkedProviderKindLabel(c.kind) === "discord",
  );
  return {
    ready: query.isSuccess,
    discordLinked: linkedProvidersSelectors.hasDiscord(reply),
    passwordSet: linkedProvidersSelectors.hasPassword(reply),
    activePasskeyCount: linkedProvidersSelectors.activePasskeyCount(reply),
    discord: discordCredential
      ? buildDiscordLinkedAccount(discordCredential)
      : undefined,
  };
}
